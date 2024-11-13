import { LoaderFunctionArgs, redirect } from "@remix-run/node"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { invariant } from "ts-invariant"
import { getArgsWithDefaults } from "~/analyzer/args.server"
import { GitCaller } from "~/analyzer/git-caller.server"

/**
 * Redirect to the repository's default branch
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { repository } = params

  invariant(repository, "Repository is required")

  const args = getArgsWithDefaults()
  const repositoryPath = join(args.path, repository)

  invariant(existsSync(repositoryPath), `Repo ${repository} does not exist`)
  invariant(await GitCaller.isGitRepo(repositoryPath), `Repo ${repository} is not a git repo`)

  // Get checked out branch and redirect to it

  const currentHead = await GitCaller._getRepositoryHead(repositoryPath)

  return redirect(`/${repository}/${currentHead}`)
}
