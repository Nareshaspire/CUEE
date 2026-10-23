"use client"

import { useState } from "react"

export function PasswordField({
  autoComplete,
  label = "Password",
}: {
  autoComplete: "current-password" | "new-password"
  label?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <label>
      {label}
      <span className="password-control">
        <input
          name="password"
          type={visible ? "text" : "password"}
          minLength={autoComplete === "new-password" ? 12 : undefined}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  )
}
