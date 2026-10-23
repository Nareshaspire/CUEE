"use client"

import { useState, useTransition } from "react"
import { authenticateDemo } from "@/lib/backend-client"
import { PasswordField } from "./AuthControls"

function safeReturnTo(value: string | null) {
  if (!value?.startsWith("/")) return "/app/"
  try {
    const target = new URL(value, window.location.origin)
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/app/"
  } catch {
    return "/app/"
  }
}

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setError("")
    startTransition(async () => {
      const result = await authenticateDemo(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        mode === "signup" ? String(formData.get("name") ?? "") : undefined,
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.assign(
        safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")),
      )
    })
  }

  return (
    <>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <form action={submit}>
        {mode === "signup" && (
          <label>
            Name
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <PasswordField
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          label={mode === "signin" ? "Password" : "Password (12+ characters)"}
        />
        <button
          className="button button--primary"
          type="submit"
          disabled={pending}
        >
          {pending
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </>
  )
}
