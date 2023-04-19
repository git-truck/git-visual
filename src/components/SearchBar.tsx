import { memo, useEffect, useRef, useTransition } from "react"
import { useSearch } from "../contexts/SearchContext"
import { useId } from "react"
import type { HydratedGitObject, HydratedGitTreeObject } from "~/analyzer/model"
import { useData } from "~/contexts/DataContext"
import { usePath } from "~/contexts/PathContext"
import { useClickedObject } from "~/contexts/ClickedContext"
import { allExceptLast, getSeparator } from "~/util"
import { Folder as FolderIcon, TextSnippet as FileIcon } from "@styled-icons/material"

function findSearchResults(tree: HydratedGitTreeObject, searchString: string) {
  const searchResults: HydratedGitObject[] = []
  function subTreeSearch(subTree: HydratedGitTreeObject) {
    for (const child of subTree.children) {
      if (child.name.toLowerCase().includes(searchString.toLowerCase()) && searchString) {
        searchResults.push(child)
        child.isSearchResult = true
      } else {
        child.isSearchResult = false
      }
      if (child.type === "tree") subTreeSearch(child)
    }
  }
  subTreeSearch(tree)
  return searchResults
}

export default function SearchBar() {
  const searchFieldRef = useRef<HTMLInputElement>(null)
  const [isTransitioning, startTransition] = useTransition()
  const { setSearchText, searchText, searchResults, setSearchResults } = useSearch()
  const id = useId()
  const { analyzerData } = useData()

  useEffect(() => {
    const searchOverride = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "f") {
        event.preventDefault()
        searchFieldRef.current?.focus()
      }
    }
    document.body.addEventListener("keydown", searchOverride)
    return () => {
      document.body.removeEventListener("keydown", searchOverride)
    }
  }, [])

  return (
    <>
      <div className="box sticky top-0 z-10 flex flex-col gap-2">
        <input
          className="input"
          ref={searchFieldRef}
          id={id}
          type="search"
          placeholder="Search for a file or folder..."
          onChange={(event) => {
            const value = event.target.value
            startTransition(() => {
              setSearchText(value)
              setSearchResults(findSearchResults(analyzerData.commit.tree, value))
            })
          }}
        />
        {isTransitioning || searchText.length > 0 ? (
          <p className="box-p">
            {isTransitioning ? "Searching..." : searchText.length > 0 ? `${searchResults.length} results` : null}
          </p>
        ) : null}
      </div>
      {searchResults.length > 0 ? <SearchResults /> : null}
    </>
  )
}

const SearchResults = memo(function SearchResults() {
  const { setPath } = usePath()
  const { setClickedObject } = useClickedObject()
  const { searchResults } = useSearch()

  function onClick(object: HydratedGitObject) {
    setClickedObject(object)
    if (object.type === "tree") {
      setPath(object.path)
    } else {
      const sep = getSeparator(object.path)
      setPath(allExceptLast(object.path.split(sep)).join(sep))
    }
  }

  return (
    <div className="box relative gap-0">
      {searchResults.map((result) => (
        <button
          className="flex items-center justify-start gap-2 text-sm font-bold opacity-70 hover:opacity-100"
          key={result.path}
          title={result.path}
          value={result.path}
          onClick={() => onClick(result)}
        >
          {result.type === "tree" ? <FolderIcon height="1rem" /> : <FileIcon height="1rem" />}
          <span>{result.name}</span>
        </button>
      ))}
    </div>
  )
})
