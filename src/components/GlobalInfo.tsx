import { Form, Link, useLocation, useNavigate, useNavigation } from "@remix-run/react"
import { dateTimeFormatShort, semverCompare } from "~/util"
import { useData } from "../contexts/DataContext"
import { memo, useEffect, useState } from "react"
import { RevisionSelect } from "./RevisionSelect"
import { mdiRefresh, mdiArrowTopLeft, mdiInformation, mdiArrowUpBoldCircleOutline } from "@mdi/js"
import { CloseButton, Code } from "./util"
import { Icon } from "@mdi/react"
import { useClient } from "~/hooks"
import clsx from "clsx"
import { ArrowContainer, Popover } from "react-tiny-popover"

const title = "Git Truck"
const analyzingTitle = "Analyzing | Git Truck"

const UpdateNotifier = memo(function UpdateNotifier() {
  const { gitTruckInfo } = useData()
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  return (
    <Popover
    isOpen={isPopoverOpen}
      positions={["right", "bottom", "left", "top"]} // preferred positions by priority
      content={({ position, childRect, popoverRect }) => (
        <ArrowContainer
          position={position}
          childRect={childRect}
          popoverRect={popoverRect}
          arrowSize={10}
          arrowColor="white"
        >
          <div className="card max-w-lg bg-gray-100/50 pr-10 backdrop-blur dark:bg-gray-800/40">
            <p>Update available: {gitTruckInfo.latestVersion}</p>
            <p className="card-p">Currently installed: {gitTruckInfo.version}</p>
            <p className="card-p">
              To update, close application and run: <Code inline>npx git-truck@latest</Code>
            </p>
          </div>
        </ArrowContainer>
      )}
      onClickOutside={() => setIsPopoverOpen(false)}>

      <button title="Update available" className="btn bg-yellow-500" onClick={() => setIsPopoverOpen(!isPopoverOpen)}>
          <Icon path={mdiArrowUpBoldCircleOutline} size="1.25em" />
      </button>
    </Popover>
  )
})

export const GlobalInfo = memo(function GlobalInfo() {
  const client = useClient()
  const { repodata2, repo, gitTruckInfo } = useData()
  const transitionState = useNavigation()

  const location = useLocation()
  const navigate = useNavigate()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisDetailsVisible, setAnalysisDetailsVisible] = useState(false)

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
  const isoString = new Date(repodata2.lastRunInfo.time).toISOString()
  const updateAvailable = gitTruckInfo.latestVersion && semverCompare(gitTruckInfo.latestVersion, gitTruckInfo.version) === 1
  return (
    <div className="flex flex-col gap-2">
      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex items-center">
            <button
              className="btn--icon btn--primary"
              title="See analysis details"
              onClick={() => setAnalysisDetailsVisible(true)}
            >
              <Icon path={mdiInformation} size="1.5em" />
            </button>
            <div
              className={clsx("card absolute left-0 top-0 z-10 h-max w-max shadow transition-opacity", {
                "hidden opacity-0": !analysisDetailsVisible
              })}
            >
              <h2 className="card__title">Analysis details</h2>
              <CloseButton onClick={() => setAnalysisDetailsVisible(false)} />
              <div className="grid auto-rows-fr grid-cols-2 gap-0">
                <span>Analyzed</span>
                <time className="text-right" dateTime={isoString} title={isoString}>
                  {client ? dateTimeFormatShort(repodata2.lastRunInfo.time * 1000) : ""}
                </time>

                <span>As of commit</span>
                <span className="text-right">
                  <Code inline>#{repodata2.lastRunInfo.hash.slice(0, 7)}</Code>
                </span>

                <span>Files analyzed</span>
                <span className="text-right">{repodata2.fileCount ?? 0}</span>

                <span>Commits analyzed</span>
                <span className="text-right">{repodata2.commitCount}</span>
              </div>
            </div>
          </div>
          <h2 className="card__title grow justify-start gap-2" title={repo.name}>
            {repo.name}
          </h2>
        </div>
        <div className="flex w-full auto-cols-max place-items-stretch gap-2">
          <Link className="btn btn--primary grow" to=".." title="See all repositories">
            <Icon path={mdiArrowTopLeft} size={0.75} />
            <p>See more repositories</p>
          </Link>
          <Form
            method="post"
            action={location.pathname}
            onSubmit={() => {
              setIsAnalyzing(true)
            }}
          >
            <input type="hidden" name="refresh" value="true" />
            <button className="btn" disabled={transitionState.state !== "idle"}>
              <Icon path={mdiRefresh} size="1.25em" />
              {isAnalyzing ? "Analyzing..." : "Refresh"}
            </button>
          </Form>
          { updateAvailable ?
            <UpdateNotifier />
            : null
          }
        </div>
        <RevisionSelect
          key={repodata2.branch}
          disabled={isAnalyzing}
          onChange={(e) => switchBranch(e.target.value)}
          defaultValue={repodata2.branch}
          headGroups={repo.refs}
          analyzedBranches={repodata2.analyzedRepos.filter((rep) => rep.repo === repodata2.repo)}
        />
      </div>
    </div>
  )
})
