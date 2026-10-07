'use client'

import { useOnboarding } from '../onboarding'

/** Your own nameplate, live while you fill in your profile — "this is how people will see you". */
export function DraftPlate() {
  const d = useOnboarding((s) => s.draft)
  const step = useOnboarding((s) => s.step)
  if (step === 0) return null
  return (
    <div className="np np--draft" data-lod="near">
      {d.openToWork && (
        <div className="np-open">
          <span className="np-dot" /> OPEN TO WORK
        </div>
      )}
      <div className="np-name">{d.name.trim().toUpperCase() || 'YOUR NAME'}</div>
      <div className="np-role">
        {d.role.trim() || 'Your role'}
        {d.company.trim() ? ` · ${d.company.trim()}` : ''}
      </div>
      <div className="np-caret" />
    </div>
  )
}
