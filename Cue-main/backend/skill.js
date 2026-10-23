import { SkillBuilders, getIntentName, getRequestType } from "ask-sdk-core"

const LaunchHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "LaunchRequest"
  },
  handle(input) {
    const token = input.requestEnvelope.context?.System?.user?.accessToken
    if (!token)
      return input.responseBuilder
        .speak("Link your CUE account in the Alexa app to view your production runs.")
        .withLinkAccountCard()
        .getResponse()
    return input.responseBuilder
      .speak("Welcome to CUE. Ask for the status, next steps, waits, or blockers on your production.")
      .reprompt("What would you like to know about production?")
      .getResponse()
  },
}

const AccountRequiredHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "IntentRequest" &&
      !input.requestEnvelope.context?.System?.user?.accessToken &&
      getIntentName(input.requestEnvelope) !== "AMAZON.HelpIntent"
  },
  handle(input) {
    return input.responseBuilder
      .speak("Please link your CUE account in the Alexa app before asking about production.")
      .withLinkAccountCard()
      .getResponse()
  },
}

function slotValue(input, name) {
  return input.requestEnvelope.request.intent?.slots?.[name]?.value?.trim()
}

function selectRun(runs, requested) {
  if (!runs.length) return { error: "Your CUE account has no production runs yet." }
  if (requested) {
    const exact = runs.find((run) =>
      run.runId.toLowerCase() === requested.toLowerCase() ||
      run.product.name.toLowerCase() === requested.toLowerCase(),
    )
    if (exact) return { run: exact }
    return { error: `I could not find a run called ${requested}.` }
  }
  if (runs.length > 1) {
    return {
      error: `You have ${runs.length} production runs. Please say a run ID, such as ${runs[0].runId}.`,
    }
  }
  return { run: runs[0] }
}

function makeQueryHandler(intentName, getAnswer) {
  return {
    canHandle(input) {
      return getRequestType(input.requestEnvelope) === "IntentRequest" &&
        getIntentName(input.requestEnvelope) === intentName
    },
    async handle(input) {
      const accessToken = input.requestEnvelope.context?.System?.user?.accessToken
      const user = await input.attributesManager.getRequestAttributes().getUser(accessToken)
      if (!user)
        return input.responseBuilder.speak("Your CUE account link has expired. Please link it again in the Alexa app.").withLinkAccountCard().getResponse()
      const runs = await input.attributesManager.getRequestAttributes().getRuns(user.id)
      const selected = selectRun(runs, slotValue(input, "run"))
      if (selected.error)
        return input.responseBuilder.speak(selected.error).reprompt("Which production run would you like?").getResponse()
      return input.responseBuilder.speak(await getAnswer(input, user, selected.run)).reprompt("What else would you like to know?").getResponse()
    },
  }
}

const StatusHandler = makeQueryHandler("StatusIntent", async (_input, _user, run) =>
  `${run.runId} for ${run.product.name} is ${run.tasks.filter((task) => task.mandatory !== false && task.state === "COMPLETED").length} of ${run.tasks.filter((task) => task.mandatory !== false).length} required steps complete.`,
)

const NextStepsHandler = makeQueryHandler("NextStepsIntent", async (_input, _user, run) => {
  const eligible = run.tasks.filter((task) =>
    ["NOT_STARTED", "READY"].includes(task.state) &&
    (task.prerequisites ?? []).every((requirement) =>
      run.tasks.some((candidate) => candidate.taskKey === requirement.taskKey && candidate.state === "COMPLETED"),
    ) &&
    !(task.waitingReason === "freezing" && !run.selectedProcess),
  )
  return eligible.length
    ? `You can work on ${eligible.map((task) => task.name).join(", ")}. Their recorded prerequisites are complete.`
    : `There are no newly eligible steps recorded for ${run.runId}.`
})

const WaitingHandler = makeQueryHandler("WaitingIntent", async (_input, _user, run) => {
  const waiting = run.tasks.filter((task) => task.state === "WAITING")
  return waiting.length
    ? waiting.map((task) =>
      `${task.name} is waiting for ${task.waitingReason ?? "a recorded wait"}${task.physicalCheckRequired ? ". A person must physically verify readiness before it can be completed" : ""}`,
    ).join(". ")
    : `There are no tasks recorded as waiting for ${run.runId}.`
})

const BlockersHandler = makeQueryHandler("BlockersIntent", async (_input, _user, run) => {
  const blocked = run.tasks.filter((task) => task.state === "BLOCKED")
  return blocked.length
    ? blocked.map((task) => `${task.name} is blocked: ${task.blockedReason ?? task.qualityIssue ?? "no reason recorded"}`).join(". ")
    : `No blocked tasks are recorded for ${run.runId}.`
})

const UpdateHandler = makeQueryHandler("TaskUpdateIntent", async (input, user, run) => {
  const taskName = slotValue(input, "task")
  const state = slotValue(input, "state")?.toLowerCase()
  if (!taskName || !state)
    return "Tell me which task and state you want to propose. I will ask you to confirm before changing the record."
  const nextState = state.includes("complete") || state === "done"
    ? "COMPLETED"
    : state.includes("start") || state.includes("progress")
      ? "IN_PROGRESS"
      : state.includes("wait")
        ? "WAITING"
        : null
  if (!nextState) return "I can propose starting, waiting, or completing a task. Which state should I record?"
  const result = await input.attributesManager.getRequestAttributes().createProposal(user, run, taskName, nextState)
  if (result.error) return result.error
  input.attributesManager.setSessionAttributes({
    ...(input.attributesManager.getSessionAttributes() ?? {}),
    pendingUpdateId: result.id,
    pendingTaskName: result.task.name,
    pendingState: nextState,
    pendingInspection: result.inspection,
  })
  return result.inspection
    ? `Before I propose completing ${result.task.name}, have you physically inspected and confirmed it is ready? Say yes only if you have.`
    : `I can propose changing ${result.task.name} to ${nextState.toLowerCase().replaceAll("_", " ")}. Should I submit this for confirmation?`
})

const YesHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "IntentRequest" &&
      getIntentName(input.requestEnvelope) === "AMAZON.YesIntent" &&
      input.attributesManager.getSessionAttributes()?.pendingUpdateId
  },
  async handle(input) {
    const session = input.attributesManager.getSessionAttributes()
    const accessToken = input.requestEnvelope.context?.System?.user?.accessToken
    const user = await input.attributesManager.getRequestAttributes().getUser(accessToken)
    if (!user) return input.responseBuilder.speak("Please relink your CUE account and try again.").withLinkAccountCard().getResponse()
    const result = await input.attributesManager.getRequestAttributes().resolveProposal(user, session.pendingUpdateId, true)
    input.attributesManager.setSessionAttributes({})
    return input.responseBuilder
      .speak(result.ok
        ? `${session.pendingTaskName} was recorded as ${session.pendingState.toLowerCase().replaceAll("_", " ")}. This updates the production record; it does not verify kitchen conditions.`
        : result.error)
      .getResponse()
  },
}

const NoHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "IntentRequest" &&
      getIntentName(input.requestEnvelope) === "AMAZON.NoIntent" &&
      input.attributesManager.getSessionAttributes()?.pendingUpdateId
  },
  async handle(input) {
    const session = input.attributesManager.getSessionAttributes()
    const accessToken = input.requestEnvelope.context?.System?.user?.accessToken
    const user = await input.attributesManager.getRequestAttributes().getUser(accessToken)
    if (user)
      await input.attributesManager.getRequestAttributes().resolveProposal(user, session.pendingUpdateId, false)
    input.attributesManager.setSessionAttributes({})
    return input.responseBuilder.speak("Okay. I cancelled the proposed update; the production record was not changed.").getResponse()
  },
}

const CustomerDraftHandler = makeQueryHandler("CustomerUpdateIntent", async (_input, _user, run) => {
  const completed = run.tasks.filter((task) => task.mandatory !== false && task.state === "COMPLETED")
  const required = run.tasks.filter((task) => task.mandatory !== false)
  const percent = required.length ? Math.round(completed.length / required.length * 100) : 0
  return `Draft only for ${run.product.name}: ${percent} percent of recorded production steps are complete. Review the production record before sharing. I have not sent a message.`
})

const HelpHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "IntentRequest" &&
      getIntentName(input.requestEnvelope) === "AMAZON.HelpIntent"
  },
  handle(input) {
    return input.responseBuilder.speak("Ask for production status, next steps, waits, or blockers. You can also propose an update, then confirm or cancel it.").reprompt("What would you like to know?").getResponse()
  },
}

const StopHandler = {
  canHandle(input) {
    return ["AMAZON.StopIntent", "AMAZON.CancelIntent"].includes(getIntentName(input.requestEnvelope))
  },
  handle(input) {
    input.attributesManager.setSessionAttributes({})
    return input.responseBuilder.speak("Goodbye.").getResponse()
  },
}

const FallbackHandler = {
  canHandle(input) {
    return getRequestType(input.requestEnvelope) === "IntentRequest"
  },
  handle(input) {
    return input.responseBuilder.speak("I can answer about status, next steps, waits, and blockers, or propose a workflow update.").reprompt("What would you like to ask?").getResponse()
  },
}

const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(input, error) {
    console.error("Alexa skill request failed", error)
    return input.responseBuilder.speak("I could not reach your production records. Please try again.").getResponse()
  },
}

export async function createAlexaSkillResponse(envelope, services) {
  const requestSkill = SkillBuilders.custom()
    .withSkillId(envelope.context.System.application.applicationId)
    .addRequestInterceptors(({ attributesManager }) => {
      attributesManager.setRequestAttributes(services)
    })
    .addRequestHandlers(
      LaunchHandler,
      HelpHandler,
      StopHandler,
      YesHandler,
      NoHandler,
      AccountRequiredHandler,
      StatusHandler,
      NextStepsHandler,
      WaitingHandler,
      BlockersHandler,
      UpdateHandler,
      CustomerDraftHandler,
      FallbackHandler,
    )
    .addErrorHandlers(ErrorHandler)
    .create()
  return requestSkill.invoke(envelope)
}
