import type {
  FileChange,
  GitBlobObject,
  GitCommitObject,
  GitLogEntry,
  GitTreeObject,
  HydratedGitBlobObject,
  HydratedGitCommitObject,
  HydratedGitTreeObject,
} from "./model"
import { analyzeRenamedFile } from "./util.server"
import { GitCaller } from "./git-caller.server"
import { getCoAuthors } from "./coauthors.server"
import { log } from "./log.server"
import { gitLogRegex, contribRegex } from "./constants"
import { cpus } from "os"

let renamedFiles: Map<string, {path: string, timestamp: number}[]>
let commits: Record<string, GitLogEntry>
let authors: Set<string>

async function gatherCommitsInRange(start: number, end: number) {
  log.debug(`Start thread at ${start}`)
  const maxCommitsPerRun = 20000
  for (let commitIndex = start; commitIndex < end; commitIndex += maxCommitsPerRun) {
    if (commitIndex > end) commitIndex = end;
    const commitCountToGet = Math.min(end - commitIndex, maxCommitsPerRun)
    const gitLogResult = await GitCaller.getInstance().gitLog(commitIndex, commitCountToGet)

    const matches = gitLogResult.matchAll(gitLogRegex)
    for (const match of matches) {
      const groups = match.groups ?? {}
      const author = groups.author
      const time = Number(groups.date)
      const body = groups.body
      const message = groups.message
      const hash = groups.hash
      const contributionsString = groups.contributions
      const coauthors = body ? getCoAuthors(body) : []
      const fileChanges: FileChange[] = []
      
      log.debug(`Checking commit from ${time}`)

      authors.add(author)
      for (const coauthor of coauthors) authors.add(coauthor.name)

      if (contributionsString) {
        const contribMatches = contributionsString.matchAll(contribRegex)
        for (const contribMatch of contribMatches) {
          const file = contribMatch.groups?.file.trim()
          const isBinary = contribMatch.groups?.insertions === "-"
          if (!file) throw Error("file not found")


          let filePath = file
          if (file.includes("=>")) {
            filePath = analyzeRenamedFile(filePath, renamedFiles, time)
          }
          
          const contribs = isBinary ? 1 : Number(contribMatch.groups?.insertions ?? "0") + Number(contribMatch.groups?.deletions ?? "0")
          fileChanges.push({isBinary, contribs, path: filePath})
        }
      }
      commits[hash] = { author, time, body, message, hash, coauthors, fileChanges }
    }
  }
  log.debug(`Finished thread at ${start}`)
}

async function updateCreditOnBlob(blob: HydratedGitBlobObject, commit: GitLogEntry, change: FileChange) {
  await blob.mutex.acquire()
  try {
    if (!blob.commits) blob.commits = []
    blob.commits.push(commit.hash)
    blob.noCommits = (blob.noCommits ?? 0) + 1
    if (!blob.lastChangeEpoch || blob.lastChangeEpoch < commit.time) blob.lastChangeEpoch = commit.time

    if (change.isBinary) {
      blob.isBinary = true
      blob.authors[commit.author] = (blob.authors[commit.author] ?? 0) + 1

      for (const coauthor of commit.coauthors) {
        blob.authors[coauthor.name] = (blob.authors[coauthor.name] ?? 0) + 1
      }
      return
    }

    blob.authors[commit.author] = (blob.authors[commit.author] ?? 0) + change.contribs

    for (const coauthor of commit.coauthors) {
      blob.authors[coauthor.name] = (blob.authors[coauthor.name] ?? 0) + change.contribs
    }
  } finally {
    blob.mutex.release()
  }
}

export async function hydrateData(
  commit: GitCommitObject
): Promise<[HydratedGitCommitObject, string[], Record<string, GitLogEntry>]> {
  const data = commit as HydratedGitCommitObject
  const fileMap = convertFileTreeToMap(data.tree)
  initially_mut(data)

  const commitCount = await GitCaller.getInstance().getCommitCount()
  const threadCount = Math.min(Math.max(cpus().length - 2, 2), 8);
  // const threadCount = 1

  const sectionSize = Math.ceil(commitCount / threadCount);

  const promises = Array.from({ length: threadCount }, (_, i) => {
    const sectionStart = i * sectionSize;
    let sectionEnd = (i + 1) * sectionSize;
    if (sectionEnd > commitCount) sectionEnd = commitCount
    return gatherCommitsInRange(sectionStart, sectionEnd);
  });

  await Promise.all(promises)

  const commitvals = Object.values(commits)
  await hydrateBlobs(fileMap, commitvals)
  
  fileMap.forEach((blob, _) => {
    (blob as HydratedGitBlobObject).commits.sort((a, b) => {
      return commits[b].time - commits[a].time
    })
  })
  return [data, Array.from(authors), commits]
}

async function hydrateBlobs(files: Map<string, GitBlobObject>, commits: GitLogEntry[]) {
  for (const commit of commits) {
    for (const change of commit.fileChanges) {
      let recentChange = {path: change.path, timestamp: commit.time}
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const rename = getRecentRename(recentChange.timestamp, recentChange.path)
        if (!rename) break
        recentChange = rename
      }
      const blob = files.get(recentChange.path)
      if (!blob) continue
      await updateCreditOnBlob(blob as HydratedGitBlobObject, commit, change)
    }
  }
}

function convertFileTreeToMap(tree: GitTreeObject) {
  const map = new Map<string, GitBlobObject>()

  function aux(recTree: GitTreeObject) {
    for (const child of recTree.children) {
      if (child.type === "blob") {
        map.set(child.path.substring(child.path.indexOf("/")+1), child)
      } else {
        aux(child)
      }
    }
  }

  aux(tree)
  return map
}

function getRecentRename(targetTimestamp: number, path: string) {
  const renames = renamedFiles.get(path);
  if (!renames) return undefined;

  let minTimestamp = Infinity;
  let resultRename = undefined;

  for (const rename of renames) {
    const currentTimestamp = rename.timestamp;
    if (currentTimestamp > targetTimestamp && currentTimestamp < minTimestamp) {
      minTimestamp = currentTimestamp;
      resultRename = rename;
    }
  }

  if (minTimestamp === Infinity) return undefined;
  return resultRename;
}


function initially_mut(data: HydratedGitCommitObject) {
  data.oldestLatestChangeEpoch = Number.MAX_VALUE
  data.newestLatestChangeEpoch = Number.MIN_VALUE
  authors = new Set()
  commits = {}
  renamedFiles = new Map<string, {path: string, timestamp: number}[]>()

  addAuthorsField_mut(data.tree)
}

function addAuthorsField_mut(tree: HydratedGitTreeObject) {
  for (const child of tree.children) {
    if (child.type === "blob") {
      child.authors = {}
    } else {
      addAuthorsField_mut(child)
    }
  }
}
