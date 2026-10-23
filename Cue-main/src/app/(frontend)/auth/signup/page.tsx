"use client"
import Link from "next/link"
import AuthForm from "../AuthForm"

export default function SignUpPage() {
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
          <p className="card-kicker">Get started as free</p>
          <h1>Create your account</h1>
          <p>
            Create an account to keep your production records securely synced.
            Use fictional data until email verification and password recovery
            are configured.
          </p>
          <AuthForm mode="signup" />
          <p className="auth-switch">
            Already have an account? <Link href="/auth/signin">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
