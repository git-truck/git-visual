import { log } from "./log.server"
import { describeAsyncJob, getBaseDirFromPath, getDirName, promiseHelper, runProcess } from "./util.server"
import { resolve, join } from "path"
import { promises as fs, existsSync } from "fs"
import type { AnalyzerData, GitRefs, Repository } from "./model"
import { AnalyzerDataInterfaceVersion } from "./model"
import { branchCompare, semverCompare } from "~/util"
import os from "os"

export enum ANALYZER_CACHE_MISS_REASONS {
  OTHER_REPO = "The cache was not created for this repo",
  NOT_CACHED = "No cache was found",
  BRANCH_HEAD_CHANGED = "Branch head changed",
  DATA_VERSION_MISMATCH = "Outdated cache"
}

export class GitCaller {
  private useCache = true
  private catFileCache: Map<string, string> = new Map()


  // eslint-disable-next-line no-useless-constructor
  constructor(private repo: string, public branch: string, private path: string) {}

  static async isGitRepo(path: string): Promise<boolean> {
    const gitFolderPath = resolve(path, ".git")
    const hasGitFolder = existsSync(gitFolderPath)
    if (!hasGitFolder) return false
    const [, findBranchHeadError] = await promiseHelper(GitCaller.findBranchHead(path))
    return Boolean(hasGitFolder && !findBranchHeadError)
  }

  /**
   *
   * @param repo The repo to find the branch head for
   * @param branch The branch to find the head for (default: checkout branch)
   * @returns Promise<[branchHead: string, branchName: string]>
   */
  static async findBranchHead(repo: string, branch?: string): Promise<[string, string]> {
    if (!branch) {
      const [foundBranch, getBranchError] = await promiseHelper(GitCaller._getRepositoryHead(repo))
      if (getBranchError) {
        throw getBranchError
      }
      branch = foundBranch
    }

    const gitFolder = join(repo, ".git")
    if (!existsSync(gitFolder)) {
      throw Error("No git folder exists at " + gitFolder)
    }
    // Find file containing the branch head

    const branchHead = await GitCaller._revParse(gitFolder, branch)
    log.debug(`${branch} -> [commit]${branchHead}`)

    return [branchHead, branch]
  }

  static getCachePath(repo: string, branch: string) {
    return resolve(os.tmpdir(), "git-truck", repo, `${branch}.json`)
  }

  async getRepositoryHead() {
    return await GitCaller._getRepositoryHead(this.repo)
  }

  async gitShow(commits: string[]) {
    const args = [
      "show",
      "--no-patch",
      '--format="author <|%aN|> date <|%at|> message <|%s|> body <|%b|> hash <|%H|>"',
      ...commits
    ]

    const result = (await runProcess(this.path, "git", args)) as string
    return result.trim()
  }

  static async _getRepositoryHead(dir: string) {
    const result = (await runProcess(dir, "git", ["rev-parse", "--abbrev-ref", "HEAD"])) as string
    return result.trim()
  }

  async lsTree(hash: string) {
    return await GitCaller._lsTree(this.path, hash)
  }

  static async _lsTree(repo: string, hash: string) {
    const result = (await runProcess(repo, "git", ["ls-tree", "-rlt", hash])) as string
    return result.trim()
  }

  async revParse(ref: string) {
    return await GitCaller._revParse(this.path, ref)
  }

  static async _revParse(dir: string, ref: string) {
    const result = (await runProcess(dir, "git", ["rev-list", "-n", "1", ref])) as string
    return result.trim()
  }

  static async getRepoMetadata(repoPath: string, invalidateCache: boolean): Promise<Repository | null> {
    const repoDir = getDirName(repoPath)
    const isRepo = await GitCaller.isGitRepo(repoPath)
    if (!isRepo) {
      return null
    }
    const refs = GitCaller.parseRefs(await GitCaller._getRefs(repoPath, ""))
    const allHeads = new Set([...Object.entries(refs.Branches), ...Object.entries(refs.Tags)]).values()
    const headsWithCaches = await Promise.all(
      Array.from(allHeads).map(async ([headName, head]) => {
        const [result] = await GitCaller.retrieveCachedResult({
          repo: getDirName(repoPath),
          branch: headName,
          branchHead: head,
          invalidateCache
        })
        return {
          headName,
          head,
          isAnalyzed: result !== null
        }
      })
    )
    const analyzedHeads = headsWithCaches
      .filter((head) => head.isAnalyzed)
      .reduce(
        (acc, headEntry) => ({ ...acc, [headEntry.head]: true, [headEntry.headName]: true }),
        {} as { [branch: string]: boolean }
      )

    const repo: Repository = {
      name: repoDir,
      path: repoPath,
      data: null,
      reasons: [],
      currentHead: await GitCaller._getRepositoryHead(repoPath),
      refs,
      analyzedHeads
    }

    try {
      const [findBranchHeadResult, error] = await promiseHelper(GitCaller.findBranchHead(repoPath))
      if (!error) {
        const [branchHead, branch] = findBranchHeadResult
        const [data, reasons] = await GitCaller.retrieveCachedResult({
          repo: repoDir,
          branch,
          branchHead,
          invalidateCache
        })
        repo.data = data
        repo.reasons = reasons
      }
    } catch (e) {
      return null
    }
    return repo
  }

  static async scanDirectoryForRepositories(
    argPath: string,
    invalidateCache: boolean
  ): Promise<[Repository | null, Repository[]]> {
    let userRepo: Repository | null = null
    const [pathIsRepo] = await describeAsyncJob({
      job: () => GitCaller.isGitRepo(argPath),
      beforeMsg: "Checking if path is a git repo...",
      afterMsg: "Done checking if path is a git repo",
      errorMsg: "Error checking if path is a git repo"
    })

    const baseDir = resolve(pathIsRepo ? getBaseDirFromPath(argPath) : argPath)

    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    const dirs = entries.filter((entry) => entry.isDirectory()).map(({ name }) => name)

    const [repoResults] = (await describeAsyncJob({
      job: () =>
        Promise.allSettled(
          dirs.map(async (repo) => {
            const result = await GitCaller.getRepoMetadata(join(baseDir, repo), invalidateCache)
            if (!result) throw Error("Not a git repo")
            return result
          })
        ),
      beforeMsg: "Scanning for repositories...",
      afterMsg: "Done scanning for repositories",
      errorMsg: "Error scanning for repositories"
    })) as [PromiseSettledResult<Repository>[], null]

    const onlyRepos = (
      repoResults.filter((currentRepo) => {
        if (currentRepo.status === "rejected") return false
        if (pathIsRepo && currentRepo.value.name === getDirName(argPath)) {
          userRepo = currentRepo.value
        }
        return true
      }) as PromiseFulfilledResult<Repository>[]
    ).map((result) => result.value)

    return [userRepo, onlyRepos]
  }

  static parseRefs(refsAsMultilineString: string): GitRefs {
    const gitRefs: GitRefs = {
      Branches: {},
      Tags: {}
    }

    const regex = /^(?<hash>.*) refs\/(?<ref_type>.*?)\/(?<path>.*)$/gm

    const matches = refsAsMultilineString.matchAll(regex)
    let next = matches.next()

    while (next.value) {
      const groups = next.value.groups
      next = matches.next()
      const hash: string = groups["hash"]
      const ref_type: string = groups["ref_type"]
      const path: string = groups["path"]

      switch (ref_type) {
        case "heads":
          gitRefs.Branches[path] = hash
          break
        case "remotes":
          break
        case "tags":
          gitRefs.Tags[path] = hash
          break
        default:
          break
      }
    }

    gitRefs.Branches = Object.fromEntries(Object.entries(gitRefs.Branches).sort(([a], [b]) => branchCompare(a, b)))

    gitRefs.Tags = Object.fromEntries(Object.entries(gitRefs.Tags).sort(([a], [b]) => semverCompare(a, b) * -1))

    return gitRefs
  }

  async gitLog(skip: number, count: number) {
    const args = [
      "log",
      `--skip=${skip}`,
      `--max-count=${count}`,
      this.branch,
      "--summary",
      "--numstat",
      // "--cc", // include file changes for merge commits
      '--format="author <|%aN|> date <|%ct|> message <|%s|> body <|%b|> hash <|%H|>"'
    ]

    const result = (await runProcess(this.path, "git", args)) as string
    return result.trim()
  }

  static async retrieveCachedResult({
    repo,
    branch,
    branchHead,
    invalidateCache = false
  }: {
    repo: string
    branch: string
    branchHead: string
    invalidateCache: boolean
  }): Promise<[AnalyzerData | null, ANALYZER_CACHE_MISS_REASONS[]]> {
    if (invalidateCache) {
      return [null, [ANALYZER_CACHE_MISS_REASONS.NOT_CACHED]]
    }
    const reasons = []
    const cachedDataPath = GitCaller.getCachePath(repo, branch)
    if (!existsSync(cachedDataPath)) return [null, [ANALYZER_CACHE_MISS_REASONS.NOT_CACHED]]

    const cachedData = JSON.parse(await fs.readFile(cachedDataPath, "utf8")) as AnalyzerData

    // Check if the current branchHead matches the hash of the analyzed commit from the cache
    const branchHeadMatches = branchHead === cachedData.commit.hash
    if (!branchHeadMatches) reasons.push(ANALYZER_CACHE_MISS_REASONS.BRANCH_HEAD_CHANGED)

    // Check if the data uses the most recent analyzer data interface
    const dataVersionMatches = cachedData.interfaceVersion === AnalyzerDataInterfaceVersion
    if (!branchHeadMatches) reasons.push(ANALYZER_CACHE_MISS_REASONS.DATA_VERSION_MISMATCH)

    // Check if the selected repository has changed
    const repoMatches = repo === cachedData.repo

    const cacheConditions = {
      branchHeadMatches,
      dataVersionMatches,
      repoMatches
    }

    // Only return cached data if every criteria is met
    if (!Object.values(cacheConditions).every(Boolean)) return [null, reasons]

    return [cachedData, reasons]
  }

  setUseCache(useCache: boolean) {
    this.useCache = useCache
  }

  public async commitCountSinceCommit(hash: string) {
    const result = await runProcess(this.path, "git", ["rev-list", "--count", `${hash}..HEAD`]) as number
    return result
  }

  async getRefs() {
    return await GitCaller._getRefs(this.repo, this.branch)
  }

  static async _getRefs(repo: string, branch: string) {
    const result = await runProcess(repo, "git", ["show-ref", branch])
    return result as string
  }

  private async catFile(hash: string) {
    const result = await runProcess(this.path, "git", ["cat-file", "-p", hash])
    return result as string
  }

  async findBranchHead() {
    return await GitCaller.findBranchHead(this.path, this.branch)
  }

  async catFileCached(hash: string): Promise<string> {
    if (this.useCache) {
      const cachedValue = this.catFileCache.get(hash)
      if (cachedValue) {
        return cachedValue
      }
    }
    const result = await this.catFile(hash)
    this.catFileCache.set(hash, result)

    return result
  }

  async getCommitCount() {
    const result = await runProcess(this.path, "git", ["rev-list", "--count", this.branch])
    return result as number
  }


  async getDefaultGitSettingValue(setting: string) {
    const result = await runProcess(this.path, "git", ["config", setting])
    return result as string
  }

  async resetGitSetting(settingToReset: string, value: string) {
    if (!value) {
      await runProcess(this.path, "git", ["config", "--unset", settingToReset])
      log.debug(`Unset ${settingToReset}`)
    } else {
      await runProcess(this.path, "git", ["config", settingToReset, value])
      log.debug(`Reset ${settingToReset} to ${value}`)
    }
  }

  async setGitSetting(setting: string, value: string) {
    await runProcess(this.path, "git", ["config", setting, value])
    log.debug(`Set ${setting} to ${value}`)
  }
}
