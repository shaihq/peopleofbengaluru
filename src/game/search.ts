import { getCharacter } from './characters/roster'
import { LANDMARKS } from './layout'
import { PEOPLE, type Profile } from './people/profiles'

// "Find a person in the city" — not "search a database" (CLAUDE.md Phase 5).

export type Category = 'all' | 'open' | 'design' | 'engineering' | 'product' | 'investors'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'EVERYONE' },
  { id: 'open', label: 'OPEN TO WORK' },
  { id: 'design', label: 'DESIGN' },
  { id: 'engineering', label: 'ENGINEERING' },
  { id: 'product', label: 'FOUNDERS & PRODUCT' },
  { id: 'investors', label: 'INVESTORS' },
]

const IN: Record<Exclude<Category, 'all' | 'open'>, RegExp> = {
  design: /design|brand|motion|interaction|creative|ux|research/i,
  engineering: /engineer|technolog|developer|hacker|code/i,
  product: /founder|product|head of/i,
  investors: /partner|investor|venture|vc/i,
}

export function inCategory(p: Profile, c: Category) {
  if (c === 'all') return true
  if (c === 'open') return p.openToWork
  return IN[c].test(p.role)
}

/** Where someone is right now, as the city knows it. */
export function whereIs(x: number, z: number) {
  return LANDMARKS.find((l) => Math.hypot(l.x - x, l.z - z) < l.r)?.label ?? '5TH BLOCK'
}

export type Result = { p: Profile; score: number }

export function searchPeople(query: string, cat: Category, live: (id: string) => { x: number; z: number } | undefined): Result[] {
  let q = query.toLowerCase().trim()
  let wantOpen = cat === 'open'
  if (/open to work|looking for work|available/.test(q)) {
    wantOpen = true
    q = q.replace(/open to work|looking for work|available/g, ' ')
  }
  const tokens = q.split(/[\s,]+/).filter((t) => t.length > 1)

  const out: Result[] = []
  for (const p of PEOPLE) {
    if (!inCategory(p, cat) || (wantOpen && !p.openToWork)) continue
    const pos = live(p.id)
    const fields: [string, number][] = [
      [p.name, 4],
      [p.role, 3],
      [p.company, 2.5],
      [p.skills.join(' '), 2],
      [p.building ?? '', 2],
      [p.location, 2],
      [p.previously ?? '', 1],
      [getCharacter(p.character).name, 1],
      [pos ? whereIs(pos.x, pos.z) : '', 1.5],
    ]
    let score = 0
    let matched = 0
    for (const t of tokens) {
      const stem = t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t
      let best = 0
      for (const [f, w] of fields) {
        const lf = f.toLowerCase()
        if (lf.includes(stem)) best = Math.max(best, w * (lf.split(/[\s·—-]+/).some((word) => word.startsWith(stem)) ? 1.2 : 1))
      }
      if (best > 0) matched++
      score += best
    }
    if (tokens.length && matched < tokens.length) continue
    out.push({ p, score: score + (p.openToWork ? 0.1 : 0) })
  }
  return out.sort((a, b) => b.score - a.score)
}
