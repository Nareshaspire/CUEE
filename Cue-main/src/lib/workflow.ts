import type { ProductionRun, Product } from "@/lib/demo-types"

export type TaskState = ProductionRun["tasks"][number]["state"]
export type RunTask = ProductionRun["tasks"][number]

const transitions: Record<TaskState, TaskState[]> = {
  NOT_STARTED: ["READY", "IN_PROGRESS", "BLOCKED"],
  READY: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["WAITING", "NEEDS_INSPECTION", "BLOCKED", "COMPLETED"],
  WAITING: ["NEEDS_INSPECTION", "BLOCKED", "COMPLETED"],
  NEEDS_INSPECTION: ["BLOCKED", "COMPLETED"],
  BLOCKED: ["READY", "NEEDS_INSPECTION"],
  COMPLETED: ["READY"],
}

export function completedKeys(tasks: RunTask[]) {
  return new Set(
    tasks
      .filter((task) => task.state === "COMPLETED")
      .map((task) => task.taskKey),
  )
}

export function unmetPrerequisites(task: RunTask, tasks: RunTask[]) {
  const completed = completedKeys(tasks)
  return (task.prerequisites ?? [])
    .map((item) => item.taskKey)
    .filter((key) => !completed.has(key))
}

export function eligibleTasks(run: ProductionRun) {
  return run.tasks.filter(
    (task) =>
      ["NOT_STARTED", "READY"].includes(task.state) &&
      unmetPrerequisites(task, run.tasks).length === 0 &&
      !(task.waitingReason === "freezing" && !run.selectedProcess),
  )
}

export function progressFor(run: ProductionRun) {
  const mandatory = run.tasks.filter((task) => task.mandatory !== false)
  if (!mandatory.length) return 0
  return Math.round(
    (mandatory.filter((task) => task.state === "COMPLETED").length /
      mandatory.length) *
      100,
  )
}

export function recalculateReadiness(
  tasks: ProductionRun["tasks"],
  selectedProcess?: string | null,
) {
  const completed = completedKeys(tasks)
  return tasks.map((task) => {
    const prerequisitesMet = (task.prerequisites ?? []).every((item) =>
      completed.has(item.taskKey),
    )
    const configured =
      task.waitingReason !== "freezing" || Boolean(selectedProcess)
    if (task.state === "NOT_STARTED" && prerequisitesMet && configured) {
      return { ...task, state: "READY" as const }
    }
    if (task.state === "READY" && (!prerequisitesMet || !configured)) {
      return { ...task, state: "NOT_STARTED" as const }
    }
    return task
  })
}

export function validateTransition(
  run: ProductionRun,
  taskKey: string,
  next: TaskState,
) {
  const task = run.tasks.find((item) => item.taskKey === taskKey)
  if (!task) return { ok: false as const, error: "That task no longer exists." }
  if (!transitions[task.state].includes(next)) {
    return {
      ok: false as const,
      error: `${task.name} cannot move from ${task.state.replaceAll("_", " ").toLowerCase()} to ${next.replaceAll("_", " ").toLowerCase()}.`,
    }
  }
  const unmet = unmetPrerequisites(task, run.tasks)
  if (
    [
      "READY",
      "IN_PROGRESS",
      "WAITING",
      "NEEDS_INSPECTION",
      "COMPLETED",
    ].includes(next) &&
    unmet.length
  ) {
    return {
      ok: false as const,
      error: `Complete ${unmet.join(", ")} before advancing this task.`,
    }
  }
  if (
    task.waitingReason === "freezing" &&
    next === "IN_PROGRESS" &&
    !run.selectedProcess
  ) {
    return {
      ok: false as const,
      error:
        "Select and record the freezing process before starting this task.",
    }
  }
  if (
    task.waitingReason &&
    task.state === "IN_PROGRESS" &&
    next === "COMPLETED"
  ) {
    return {
      ok: false as const,
      error: `${task.name} must enter its waiting stage before it can be inspected or completed.`,
    }
  }
  if (task.state === "COMPLETED" && next === "READY") {
    const progressedDependents = run.tasks.filter(
      (candidate) =>
        candidate.prerequisites?.some(
          (item) => item.taskKey === task.taskKey,
        ) && !["NOT_STARTED", "READY", "BLOCKED"].includes(candidate.state),
    )
    if (progressedDependents.length) {
      return {
        ok: false as const,
        error: `Review ${progressedDependents.map((item) => item.name).join(", ")} before reopening ${task.name}; dependent work has already progressed.`,
      }
    }
  }
  return { ok: true as const, task }
}

export function instantiateTasks(product: Product): ProductionRun["tasks"] {
  return product.taskDefinitions.map((task) => ({
    taskKey: task.key,
    name: task.name,
    sequence: task.sequence,
    category: task.category,
    prerequisites: task.prerequisites ?? [],
    allowsParallel: task.allowsParallel ?? false,
    waitingReason: task.waitingReason ?? undefined,
    expectedMinutes: task.expectedMinutes ?? undefined,
    physicalCheckRequired: task.physicalCheckRequired ?? false,
    mandatory: task.mandatory ?? true,
    state: task.sequence === 1 ? "READY" : "NOT_STARTED",
  }))
}

export function productName(run: ProductionRun) {
  return typeof run.product === "object" ? run.product.name : "Production run"
}
