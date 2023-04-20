import { Form, Link, useLocation, useNavigate, useNavigation } from "@remix-run/react"
import { dateTimeFormatShort } from "~/util"
import { useData } from "../contexts/DataContext"
import { useEffect, useState } from "react"
import { RevisionSelect } from "./RevisionSelect"
import { Refresh as RefreshIcon, Folder as FolderIcon } from "@styled-icons/material"
import { ArrowUpLeft } from "@styled-icons/octicons"
import { Code } from "./util"

const title = "Git Truck"
const analyzingTitle = "Analyzing | Git Truck"

export function GlobalInfo() {
  const { analyzerData, repo } = useData()
  const transitionState = useNavigation()

  const location = useLocation()
  const navigate = useNavigate()

  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    document.title = isAnalyzing ? analyzingTitle : title
  }, [isAnalyzing])

  const switchBranch = (branch: string) => {
    setIsAnalyzing(true)
    navigate(["", repo.name, branch].join("/"))
  }
  useEffect(() => {
    if (transitionState.state === "idle") {
      setIsAnalyzing(false)
    }
  }, [transitionState.state])

  const isoString = new Date(analyzerData.lastRunEpoch).toISOString()
  return (
    <div className="card flex flex-col gap-2">
      <div className="grid w-full gap-2">
        <Link className="btn btn--primary" to=".." title="See all repositories">
          <ArrowUpLeft />
          <p>See more repositories</p>
        </Link>
      </div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="card__title gap-2" title={repo.name}>
          <FolderIcon />
          {repo.name}
        </h2>
        <Form
          method="post"
          action={location.pathname}
          onSubmit={() => {
            setIsAnalyzing(true)
          }}
        >
          <input type="hidden" name="refresh" value="true" />
          <button className="btn" disabled={transitionState.state !== "idle"}>
            <RefreshIcon />
            {isAnalyzing ? "Analyzing..." : "Refresh"}
          </button>
        </Form>
      </div>
      <RevisionSelect
        key={repo.currentHead}
        disabled={isAnalyzing}
        onChange={(e) => switchBranch(e.target.value)}
        defaultValue={analyzerData.branch}
        headGroups={repo.refs}
        analyzedHeads={repo.analyzedHeads}
      />
      <div className="grid auto-rows-fr grid-cols-2">
        <strong>Analyzed </strong>
        <time className="text-right" dateTime={isoString} title={isoString}>
          {dateTimeFormatShort(analyzerData.lastRunEpoch)}
        </time>

        <strong>As of commit </strong>
        <span className="text-right" title={analyzerData.commit.message ?? "No commit message"}>
          <Code inline>#{analyzerData.commit.hash.slice(0, 7)}</Code>
        </span>

        <strong>Files analyzed </strong>
        <span className="text-right">{analyzerData.commit.fileCount ?? 0}</span>
      </div>
    </div>
  )
}
