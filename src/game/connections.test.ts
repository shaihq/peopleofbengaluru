import { describe, expect, it } from 'vitest'
import { apply, groups, landingTab, messageToast, unseenCount, whatsNew, type Conn } from './connections'

const conn = (id: string, over: Partial<Conn> = {}): Conn => ({
  id,
  dir: 'out',
  intent: 'coffee',
  note: null,
  state: 'matched',
  created_at: '2026-10-01T10:00:00Z',
  decided_at: '2026-10-01T11:00:00Z',
  seen: true,
  other: { id: `u-${id}`, name: 'Nandini Rao', role: 'Product Designer', character: 'designer', location: 'Koramangala' },
  last_message_at: null,
  unread: 0,
  last: null,
  ...over,
})

describe('apply', () => {
  it('keeps the chat on screen read when a fresh list arrives', () => {
    const items = apply([], { type: 'fetched', items: [conn('a', { unread: 3 }), conn('b', { unread: 2 })], viewing: 'a' })
    expect(items.map((c) => c.unread)).toEqual([0, 2])
  })

  it('counts their message as unread unless that chat is on screen', () => {
    const msg = { type: 'message', connId: 'a', body: 'Thursday 5pm?', at: '2026-10-02T09:00:00Z', mine: false } as const
    expect(apply([conn('a', { unread: 1 })], { ...msg, viewing: false })[0]).toMatchObject({
      unread: 2,
      last_message_at: msg.at,
      last: { body: 'Thursday 5pm?', mine: false, at: msg.at },
    })
    expect(apply([conn('a', { unread: 1 })], { ...msg, viewing: true })[0].unread).toBe(0)
  })

  it('your own message never counts as unread', () => {
    const [c] = apply([conn('a', { unread: 2 })], { type: 'message', connId: 'a', body: 'hi', at: 'x', mine: true, viewing: false })
    expect(c.unread).toBe(0)
    expect(c.last?.mine).toBe(true)
  })

  it('keeps only the first 120 characters as the last line', () => {
    const [c] = apply([conn('a')], { type: 'message', connId: 'a', body: 'x'.repeat(300), at: 'x', mine: false, viewing: false })
    expect(c.last?.body).toHaveLength(120)
  })

  it('reading a chat clears only that chat', () => {
    const items = apply([conn('a', { unread: 2 }), conn('b', { unread: 1 })], { type: 'read', connId: 'a' })
    expect(items.map((c) => c.unread)).toEqual([0, 1])
  })
})

describe('whatsNew', () => {
  it('a new match beats everything else', () => {
    const t = whatsNew([conn('a', { state: 'pending' })], [conn('a', { seen: false }), conn('b', { dir: 'in', state: 'pending', seen: false })], false)
    expect(t).toEqual({ msg: 'IT’S A MATCH · NANDINI RAO WANTS TO GRAB COFFEE TOO · PRESS C', tone: 'good' })
  })

  it('a new request, then several', () => {
    const ask = (id: string) => conn(id, { dir: 'in', state: 'pending', seen: false })
    expect(whatsNew([], [ask('a')], true)?.msg).toBe('☕ NANDINI RAO WANTS TO GRAB COFFEE · PRESS C')
    expect(whatsNew([], [ask('a'), ask('b')], true)?.msg).toBe('2 NEW CONNECT REQUESTS · PRESS C')
  })

  it('nothing for what was already there', () => {
    const ask = conn('a', { dir: 'in', state: 'pending', seen: false })
    expect(whatsNew([ask], [ask], false)).toBeNull()
  })

  it('new messages toast from the fetch only while the live channel is down', () => {
    const prev = [conn('a', { unread: 0 })]
    const next = [conn('a', { unread: 2 })]
    expect(whatsNew(prev, next, true)).toBeNull()
    expect(whatsNew(prev, next, false)).toEqual({ msg: '💬 NANDINI RAO · NEW MESSAGE · PRESS C', tone: 'info' })
  })

  it('a chat that only just appeared is a match, not a message', () => {
    expect(whatsNew([], [conn('a', { unread: 1 })], false)).toBeNull()
  })
})

describe('grouping and landing', () => {
  const ask = conn('ask', { dir: 'in', state: 'pending' })
  const sent = conn('sent', { dir: 'out', state: 'pending' })
  const chat = conn('chat')

  it('groups requests, chats and sent', () => {
    const g = groups([ask, sent, chat])
    expect([g.requests, g.matches, g.sent].map((l) => l.map((c) => c.id))).toEqual([['ask'], ['chat'], ['sent']])
  })

  it('lands on the chats that need you, then requests, then any chats', () => {
    expect(landingTab([ask, conn('c', { unread: 1 })])).toBe('matches')
    expect(landingTab([ask, chat])).toBe('requests')
    expect(landingTab([chat, sent])).toBe('matches')
    expect(landingTab([sent])).toBe('requests')
  })

  it('the badge counts requests, unopened matches and unread chats', () => {
    expect(unseenCount([ask, sent, chat, conn('new', { seen: false }), conn('unread', { unread: 4 })])).toBe(3)
  })
})

describe('messageToast', () => {
  it('first name and a short line', () => {
    expect(messageToast(conn('a'), 'x'.repeat(60)).msg).toBe(`💬 NANDINI: ${'x'.repeat(46)}…`)
  })
})
