// Why two people connect (CLAUDE.md Phase 5G). Shared by the game and the emails.

export type Intent = 'coffee' | 'work' | 'ideas' | 'build' | 'hangout'

export const INTENTS: { id: Intent; emoji: string; label: string; verb: string }[] = [
  { id: 'coffee', emoji: '☕', label: 'GRAB COFFEE', verb: 'grab coffee' },
  { id: 'work', emoji: '🤝', label: 'WORK TOGETHER', verb: 'work together' },
  { id: 'ideas', emoji: '🧠', label: 'EXCHANGE IDEAS', verb: 'exchange ideas' },
  { id: 'build', emoji: '🚀', label: 'BUILD SOMETHING', verb: 'build something' },
  { id: 'hangout', emoji: '🎉', label: 'HANG OUT', verb: 'hang out' },
]

export const intentOf = (id: string) => INTENTS.find((i) => i.id === id) ?? INTENTS[0]
