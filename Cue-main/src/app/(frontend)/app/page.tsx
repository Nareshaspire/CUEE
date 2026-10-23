"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { PendingAction, ProductionRun } from "@/lib/demo-types"
import {
  demoProducts,
} from "@/lib/demo-data"
import {
  confirmPending,
  createRunForProduct,
  hasActiveDemoUser,
  resetDemoState,
  signOutDemo,
  useDemoState,
} from "@/lib/backend-client"
import DashboardClient from "./DashboardClient"

export default function AppPage() {
  const { state: data, ready, error: loadError } = useDemoState()
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (ready && !hasActiveDemoUser()) window.location.replace("/auth/signin")
  }, [ready, data.user])
  if (!ready)
    return (
      <main className="app-page">
        <p>Opening your CUE workspace…</p>
      </main>
    )
  if (!data.user) {
    if (loadError)
      return (
        <main className="app-page">
          <p className="form-alert" role="alert">{loadError}</p>
          <Link href="/auth/signin/">Return to sign in</Link>
        </main>
      )
    return (
      <main className="app-page">
        <p>Opening your CUE workspace…</p>
      </main>
    )
  }
  const pending = data.pendingActions.find(
    (item) => item.status === "PENDING",
  ) as PendingAction | undefined
  const runId =
    pending &&
    (typeof pending.productionRun === "object"
      ? pending.productionRun.id
      : pending.productionRun)
  const run = data.runs.find((item) => item.id === runId)
  const task = run?.tasks.find((item) => item.taskKey === pending?.taskKey)
  const product =
    run && typeof run.product === "object" ? run.product : undefined
  function resolve(confirmed: boolean) {
    if (!pending) return
    void confirmPending(pending.id, confirmed).then((result) => {
      setMessage(
        result.ok
          ? confirmed
            ? `Update confirmed: ${task?.name ?? "task"}.`
            : "Update cancelled. No production task changed."
          : result.error,
      )
    })
  }
  return (
    <main className="app-page">
      <header className="app-header">
        <Link href="/" className="app-logo">
          <img src="/cue/logo.png" alt="CUE" />
        </Link>
        <div className="app-user">
          <span>
            <strong>{data.user.name}</strong>
            <small>
              {data.user.accountType === "demo"
                ? "Isolated demo workspace"
                : "Production workspace"}
            </small>
          </span>
          <button
            className="button button--secondary"
            onClick={() => {
              void signOutDemo()
                .then(() => window.location.assign("/"))
                .catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : "Could not sign out."),
                )
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="app-shell">
        <div className="app-title">
          <div>
            <p className="eyebrow">
              Production workspace · Securely synced
            </p>
            <h1>Good work starts with a clear next step.</h1>
            <p>
              Updates are securely stored and shared across your production board.
            </p>
          </div>
          <div className="pending-count">
            <strong>
              {
                data.pendingActions.filter((item) => item.status === "PENDING")
                  .length
              }
            </strong>
            <span>awaiting confirmation</span>
          </div>
        </div>
        {message && (
          <p
            className={
              message.startsWith("Update confirmed")
                ? "operation-banner operation-banner--success"
                : "form-alert"
            }
            role="status"
          >
            {message}
          </p>
        )}
        {loadError && (
          <p className="form-alert" role="alert">
            {loadError}
          </p>
        )}
        {pending && (
          <section
            className="confirmation-panel"
            aria-labelledby="confirm-title"
          >
            <div>
              <p className="card-kicker">Review before changing the run</p>
              <h2 id="confirm-title">Confirm this task update?</h2>
              <dl className="confirmation-summary">
                <div>
                  <dt>Production run</dt>
                  <dd>{run?.runId ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Product</dt>
                  <dd>{product?.name ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>{task?.name ?? pending.taskKey}</dd>
                </div>
                <div>
                  <dt>Proposed state</dt>
                  <dd>
                    {pending.proposedState.replaceAll("_", " ").toLowerCase()}
                  </dd>
                </div>
              </dl>
              {pending.actionType === "inspection" && (
                <p className="inspection-question">
                  Have you physically verified the required condition for this
                  task?
                </p>
              )}
            </div>
            <div className="confirmation-actions">
              <button
                className="button button--secondary"
                onClick={() => resolve(false)}
              >
                Cancel
              </button>
              <button
                className="button button--primary"
                onClick={() => resolve(true)}
              >
                {pending.actionType === "inspection"
                  ? "Confirm After Inspection"
                  : "Confirm Update"}
              </button>
            </div>
          </section>
        )}
        {data.runs.length ? (
          <DashboardClient runs={data.runs as ProductionRun[]} />
        ) : (
          <section className="empty-board">
            <span className="cue-avatar">C</span>
            <h2>Your production board is ready.</h2>
            <p>Choose a product to create your first independent run.</p>
            <div>
              {demoProducts.map((item) => (
                <button
                  className="button button--primary"
                  key={item.id}
                  onClick={() => {
                    void createRunForProduct(item.id).then((result) => {
                      if (!result.ok) setMessage(result.error)
                    })
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        )}
        {data.user.accountType === "demo" && (
          <div className="app-footer-actions">
            <button
              className="button button--secondary"
              onClick={() => {
                if (window.confirm("Reset the demo to its original sample data?")) {
                  void resetDemoState().then((result) => {
                    setMessage(
                      result.ok
                        ? "Demo data reset to its original sample state."
                        : result.error,
                    )
                  })
                }
              }}
            >
              Reset demo data
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
