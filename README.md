# Git Truck 🚛

_Visualizing a Git repository_

Get an overview over your git repo. See your folder-structure, which users have contributed most to which files, and more.

## [Prerequisites](#prerequisites)

This projected is tested to work with:

- Node.js 16.13
- npm 6.14
- git 2.35

## [Usage](#usage)

Run `npx git-truck` in the root of a git repository, that you want to visualize:

```sh
npx git-truck [--path <path>] [--branch <name>] [--out <path>] [--log <path>]
```

#### [Arguments](#arguments)

|    arg     |   default value    |                               description                               |
| :--------: | :----------------: | :---------------------------------------------------------------------: |
|  `--path`  | current directory  |                         path to git repository                          |
| `--branch` | checked out branch |                               branch name                               |
|  `--out`   |    ./data.json     |                        output path for data file                        |
|  `--log`   |        null        | output log level. See [here](./app/parser/src/log.server.ts) for values |
|  `--help`  |        N/A         |                        output usage information                         |

### [Configuration](#configuration)

You can add a `truckconfig.json` file to the root of your project, where you can define the arguments you want.
Additionally you can define which git-aliases should be considered as the same person.
You can also define files to ignore.
Example:

```json
{
  "log": "debug",
  "branch": "main",
  "unionedAuthors": [
    ["Bob", "Bobby Bob"],
    ["Alice", "aliiii", "alice alice"]
  ],
  "hiddenFiles": ["package-lock.json", "*.bin", "*.svg"]
}
```

## [Development](#development)

1. Install dependencies with `npm install`
2. Run git-truck in development mode with:

```sh
npm run dev
```

_or using yarn:_ `yarn dev`

This starts the app in development mode, rebuilding assets on file changes.

**Note:**
The remix development server does not watch `server.ts` for changes, so if you are testing

**Note:**
If you want to provide args to the parser, you need to run remix and node separately in two different terminals:

```
npm run dev:remix
```

and

```
npm run dev:node -- <args>
```

For arguments, see [Arguments](#arguments).

### [Husky](#husky)

To enable husky, run `npx husky install`.

## [Clean up](#clean-up)

To clean up build artefacts, cached analyzations, etc., run:

```
npm run clean
```
