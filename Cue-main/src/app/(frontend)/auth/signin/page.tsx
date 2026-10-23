"use client"
import Link from "next/link"
import AuthForm from "../AuthForm"
import DemoButton from "../DemoButton"

export default function SignInPage() {
  return (
    <main className="auth-page auth-page--focused">
      <Link className="auth-brand" href="/" aria-label="Back to CUE home">
        <img src="/cue/logo.png" alt="CUE" />
      </Link>
      <section className="auth-focus-shell">
        <Link className="auth-back" href="/">
          ← Back
        </Link>
        <div className="auth-card auth-card--focus">
          <p className="card-kicker">Welcome back</p>
          <h1>Sign in to CUE</h1>
          <p>
            Sign in to your CUE account, or open an isolated sample workspace.
          </p>
          <AuthForm mode="signin" />
          <p className="auth-switch">
            New to CUE? <Link href="/auth/signup">Create a free account</Link>
          </p>
        </div>
        <div className="auth-demo auth-demo--focus">
          <div>
            <p className="card-kicker">Baker Demo Account</p>
            <h2>Explore a safe sample workspace</h2>
            <p>
              Open isolated fictional runs to test CUE’s board, waiting stages,
              inspections, and confirmations.
            </p>
          </div>
          <DemoButton />
        </div>
      </section>
    </main>
  )
}
