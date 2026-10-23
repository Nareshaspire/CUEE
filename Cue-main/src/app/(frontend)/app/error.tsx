'use client'

import { useRouter } from 'next/navigation'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  return (
    <main className="error-page">
      <div>
        <span className="cue-avatar">C</span>
        <p className="eyebrow">CUE hit a snag</p>
        <h1>The production board could not load.</h1>
        <p>Your records were not changed. Try loading the latest state again or safely sign out.</p>
        <div>
          <button className="button button--primary" type="button" onClick={reset}>Try again</button>
          <button className="button button--secondary" type="button" onClick={() => router.push('/')}>Back home</button>
        </div>
      </div>
    </main>
  )
}
