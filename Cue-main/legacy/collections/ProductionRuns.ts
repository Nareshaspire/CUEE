import type { Access, CollectionConfig } from "payload"

const owned: Access = ({ req }) => {
  if (req.user?.collection === "admins") return true
  if (req.user?.collection !== "users") return false
  return { owner: { equals: req.user.id } }
}

const taskStates = [
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "NEEDS_INSPECTION",
  "BLOCKED",
  "COMPLETED",
] as const

const allowedTransitions: Record<string, string[]> = {
  NOT_STARTED: ["READY", "IN_PROGRESS", "BLOCKED"],
  READY: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["WAITING", "NEEDS_INSPECTION", "BLOCKED", "COMPLETED"],
  WAITING: ["NEEDS_INSPECTION", "BLOCKED", "COMPLETED"],
  NEEDS_INSPECTION: ["BLOCKED", "COMPLETED"],
  BLOCKED: ["READY", "NEEDS_INSPECTION"],
  COMPLETED: ["READY"],
}

export const ProductionRuns: CollectionConfig = {
  slug: "production-runs",
  admin: {
    group: "CUE workflows",
    useAsTitle: "runId",
  },
  access: {
    create: ({ data, req }) =>
      req.user?.collection === "admins" ||
      (req.user?.collection === "users" && data?.owner === req.user.id),
    delete: owned,
    read: owned,
    update: owned,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const tasks = Array.isArray(data.tasks) ? data.tasks : []
        const previousTasks = Array.isArray(originalDoc?.tasks)
          ? originalDoc.tasks
          : []
        const completed = new Set(
          tasks
            .filter((task) => task.state === "COMPLETED")
            .map((task) => task.taskKey),
        )

        for (const task of tasks) {
          const previous = previousTasks.find(
            (item: { taskKey?: string }) => item.taskKey === task.taskKey,
          )
          if (
            previous &&
            previous.state !== task.state &&
            !allowedTransitions[previous.state]?.includes(task.state)
          ) {
            throw new Error(
              `${task.name} cannot move from ${previous.state} to ${task.state}.`,
            )
          }
          if (
            [
              "READY",
              "IN_PROGRESS",
              "WAITING",
              "NEEDS_INSPECTION",
              "COMPLETED",
            ].includes(task.state)
          ) {
            const prerequisites = Array.isArray(task.prerequisites)
              ? task.prerequisites.map(
                  (item: { taskKey?: string }) => item.taskKey,
                )
              : []
            if (
              prerequisites.some(
                (key: string | undefined) => key && !completed.has(key),
              )
            ) {
              throw new Error(
                `${task.name} cannot advance until its prerequisites are complete.`,
              )
            }
          }
          if (
            task.state === "COMPLETED" &&
            task.physicalCheckRequired &&
            !task.readinessConfirmedAt
          ) {
            throw new Error(
              `${task.name} requires a recorded physical check before completion.`,
            )
          }
        }

        if (
          data.status === "COMPLETED" &&
          tasks.some(
            (task) => task.mandatory !== false && task.state !== "COMPLETED",
          )
        ) {
          throw new Error(
            "A production run cannot complete while mandatory tasks remain.",
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: "owner",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    { name: "runId", type: "text", required: true, index: true },
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      required: true,
    },
    {
      name: "runType",
      type: "select",
      required: true,
      options: [
        { label: "Customer order", value: "customer-order" },
        { label: "Planned production", value: "planned-production" },
      ],
    },
    { name: "quantity", type: "number", min: 1 },
    { name: "selectedProcess", type: "text" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "IN_PROGRESS",
      options: taskStates.map((value) => ({
        label: value.replaceAll("_", " "),
        value,
      })),
    },
    {
      name: "version",
      type: "number",
      required: true,
      defaultValue: 1,
      min: 1,
    },
    {
      name: "tasks",
      type: "array",
      required: true,
      fields: [
        { name: "taskKey", type: "text", required: true },
        { name: "name", type: "text", required: true },
        { name: "sequence", type: "number", required: true },
        { name: "category", type: "text", required: true },
        {
          name: "prerequisites",
          type: "array",
          fields: [{ name: "taskKey", type: "text", required: true }],
        },
        { name: "allowsParallel", type: "checkbox", defaultValue: false },
        {
          name: "waitingReason",
          type: "select",
          options: ["cooling", "freezing", "chilling", "setting"],
        },
        { name: "expectedMinutes", type: "number", min: 1 },
        {
          name: "physicalCheckRequired",
          type: "checkbox",
          defaultValue: false,
        },
        { name: "mandatory", type: "checkbox", defaultValue: true },
        {
          name: "state",
          type: "select",
          required: true,
          options: taskStates.map((value) => ({
            label: value.replaceAll("_", " "),
            value,
          })),
        },
        { name: "startedAt", type: "date" },
        { name: "completedAt", type: "date" },
        { name: "waitingStartedAt", type: "date" },
        { name: "readinessConfirmedAt", type: "date" },
        { name: "blockedReason", type: "textarea" },
        {
          name: "qualityStatus",
          type: "select",
          options: ["PENDING", "PASSED", "FAILED"],
        },
        { name: "qualityIssue", type: "textarea" },
      ],
    },
    {
      name: "history",
      type: "array",
      fields: [
        { name: "taskKey", type: "text", required: true },
        { name: "fromState", type: "text", required: true },
        { name: "toState", type: "text", required: true },
        { name: "reason", type: "textarea" },
        { name: "actor", type: "text", required: true },
        { name: "recordedAt", type: "date", required: true },
      ],
    },
  ],
}
