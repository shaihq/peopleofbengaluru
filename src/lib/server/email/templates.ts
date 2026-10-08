import 'server-only'

// Every email template the server sends, in one place (CLAUDE.md: EMAILS). The copy and design live in
// Resend (resend.com/templates), From and Subject included; each entry here is a template's alias and the variables it uses.
// Resend refuses an email when a variable the template uses is missing, so keep this list in step with
// the dashboard: rename a variable there, rename it here.
export const TEMPLATES = {
  /** "Ananya wants to grab coffee with you" → the person being asked. */
  connectRequest: { alias: 'connect-request', variables: ['EMOJI', 'SENDER', 'SENDER_FIRST', 'VERB', 'LINK'] },
  /** "It's a match" → the person who asked first. */
  connectMatch: { alias: 'connect-match', variables: ['EMOJI', 'SENDER', 'VERB', 'LINK'] },
  /** "You're in the city" → someone who just joined with an invite. */
  inviteWelcome: { alias: 'invite-welcome', variables: ['NAME', 'INVITER', 'INVITES', 'LINK'] },
  /** "Priya used your invite" → the member who vouched. */
  inviteJoined: { alias: 'invite-joined', variables: ['NAME', 'INVITEE', 'ROLE', 'LINK'] },
} as const

export type TemplateName = keyof typeof TEMPLATES
export type TemplateVariables<T extends TemplateName> = Record<(typeof TEMPLATES)[T]['variables'][number], string>
