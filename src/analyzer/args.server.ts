import yargsParser from "yargs-parser"
import { promises as fs } from "fs"
import { resolve } from "path"
import type { TruckConfig, TruckUserConfig } from "./model"
import { GitCaller } from "./git-caller.server"
import { getBaseDirFromPath } from "./util.server"
import { log } from "./log.server"

export function parseArgs(rawArgs: string[] = process.argv.slice(2)) {
  return yargsParser(rawArgs, {
    configuration: {
      "duplicate-arguments-array": false
    }
  })
}

export function getArgsWithDefaults(): TruckConfig {
  const args = parseArgs()
  const tempArgs = {
    path: ".",
    hiddenFiles: [] as string[],
    unionedAuthors: [] as string[][],
    invalidateCache: false,
    ...args
  }

  return tempArgs
}

export async function getArgs(): Promise<TruckConfig> {
  const args = getArgsWithDefaults()

  const pathIsRepo = await GitCaller.isGitRepo(args.path)
  args.path = pathIsRepo ? getBaseDirFromPath(args.path) : args.path

  return args
}
