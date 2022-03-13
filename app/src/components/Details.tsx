import { Spacer } from "./Spacer"
import { makePercentResponsibilityDistribution } from "./Chart"
import { Box, BoxTitle, CloseButton } from "./util"
import { useOptions } from "../contexts/OptionsContext"
import { HydratedGitBlobObject } from "../../../parser/src/model"
import { dateFormatLong } from "../util"
import styled from "styled-components"
import { Fragment } from "react"

const DetailsHeading = styled.h3`
  font-size: calc(var(--unit) * 2);
  padding-top: calc(var(--unit));
  padding-bottom: calc(var(--unit) * 0.5);
  font-size: 1.1em;
`

const DetailsEntries = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 calc(var(--unit) * 3);
`

const StyledDetailsEntries = styled(DetailsEntries)`
  gap: var(--unit) calc(var(--unit) * 3);
  & > p {
    text-align: left;
  }
`

const DetailsKey = styled.span<{ grow?: boolean }>`
  white-space: pre;
  font-size: 0.9em;
  font-weight: 500;
  opacity: 0.7;
`

const DetailsValue = styled.p`
  overflow-wrap: anywhere;
  font-size: 0.9em;
  text-align: right;
`

function hasZeroContributions(authors: Record<string, number>) {
  const authorsList = Object.entries(authors)
  for (const [, contribution] of authorsList) {
    if (contribution > 0) return false
  }
  return true
}

export function Details() {
  const { setClickedBlob, clickedBlob } = useOptions()
  if (clickedBlob === null) return null
  return (
    <Box>
      <CloseButton
        onClick={() => {
          setClickedBlob(null)
        }}
      >
        &times;
      </CloseButton>
      <Spacer xl />
      <BoxTitle title={clickedBlob.name}>{clickedBlob.name}</BoxTitle>
      <Spacer xl />
      <StyledDetailsEntries>
        <LineCountEntry
          lineCount={clickedBlob.noLines}
          isBinary={clickedBlob.isBinary}
        />
        <CommitsEntry clickedBlob={clickedBlob} />
        <LastchangedEntry clickedBlob={clickedBlob} />
        <PathEntry path={clickedBlob.path} />
      </StyledDetailsEntries>
      <Spacer xl />
      {clickedBlob.isBinary ||
      hasZeroContributions(clickedBlob.authors) ? null : (
        <AuthorDistribution currentClickedBlob={clickedBlob} />
      )}
    </Box>
  )
}

function CommitsEntry(props: { clickedBlob: HydratedGitBlobObject }) {
  return (
    <>
      <DetailsKey grow>Commits</DetailsKey>
      <DetailsValue>
        {props.clickedBlob.noCommits > 0 ? props.clickedBlob.noCommits : 0}
      </DetailsValue>
    </>
  )
}

function LastchangedEntry(props: { clickedBlob: HydratedGitBlobObject }) {
  return (
    <>
      <DetailsKey grow>Last changed</DetailsKey>
      <DetailsValue>
        {dateFormatLong(props.clickedBlob.lastChangeEpoch)}
      </DetailsValue>
    </>
  )
}

function PathEntry(props: { path: string }) {
  return (
    <>
      <DetailsKey>Located at</DetailsKey>
      <DetailsValue title={props.path}>{props.path}</DetailsValue>
    </>
  )
}

const StyledSpan = styled.span`
  opacity: 0.5;
`

function LineCountEntry(props: { lineCount: number; isBinary?: boolean }) {
  return (
    <>
      <DetailsKey grow>Line count</DetailsKey>
      <DetailsValue>
        {props.lineCount ?? 0}{" "}
        <StyledSpan>{props.isBinary ? "(binary file)" : null}</StyledSpan>
      </DetailsValue>
    </>
  )
}

function AuthorDistribution(props: {
  currentClickedBlob: HydratedGitBlobObject
}) {
  return (
    <>
      <DetailsHeading>Author distribution</DetailsHeading>
      <Spacer xs />
      <DetailsEntries>
        {Object.entries(
          makePercentResponsibilityDistribution(props.currentClickedBlob)
        )
          .sort((a, b) => (a[1] < b[1] ? 1 : -1))
          .map(([author, contrib]) => {
            const roundedContrib = Math.round(contrib * 100)
            return (
              <Fragment key={author + contrib}>
                <DetailsKey grow>{author}</DetailsKey>
                <DetailsValue>
                  {roundedContrib === 0 ? "<1" : roundedContrib}%
                </DetailsValue>
              </Fragment>
            )
          })}
      </DetailsEntries>
    </>
  )
}
