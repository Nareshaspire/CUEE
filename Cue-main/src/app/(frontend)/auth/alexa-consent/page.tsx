"use client"

import Link from "next/link"
import { useState } from "react"
import { authorizeAlexaLink } from "@/lib/backend-client"

const requiredParameters = [
  "client_id",
  "redirect_uri",
  "response_type",
  "state",
  "code_challenge",
  "code_challenge_method",
]

export default function AlexaConsentPage() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function approve() {
    setError("")
    setPending(true)
    try {
      const search = new URLSearchParams(window.location.search)
      const params = Object.fromEntries(
        requiredParameters.map((key) => [key, search.get(key) ?? ""]),
      )
      const result = await authorizeAlexaLink(params)
      window.location.assign(result.redirect)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not link the Alexa skill.",
      )
      setPending(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Alexa account linking</p>
        <h1>Link CUE to Alexa?</h1>
        <p>
          Allow the CUE production skill to read your production runs and submit
          workflow updates only after you confirm them.
        </p>
        <p>
          Alexa creates customer update drafts only; it does not send messages
          or verify physical kitchen conditions.
        </p>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--primary"
          type="button"
          disabled={pending}
          onClick={() => void approve()}
        >
          {pending ? "Linking…" : "Allow and link"}
        </button>
        <Link className="button button--secondary" href="/app/">
          Cancel
        </Link>
      </section>
    </main>
  )
}
