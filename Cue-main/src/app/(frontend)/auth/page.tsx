"use client"
import { useEffect } from "react"
export default function AuthPage() {
  useEffect(() => {
    window.location.replace("/auth/signin")
  }, [])
  return (
    <main className="auth-page">
      <p>Opening sign in…</p>
    </main>
  )
}
