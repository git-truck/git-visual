import type { GitLogEntry, HydratedGitObject, HydratedGitTreeObject } from "~/analyzer/model"
import { Fragment } from "react"
import { dateFormatLong } from "~/util"
import { useData } from "~/contexts/DataContext"
import commitIcon from "~/assets/commit_icon.png"
import type { AccordionData } from "./accordion/Accordion";
import Accordion from "./accordion/Accordion"

export type SortCommitsMethods = "date" | "author"

interface props {
  state: "idle" | "submitting" | "loading"
  clickedObject: HydratedGitObject
}

export function FileHistoryElement(props: props) {
  const { analyzerData } = useData()

  let fileCommits: GitLogEntry[] = []
  if (props.clickedObject.type === "blob") {
    try {
      fileCommits = props.clickedObject.commits.map((c) => analyzerData.commits[ c ])
    } catch (e) {
      console.log(e)
    }
  } else {
    try {
      fileCommits = Array.from(calculateCommitsForSubTree(props.clickedObject))
        .map((c) => analyzerData.commits[ c ])
        .sort((a, b) => b.time - a.time)
    } catch (e) {
      console.log(e)
    }
  }

  return <CommitHistory commits={ fileCommits } />
}

interface CommitDistFragProps {
  items: GitLogEntry[]
  show: boolean
  commitCutoff: number
  sortBy?: SortCommitsMethods
  handleOnClick?: (commit: GitLogEntry) => void
}

export function CommitDistFragment(props: CommitDistFragProps) {
  if (!props.show || !props.items) return null
  const sortMethod: SortCommitsMethods = props.sortBy !== undefined ? props.sortBy : "date"

  const cleanGroupItems: { [ key: string ]: GitLogEntry[] } = sortCommits(props.items, sortMethod)

  const items: Array<AccordionData> = new Array<AccordionData>()
  for (const [ key, values ] of Object.entries(cleanGroupItems)) {
    items.push({
      title: key,
      content: (
        <>
          { values.map((value: GitLogEntry) => {
            return (
              <>
                <li
                  className="cursor-auto"
                  style={{listStyleImage: `url(${commitIcon})`}}
                  onClick={ () => (props.handleOnClick ? props.handleOnClick(value) : null) }
                  key={ value.time + value.message + "--itemContentAccordion" }
                >
                  { value.message }
                </li>
              </>
            )
          }) }
        </>
      ),
    })
  }

  return (
    <>
      <Fragment key={ items.length.toString() + sortMethod + props.commitCutoff.toString() + new Date().toDateString() }>
        <Accordion
          titleLabels={ true }
          multipleOpen={ true }
          openByDefault={ true }
          items={ items }
          itemsCutoff={ props.commitCutoff }
        ></Accordion>
      </Fragment>
    </>
  )
}

function CommitHistory(props: { commits: GitLogEntry[] | undefined }) {
  const commits = props.commits ?? []
  const commitCutoff = 3

  if (commits.length == 0) {
    return (
      <>
        <h3 className="font-bold">Commit history</h3>
        <div>
          <p>No commits found</p>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="flex cursor-pointer justify-between hover:opacity-70">
        <label className="label grow">
          <h3 className="font-bold">Commit history</h3>
        </label>
      </div>
      <div>
        <CommitDistFragment commitCutoff={ commitCutoff } show={ true } items={ commits } />
      </div>
    </>
  )
}

function sortCommits(items: GitLogEntry[], method: SortCommitsMethods): { [ key: string ]: GitLogEntry[] } {
  const cleanGroupItems: { [ key: string ]: GitLogEntry[] } = {}
  switch (method) {
    case "author":
      items.map((commit) => {
        const author: string = commit.author
        if (!cleanGroupItems[ author ]) {
          cleanGroupItems[ author ] = []
        }
        cleanGroupItems[ author ].push(commit)
        return commit
      })
      break
    case "date":
    default:
      items.map((commit) => {
        const date: string = dateFormatLong(commit.time)
        if (!cleanGroupItems[ date ]) {
          cleanGroupItems[ date ] = []
        }
        cleanGroupItems[ date ].push(commit)
        return commit
      })
  }
  return cleanGroupItems
}

function calculateCommitsForSubTree(tree: HydratedGitTreeObject) {
  const commitSet = new Set<string>()
  subTree(tree)
  function subTree(tree: HydratedGitTreeObject) {
    for (const child of tree.children) {
      if (!child) continue
      if (child.type === "blob") {
        if (!child.commits) continue
        for (const commit of child.commits) {
          commitSet.add(commit)
        }
      } else if (child.type === "tree") {
        subTree(child)
      }
    }
  }
  return commitSet
}
