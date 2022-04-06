import { PointInfo } from "../metrics"
import { Spacer } from "./Spacer"
import { LegendEntry, LegendDot, LegendLabel } from "./util"

interface LegendFragProps {
  items: [string, PointInfo][]
  show: boolean
}

export function LegendFragment(props: LegendFragProps) {
  if (!props.show) return null
  return (
    <>
      {props.items.map((legendItem) => {
        const [label, info] = legendItem
        return (
          <div key={label}>
            <LegendEntry>
              <LegendDot dotColor={info.color} />
              <Spacer horizontal />
              <LegendLabel>{label}</LegendLabel>
            </LegendEntry>
            <Spacer />
          </div>
        )
      })}
    </>
  )
}
