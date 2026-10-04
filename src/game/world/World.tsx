'use client'

import { FILLERS } from '../layout'
import { KORA_PORTAL } from '../districts/koramangala'
import { Portal } from './Portal'
import { Apartment } from './Apartment'
import { Background } from './Background'
import { Building } from './Building'
import { BusStop } from './BusStop'
import { Darshini } from './Darshini'
import { Ground, Kerbs } from './Ground'
import { Park } from './Park'
import { StreetLife } from './Props'
import { ShopRow } from './ShopRow'
import { StartupHouse } from './StartupHouse'
import { StaticMerge } from './StaticMerge'
import { StreetPoles } from './StreetPoles'
import { StreetTrees } from './Trees'

export function World() {
  return (
    <>
      <StaticMerge>
        <Ground />
        <Darshini />
        <ShopRow />
        <Apartment />
        <StartupHouse />
        <Park />
        <BusStop />
        {FILLERS.map((b) => (
          <Building key={b.seed} {...b} />
        ))}
        <StreetPoles />
        <StreetTrees />
        <StreetLife />
        <Background />
      </StaticMerge>
      <Kerbs />
      <Portal pose={KORA_PORTAL} />
    </>
  )
}
