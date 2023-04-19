import type { SerializeFrom } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Link, useLoaderData, useTransition } from "@remix-run/react"
import styled, { css } from "styled-components"
import { getArgsWithDefaults } from "~/analyzer/args.server"
import { getBaseDirFromPath, getDirName } from "~/analyzer/util.server"
import { Code } from "~/components/util"
import { AnalyzingIndicator } from "~/components/AnalyzingIndicator"
import { resolve } from "path"
import type { Repository } from "~/analyzer/model"
import { GitCaller } from "~/analyzer/git-caller.server"
import { getPathFromRepoAndHead } from "~/util"
import { useState } from "react"
import { RevisionSelect } from "~/components/RevisionSelect"

interface IndexData {
  repositories: Repository[]
  baseDir: string
  baseDirName: string
  repo: Repository | null
}

export const loader = async () => {
  const args = await getArgsWithDefaults()
  const [repo, repositories] = await GitCaller.scanDirectoryForRepositories(args.path)

  const baseDir = resolve(repo ? getBaseDirFromPath(args.path) : args.path)
  const repositoriesResponse = json<IndexData>({
    repositories,
    baseDir,
    baseDirName: getDirName(baseDir),
    repo,
  })

  const response = repositoriesResponse

  return response
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>()
  const { repositories, baseDir, baseDirName } = loaderData
  const transitionData = useTransition()

  if (transitionData.state !== "idle") return <AnalyzingIndicator />
  return (
    <Wrapper>
      <h1 className="text-4xl">🚛 Git Truck</h1>

      <p>
        Found {repositories.length} git repositor{repositories.length === 1 ? "y" : "ies"} in the folder{" "}
        <Code inline title={baseDir}>
          {baseDirName}
        </Code>
        .
      </p>
      {repositories.length === 0 ? (
        <>
          <p>
            Try running <Code inline>git-truck</Code> in another folder or provide another path as argument.
          </p>
        </>
      ) : (
        <>
          <nav>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(225px,1fr))] gap-2">
              {repositories.map((repo) => (
                <RepositoryEntry key={repo.path} repo={repo} />
              ))}
            </ul>
          </nav>
        </>
      )}
    </Wrapper>
  )
}

function RepositoryEntry({ repo }: { repo: SerializeFrom<Repository> }): JSX.Element {
  const [head, setHead] = useState(repo.currentHead)
  const path = getPathFromRepoAndHead(repo.name, head)

  const branchIsAnalyzed = repo.analyzedHeads[head]
  const iconColor = branchIsAnalyzed ? "green" : undefined

  return (
    <Li key={repo.name}>
      <div
        className="box"
        style={{
          outline: branchIsAnalyzed ? "1px solid green" : undefined,
        }}
      >
        <h3 className="box__subtitle" title={repo.name}>
          {repo.name}
          {branchIsAnalyzed ? <AnalyzedTag>Analyzed</AnalyzedTag> : null}
        </h3>
        <RevisionSelect
          value={head}
          onChange={(e) => setHead(e.target.value)}
          headGroups={repo.refs}
          iconColor={iconColor}
          analyzedHeads={repo.analyzedHeads}
        />
        <div className="flex justify-end">
          <SLink to={path}>{branchIsAnalyzed ? "View" : "Analyze"}</SLink>
        </div>
      </div>
    </Li>
  )
}

const Wrapper = styled.div`
  width: calc(100vw - 2 * var(--side-panel-width));
  margin: auto;
  padding: var(--unit);

  @media (max-width: 1000px) {
    width: 100vw;
  }
`

const Li = styled.li`
  margin: 0;
`

const SLink = styled(Link)<{ green?: boolean }>`
  line-height: 100%;
  text-decoration: none;
  font-weight: bold;
  font-size: 0.9em;
  color: ${(props) => (props.green ? " green" : css`var(--text-color)`)};
  opacity: 75%;
  cursor: pointer;
  &:hover {
    opacity: 100%;
  }
`

const AnalyzedTag = styled.span`
  text-transform: uppercase;
  font-weight: normal;
  font-size: 0.6rem;
  border: 1px solid currentColor;
  color: green;
  border-radius: 100000px;
  padding: 2px 4px;
  letter-spacing: 1px;
  user-select: none;
  font-weight: bold;
  display: flex;
  place-items: center;
  line-height: 100%;
  vertical-align: middle;
  align-content: flex-start;
`
