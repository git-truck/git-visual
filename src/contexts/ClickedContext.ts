import { createContext, Dispatch, SetStateAction, useContext } from "react"
import { GitObject } from "../analyzer/model"

export interface clickedObject {
  clickedObject: GitObject | null
  setClickedObject: Dispatch<SetStateAction<GitObject | null>>
}

export const ClickedObjectContext = createContext<clickedObject | null>(null)

export function useClickedObject() {
  const context = useContext(ClickedObjectContext)
  if (!context) {
    throw new Error("useClickedObject must be used within a ClickedObjectProvider")
  }
  return context
}
