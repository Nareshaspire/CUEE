import assert from "node:assert/strict"
import test from "node:test"
import {
  eligibleTasks,
  recalculateReadiness,
  validateTransition,
} from "../src/lib/workflow.ts"

const task = (overrides) => ({
  taskKey: "task",
  name: "Task",
  sequence: 1,
  category: "active",
  prerequisites: [],
  allowsParallel: false,
  physicalCheckRequired: false,
  mandatory: true,
  state: "NOT_STARTED",
  ...overrides,
})

const run = (tasks, overrides = {}) => ({
  id: "run",
  owner: "user",
  runId: "TEST-1",
  product: "product",
  runType: "planned-production",
  status: "IN_PROGRESS",
  version: 1,
  tasks,
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

test("recalculates a newly unlocked task to Ready", () => {
  const tasks = [
    task({ taskKey: "prepare", name: "Prepare", state: "COMPLETED" }),
    task({
      taskKey: "mix",
      name: "Mix",
      prerequisites: [{ taskKey: "prepare" }],
    }),
  ]
  assert.equal(recalculateReadiness(tasks)[1].state, "READY")
})

test("does not offer freezing work until a process is configured", () => {
  const freezing = task({
    taskKey: "freeze",
    name: "Freeze",
    state: "READY",
    waitingReason: "freezing",
  })
  assert.deepEqual(eligibleTasks(run([freezing])), [])
  assert.equal(
    eligibleTasks(run([freezing], { selectedProcess: "Overnight" }))[0].taskKey,
    "freeze",
  )
})

test("rejects skipping directly from Not Started to Completed", () => {
  const result = validateTransition(
    run([task({ taskKey: "mix" })]),
    "mix",
    "COMPLETED",
  )
  assert.equal(result.ok, false)
})

test("rejects reopening completed work after a dependent task progressed", () => {
  const tasks = [
    task({ taskKey: "prepare", name: "Prepare", state: "COMPLETED" }),
    task({
      taskKey: "mix",
      name: "Mix",
      state: "IN_PROGRESS",
      prerequisites: [{ taskKey: "prepare" }],
    }),
  ]
  const result = validateTransition(run(tasks), "prepare", "READY")
  assert.equal(result.ok, false)
  assert.match(result.error, /dependent work has already progressed/i)
})

test("requires configured waiting work to enter Waiting before completion", () => {
  const waiting = task({
    taskKey: "cool",
    name: "Cool",
    state: "IN_PROGRESS",
    waitingReason: "cooling",
    physicalCheckRequired: true,
  })
  const result = validateTransition(run([waiting]), "cool", "COMPLETED")
  assert.equal(result.ok, false)
  assert.match(result.error, /waiting stage/i)
})
