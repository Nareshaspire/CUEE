"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import type { PendingAction, ProductionRun, User } from "@/lib/demo-types"
import type { DemoState } from "@/lib/demo-data"

const initialState: DemoState = {
  version: 1,
  user: null,
  runs: [],
  pendingActions: [],
}
let state = initialState
let ready = false
let loadError = ""
let csrfToken = ""
let hydration: Promise<void> | null = null
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const emit = () => listeners.forEach((listener) => listener())
const getSnapshot = () => state

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET"
  const headers = new Headers({ accept: "application/json" })
  if (options.body !== undefined) headers.set("content-type", "application/json")
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfToken && !path.startsWith("auth/")) {
      throw new Error("Your session expired. Sign in again to continue.")
    }
    if (csrfToken) headers.set("x-csrf-token", csrfToken)
  }
  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
  } & T
  if (!response.ok) {
    if (response.status === 401 && path === "auth/me") return payload
    throw new Error(payload.error ?? `The request failed (${response.status}).`)
  }
  return payload
}

async function loadSnapshot() {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  })
  csrfToken = response.headers.get("x-cue-csrf") ?? ""
  if (response.status === 401) {
    csrfToken = ""
    state = initialState
    emit()
    return
  }
  const me = (await response.json()) as { user?: User; error?: string }
  if (!response.ok || !me.user)
    throw new Error(me.error ?? "Could not restore your CUE session.")
  const data = await request<{
    runs: ProductionRun[]
    pendingActions: PendingAction[]
  }>("runs")
  state = {
    version: 1,
    user: me.user,
    runs: data.runs,
    pendingActions: data.pendingActions,
  }
  emit()
}

export function hydrateDemoState() {
  if (hydration) return hydration
  hydration = loadSnapshot()
    .catch((error: unknown) => {
      loadError = error instanceof Error ? error.message : "Could not load your CUE account."
    })
    .finally(() => {
      ready = true
      emit()
    })
  return hydration
}

export function useDemoState() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [, setReady] = useState(ready)
  useEffect(() => {
    void hydrateDemoState().finally(() => setReady(true))
  }, [])
  return { state: value, ready, error: loadError }
}

async function refresh() {
  loadError = ""
  await loadSnapshot()
}

export function hasActiveDemoUser() {
  return Boolean(state.user)
}

export async function authenticateDemo(
  email: string,
  password: string,
  name?: string,
) {
  try {
    await request<{ user: User }>(
      name === undefined ? "auth/login" : "auth/register",
      {
        method: "POST",
        body: name === undefined
          ? { email, password }
          : { email, password, name },
      },
    )
    await refresh()
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not sign in.",
    }
  }
}

export async function startDemoWorkspace() {
  await request("auth/demo", { method: "POST", body: {} })
  await refresh()
}

export async function signOutDemo() {
  await request("auth/logout", { method: "POST", body: {} })
  csrfToken = ""
  state = initialState
  emit()
}

export async function createRunForProduct(productId: string) {
  try {
    await request("runs", {
      method: "POST",
      body: { productId, runType: "planned-production", quantity: 12 },
    })
    await refresh()
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not create the run.",
    }
  }
}

export async function transitionRun(
  runId: string,
  taskKey: string,
  nextState: ProductionRun["tasks"][number]["state"],
  reason = "",
  actionType = "transition",
) {
  try {
    await request(`runs/${encodeURIComponent(runId)}/proposals`, {
      method: "POST",
      body: {
        taskKey,
        proposedState: nextState,
        reason,
        actionType,
      },
    })
    await refresh()
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not propose the update.",
    }
  }
}

export async function confirmPending(id: string, confirm: boolean) {
  try {
    await request(`actions/${encodeURIComponent(id)}/confirm`, {
      method: "POST",
      body: { confirm },
    })
    await refresh()
    return { ok: true as const }
  } catch (error) {
    await refresh().catch(() => {})
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not confirm the update.",
    }
  }
}

export async function resetDemoState() {
  try {
    await request("demo/reset", { method: "POST", body: {} })
    await refresh()
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not reset demo data.",
    }
  }
}

export async function authorizeAlexaLink(
  params: Record<string, string>,
) {
  return request<{ redirect: string }>("oauth/authorize", {
    method: "POST",
    body: params,
  })
}

export async function askAssistant(runId: string, query: string) {
  return request<{ kind: string; answer: string }>("assistant", {
    method: "POST",
    body: { runId, query },
  })
}
