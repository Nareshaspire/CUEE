"use server"

import { redirect } from "next/navigation"
import type { ProductionRun } from "@/payload-types"
import { appAuth } from "@/lib/app-auth"
import { getPayloadClient } from "@/lib/payload"
import {
  instantiateTasks,
  recalculateReadiness,
  validateTransition,
  type TaskState,
} from "@/lib/workflow"

const allowedStates = new Set<TaskState>([
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "NEEDS_INSPECTION",
  "BLOCKED",
  "COMPLETED",
])

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

async function context() {
  const user = await appAuth.currentUser()
  if (!user) redirect("/auth/signin")
  return {
    payload: await getPayloadClient(),
    user: { ...user, collection: "users" as const },
  }
}

export async function signOut() {
  const user = await appAuth.currentUser()
  if (user?.accountType === "demo") {
    const payload = await getPayloadClient()
    const authUser = { ...user, collection: "users" as const }
    await payload.delete({
      collection: "pending-actions",
      where: { owner: { equals: user.id } },
      user: authUser,
      overrideAccess: false,
    })
    await payload.delete({
      collection: "production-runs",
      where: { owner: { equals: user.id } },
      user: authUser,
      overrideAccess: false,
    })
    await payload.delete({
      collection: "users",
      id: user.id,
      user: authUser,
      overrideAccess: false,
    })
  }
  await appAuth.logout()
  redirect("/")
}

export async function createRun(formData: FormData) {
  const { payload, user } = await context()
  const productId = text(formData, "productId")
  const product = await payload.findByID({
    collection: "products",
    id: productId,
    user,
    overrideAccess: false,
  })
  await payload.create({
    collection: "production-runs",
    data: {
      owner: user.id,
      runId: `CUE-${Date.now().toString(36).toUpperCase()}`,
      product: product.id,
      runType: "planned-production",
      status: "IN_PROGRESS",
      version: 1,
      tasks: instantiateTasks(product),
      history: [],
    },
    user,
    overrideAccess: false,
  })
  redirect("/app")
}

export async function proposeTransition(formData: FormData) {
  const { payload, user } = await context()
  const runId = text(formData, "runId")
  const taskKey = text(formData, "taskKey")
  const proposedState = text(formData, "proposedState") as TaskState
  const reason = text(formData, "reason")
  const actionType = text(formData, "actionType") || "transition"
  if (!allowedStates.has(proposedState))
    redirect("/app?error=Unsupported+task+state")

  const run = (await payload.findByID({
    collection: "production-runs",
    id: runId,
    depth: 1,
    user,
    overrideAccess: false,
  })) as ProductionRun
  const validation = validateTransition(run, taskKey, proposedState)
  if (!validation.ok)
    redirect(`/app?error=${encodeURIComponent(validation.error)}`)
  if (actionType === "correction" && !reason) {
    redirect("/app?error=A+correction+requires+a+reason")
  }

  const existing = await payload.find({
    collection: "pending-actions",
    depth: 0,
    limit: 1,
    where: {
      and: [
        { productionRun: { equals: run.id } },
        { taskKey: { equals: taskKey } },
        { status: { equals: "PENDING" } },
      ],
    },
    user,
    overrideAccess: false,
  })
  if (existing.docs[0]) redirect(`/app?pending=${existing.docs[0].id}`)

  const pending = await payload.create({
    collection: "pending-actions",
    data: {
      owner: user.id,
      productionRun: run.id,
      taskKey,
      expectedState: validation.task.state,
      proposedState,
      actionType:
        actionType === "correction"
          ? "correction"
          : actionType === "inspection"
            ? "inspection"
            : validation.task.physicalCheckRequired &&
                proposedState === "COMPLETED"
              ? "inspection"
              : "transition",
      reason: reason || undefined,
      status: "PENDING",
      snapshotVersion: run.version,
    },
    user,
    overrideAccess: false,
  })
  redirect(`/app?pending=${pending.id}`)
}

export async function confirmAction(formData: FormData) {
  const { payload, user } = await context()
  const pendingId = text(formData, "pendingId")
  const pending = await payload.findByID({
    collection: "pending-actions",
    id: pendingId,
    depth: 0,
    user,
    overrideAccess: false,
  })
  if (pending.status !== "PENDING")
    redirect("/app?error=That+proposal+is+no+longer+pending")

  const relationship = pending.productionRun
  const runId =
    typeof relationship === "object" ? relationship.id : relationship
  const run = (await payload.findByID({
    collection: "production-runs",
    id: runId,
    depth: 1,
    user,
    overrideAccess: false,
  })) as ProductionRun
  const task = run.tasks.find((item) => item.taskKey === pending.taskKey)
  if (
    !task ||
    run.version !== pending.snapshotVersion ||
    task.state !== pending.expectedState
  ) {
    await payload.update({
      collection: "pending-actions",
      id: pending.id,
      data: { status: "STALE" },
      user,
      overrideAccess: false,
    })
    redirect(
      "/app?error=The+run+changed.+Review+the+latest+state+before+trying+again",
    )
  }

  const proposedState = pending.proposedState as TaskState
  const validation = validateTransition(run, task.taskKey, proposedState)
  if (!validation.ok)
    redirect(`/app?error=${encodeURIComponent(validation.error)}`)
  const now = new Date().toISOString()
  const transitionedTasks = run.tasks.map((item) => {
    if (item.taskKey !== task.taskKey) return item
    return {
      ...item,
      state: proposedState,
      startedAt: proposedState === "IN_PROGRESS" ? now : item.startedAt,
      waitingStartedAt:
        proposedState === "WAITING" ? now : item.waitingStartedAt,
      readinessConfirmedAt:
        pending.actionType === "inspection" && proposedState === "COMPLETED"
          ? now
          : item.readinessConfirmedAt,
      completedAt: proposedState === "COMPLETED" ? now : undefined,
      blockedReason: proposedState === "BLOCKED" ? pending.reason : undefined,
      qualityStatus:
        pending.actionType === "inspection"
          ? proposedState === "COMPLETED"
            ? "PASSED" as const
            : proposedState === "BLOCKED"
              ? "FAILED" as const
              : item.qualityStatus
          : item.qualityStatus,
      qualityIssue:
        pending.actionType === "inspection" && proposedState === "BLOCKED"
          ? pending.reason
          : item.qualityIssue,
    }
  })
  const tasks = recalculateReadiness(transitionedTasks, run.selectedProcess)
  const allComplete = tasks
    .filter((item) => item.mandatory !== false)
    .every((item) => item.state === "COMPLETED")

  await payload.update({
    collection: "production-runs",
    id: run.id,
    data: {
      tasks,
      version: run.version + 1,
      status: allComplete ? "COMPLETED" : "IN_PROGRESS",
      history: [
        ...(run.history ?? []),
        {
          taskKey: task.taskKey,
          fromState: task.state,
          toState: proposedState,
          reason: pending.reason,
          actor: user.name,
          recordedAt: now,
        },
      ],
    },
    user,
    overrideAccess: false,
  })
  await payload.update({
    collection: "pending-actions",
    id: pending.id,
    data: { status: "CONFIRMED" },
    user,
    overrideAccess: false,
  })
  redirect(`/app?success=${encodeURIComponent(task.name)}`)
}

export async function cancelAction(formData: FormData) {
  const { payload, user } = await context()
  await payload.update({
    collection: "pending-actions",
    id: text(formData, "pendingId"),
    data: { status: "CANCELLED" },
    user,
    overrideAccess: false,
  })
  redirect("/app?cancelled=1")
}
