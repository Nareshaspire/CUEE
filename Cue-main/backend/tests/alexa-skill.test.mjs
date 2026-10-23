import assert from "node:assert/strict"
import test from "node:test"
import { createAlexaSkillResponse } from "../skill.js"

function envelope(intentName, { accessToken = "linked-token", slots = {}, attributes = {} } = {}) {
  return {
    version: "1.0",
    session: {
      new: false,
      sessionId: "session-id",
      application: { applicationId: "skill-id" },
      attributes,
      user: { userId: "alexa-user", accessToken },
    },
    context: {
      System: {
        application: { applicationId: "skill-id" },
        user: { userId: "alexa-user", accessToken },
      },
    },
    request: {
      type: "IntentRequest",
      requestId: "request-id",
      timestamp: new Date().toISOString(),
      locale: "en-US",
      intent: { name: intentName, slots },
    },
  }
}

const run = {
  id: "run-1",
  runId: "CUE-123456",
  product: { name: "Pistachio Crunchies" },
  selectedProcess: "Baker-selected",
  tasks: [
    { taskKey: "prepare-ingredients", name: "Prepare ingredients", state: "COMPLETED", mandatory: true, prerequisites: [] },
    { taskKey: "cool-main", name: "Cool the main component", state: "WAITING", mandatory: true, waitingReason: "cooling", physicalCheckRequired: true },
  ],
}

function services(overrides = {}) {
  return {
    getUser: async (token) => token === "linked-token" ? { id: "user-1", name: "Baker" } : null,
    getRuns: async () => [run],
    createProposal: async () => ({ id: "pending-1", task: run.tasks[0], inspection: false }),
    resolveProposal: async () => ({ ok: true }),
    ...overrides,
  }
}

test("prompts account linking when Alexa has no linked CUE account", async () => {
  const result = await createAlexaSkillResponse(
    envelope("StatusIntent", { accessToken: "" }),
    services(),
  )
  assert.match(result.response.outputSpeech.ssml, /link your CUE account/i)
  assert.equal(result.response.card.type, "LinkAccount")
})

test("answers status from the authenticated user's production records", async () => {
  const result = await createAlexaSkillResponse(
    envelope("StatusIntent"),
    services(),
  )
  assert.match(result.response.outputSpeech.ssml, /CUE-123456/)
  assert.match(result.response.outputSpeech.ssml, /1 of 2 required steps complete/)
})

test("asks for a physical check before proposing completion of a physical-check task", async () => {
  const result = await createAlexaSkillResponse(
    envelope("TaskUpdateIntent", {
      slots: {
        task: { name: "task", value: "Cool the main component" },
        state: { name: "state", value: "completed" },
      },
    }),
    services({
      createProposal: async (_user, _selectedRun, _taskName, state) => ({
        id: "pending-2",
        task: run.tasks[1],
        inspection: state === "COMPLETED",
      }),
    }),
  )
  assert.match(result.response.outputSpeech.ssml, /physically inspected/i)
  assert.equal(result.sessionAttributes.pendingUpdateId, "pending-2")
})

test("requires explicit Alexa confirmation before applying an update", async () => {
  let confirmedId = ""
  const result = await createAlexaSkillResponse(
    envelope("AMAZON.YesIntent", {
      attributes: {
        pendingUpdateId: "pending-3",
        pendingTaskName: "Prepare ingredients",
        pendingState: "IN_PROGRESS",
      },
    }),
    services({
      resolveProposal: async (_user, id, confirm) => {
        confirmedId = `${id}:${confirm}`
        return { ok: true }
      },
    }),
  )
  assert.equal(confirmedId, "pending-3:true")
  assert.match(result.response.outputSpeech.ssml, /recorded as in progress/i)
})

test("cancels an Alexa proposal without changing a run", async () => {
  let resolved = false
  const result = await createAlexaSkillResponse(
    envelope("AMAZON.NoIntent", {
      attributes: {
        pendingUpdateId: "pending-4",
        pendingTaskName: "Prepare ingredients",
      },
    }),
    services({
      resolveProposal: async (_user, _id, confirm) => {
        resolved = confirm
        return { ok: true }
      },
    }),
  )
  assert.equal(resolved, false)
  assert.match(result.response.outputSpeech.ssml, /record was not changed/i)
})
