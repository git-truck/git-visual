import { ActionFunction, json, Link, LoaderFunction, useLoaderData, useNavigate, useSubmit, useTransition } from "remix"
import styled from "styled-components"
import { getArgsWithDefaults } from "~/analyzer/args.server"
import { getBaseDirFromPath, getDirName } from "~/analyzer/util.server"
import { Spacer } from "~/components/Spacer"
import { Box, BoxSubTitle, Code, Grower, TextButton } from "~/components/util"
import { AnalyzingIndicator } from "~/components/AnalyzingIndicator"
import { resolve } from "path"
import { Repository } from "~/analyzer/model"
import { GitCaller } from "~/analyzer/git-caller.server"
import { useMount } from "react-use"

interface IndexData {
  repositories: Repository[]
  baseDir: string
  baseDirName: string
  repo: Repository | null
  hasRedirected: boolean
}

let hasRedirected = false

export const loader: LoaderFunction = async () => {
  const args = await getArgsWithDefaults()
  const [repo, repositories] = await GitCaller.scanDirectoryForRepositories(args.path)
  const baseDir = resolve(repo ? getBaseDirFromPath(args.path) : args.path)
  const repositoriesResponse = json<IndexData>({
    repositories,
    baseDir,
    baseDirName: getDirName(baseDir),
    repo,
    hasRedirected,
  })

  const response = repositoriesResponse
  hasRedirected = true

  return response
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  if (formData.has("hasRedirected")) {
    hasRedirected = true
  }
  return null
}

export default function Index() {
  const loaderData = useLoaderData<IndexData>()
  const { repositories, baseDir, baseDirName, repo, hasRedirected } = loaderData
  const transitionData = useTransition()
  const navigate = useNavigate()
  const submit = useSubmit()

  const willRedirect = repo && !hasRedirected
  useMount(() => {
    if (willRedirect) {
      const data = new FormData()
      data.append("hasRedirected", "true")
      submit(data, { method: "post" })
      navigate(`/${repo.name}`)
    }
  })

  const cachedRepositories = repositories.filter((repo) => repo.data?.cached)
  const notCachedRepositories = repositories.filter((repo) => !repo.data?.cached)

  if (transitionData.state !== "idle" || willRedirect) return <AnalyzingIndicator />
  return (
    <Wrapper>
      <Spacer />
      <H1>{baseDir}</H1>
      <Spacer />
      <p>
        Found {repositories.length} git repositories in the folder <Code inline>{baseDirName}</Code>.
      </p>
      {repositories.length === 0 ? (
        <>
          <Spacer />
          <p>
            Try running <Code inline>git-truck</Code> in another folder or provide another path as argument.
          </p>
        </>
      ) : null}
      {cachedRepositories.length > 0 ? (
        <>
          <Spacer xxl />
          <h2>Ready to view</h2>
          <nav>
            <Ul>
              {cachedRepositories.map((repo) => (
                <Li key={repo.name}>
                  <SLink to={repo.name} tabIndex={-1}>
                    <Box>
                      <BoxSubTitle title={repo.name}>{repo.name}</BoxSubTitle>
                      <Spacer />
                      <Actions>
                        <Grower />
                        <TextButton>{repo.data?.cached ? "View" : "Analyze"}</TextButton>
                      </Actions>
                    </Box>
                  </SLink>
                </Li>
              ))}
            </Ul>
          </nav>
        </>
      ) : null}
      {notCachedRepositories.length > 0 ? (
        <>
          <Spacer xxl />
          <h2>Needs to be analyzed before viewing</h2>
          <nav>
            <Ul>
              {notCachedRepositories.map((repo) => (
                <Li key={repo.name}>
                  <SLink to={repo.name} tabIndex={-1}>
                    <Box>
                      <BoxSubTitle title={repo.name}>{repo.name}</BoxSubTitle>
                      <Spacer />
                      <Actions>
                        <Grower />
                        <TextButton>{repo.data?.cached ? "View" : "Analyze"}</TextButton>
                      </Actions>
                    </Box>
                  </SLink>
                </Li>
              ))}
            </Ul>
          </nav>
        </>
      ) : null}
    </Wrapper>
  )
}

const Wrapper = styled.div`
  width: calc(100vw - 2 * var(--side-panel-width));
  margin: auto;
`
const H1 = styled.h1`
  font-family: "Courier New", Courier, monospace;
`

const Ul = styled.ul`
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`

const Li = styled.li`
  margin: 0;
`

const Actions = styled.div`
  display: flex;
`

const SLink = styled(Link)`
  text-decoration: none;
`
