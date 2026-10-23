import assert from "node:assert/strict"
import test from "node:test"

const memory = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  },
  confirm: () => true,
}

const demo = await import("../src/lib/demo-storage.ts")

test("starts with deterministic sample production data", () => {
  demo.hydrateDemoState()
  const state = demo.getDemoState()
  assert.equal(state.runs.length, 3)
  assert.equal(state.runs[0].runId, "DEMO-HIO")
  assert.equal(state.pendingActions[0].status, "PENDING")
})

test("confirms a proposal and persists its run update", () => {
  const proposal = demo.getDemoState().pendingActions[0]
  const result = demo.confirmPending(proposal.id, true)
  assert.equal(result.ok, true)
  const state = JSON.parse(memory.get("cue-demo-state-v1"))
  assert.equal(state.pendingActions[0].status, "CONFIRMED")
  assert.equal(
    state.runs[0].tasks.find((task) => task.taskKey === "prepare-packaging")
      .state,
    "COMPLETED",
  )
})

test("rejects invalid account input and saves valid local demo account", () => {
  assert.equal(demo.authenticateDemo("bad", "short", "Baker").ok, false)
  const signedUp = demo.authenticateDemo(
    "baker@example.test",
    "demo-password",
    "Local Baker",
  )
  assert.equal(signedUp.ok, true)
  assert.equal(demo.getDemoState().user.name, "Local Baker")
  demo.signOutDemo()
  assert.equal(demo.authenticateDemo("baker@example.test", "wrong").ok, false)
  assert.equal(
    demo.authenticateDemo("baker@example.test", "demo-password").ok,
    true,
  )
})

test("creates a local run and cancels a proposed transition without changing it", () => {
  const before = demo.getDemoState().runs.length
  demo.createRunForProduct("product-cookies")
  const created = demo.getDemoState().runs.at(-1)
  assert.equal(demo.getDemoState().runs.length, before + 1)
  assert.equal(created.product.name, "Belgian Chocolate Chip Cookies")
  const proposal = demo.transitionRun(
    created.id,
    "prepare-ingredients",
    "IN_PROGRESS",
  )
  assert.equal(proposal.ok, true)
  const pending = demo.getDemoState().pendingActions.at(-1)
  assert.equal(demo.confirmPending(pending.id, false).ok, true)
  assert.equal(demo.getDemoState().runs.at(-1).tasks[0].state, "READY")
})

test("reset restores sample records but keeps the signed-in demo identity", () => {
  const user = demo.getDemoState().user
  demo.resetDemoState()
  assert.equal(demo.getDemoState().runs.length, 3)
  assert.equal(demo.getDemoState().user.id, user.id)
})

test("keeps the in-memory demo usable if browser storage writes are blocked", () => {
  const storage = window.localStorage
  window.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("blocked")
    },
  }
  demo.createRunForProduct("product-pistachio")
  assert.equal(demo.getDemoState().runs.length, 4)
  window.localStorage = storage
})

test("malformed stored application data falls back without replacing it on hydrate", () => {
  memory.set("cue-demo-state-v1", "not-json")
  const fresh = new URL(
    `../src/lib/demo-storage.ts?malformed=${Date.now()}`,
    import.meta.url,
  )
  return import(fresh.href).then((module) => {
    module.hydrateDemoState()
    assert.equal(module.getDemoState().runs.length, 3)
    assert.equal(memory.get("cue-demo-state-v1"), "not-json")
  })
})
