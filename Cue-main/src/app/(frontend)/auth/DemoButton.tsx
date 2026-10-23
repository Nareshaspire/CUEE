"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { startDemoWorkspace } from "@/lib/backend-client"

export default function DemoButton() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function openDemo() {
    setError("")
    startTransition(async () => {
      try {
        await startDemoWorkspace()
        router.push("/app")
        router.refresh()
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not open the demo workspace.",
        )
      }
    })
  }

  return (
    <>
      <button
        className="button button--light"
        type="button"
        disabled={pending}
        onClick={openDemo}
      >
        {pending ? "Preparing your workspace…" : "Try Baker Demo"}
      </button>
      {error && <small role="alert">{error}</small>}
    </>
  )
}
