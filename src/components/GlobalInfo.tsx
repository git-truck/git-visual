import { Form, Link, useLocation, useNavigate, useNavigation } from "@remix-run/react"
import { dateTimeFormatShort } from "~/util"
import { useData } from "../contexts/DataContext"
import { useEffect, useState } from "react"
import { RevisionSelect } from "./RevisionSelect"
import { Refresh as RefreshIcon, Folder as FolderIcon } from "@styled-icons/material"

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

  return (
    <div className="box flex flex-col gap-2">
      <div className="grid w-full grid-cols-[auto_1fr] place-items-center gap-2">
        <Link
          className="flex items-center gap-2 text-gray-400 hover:text-gray-600"
          to=".."
          title="See all repositories"
        >
          <FolderIcon display="inline-block" height="1rem" />
          <p>See more repositories</p>
        </Link>
      </div>
      <h2 className="box__title">{repo.name}</h2>
      <RevisionSelect
        key={repo.currentHead}
        disabled={isAnalyzing}
        onChange={(e) => switchBranch(e.target.value)}
        defaultValue={analyzerData.branch}
        headGroups={repo.refs}
        analyzedHeads={repo.analyzedHeads}
      />
      <div>
        <strong>Analyzed: </strong>
        <span>{dateTimeFormatShort(analyzerData.lastRunEpoch)}</span>
      </div>
      <div>
        <strong>As of commit: </strong>
        <span title={analyzerData.commit.message ?? "No commit message"}>{analyzerData.commit.hash.slice(0, 7)}</span>
      </div>
      <div>
        <strong>Files analyzed: </strong>
        <span>{analyzerData.commit.fileCount ?? 0}</span>
      </div>
      <Form
        method="post"
        action={location.pathname}
        onSubmit={() => {
          setIsAnalyzing(true)
        }}
      >
        <input type="hidden" name="refresh" value="true" />
        <button className="btn" disabled={transitionState.state !== "idle"}>
          <RefreshIcon display="inline-block" height="1rem" />
          {isAnalyzing ? "Analyzing..." : "Reanalyze"}
        </button>
      </Form>
    </div>
  )
}
