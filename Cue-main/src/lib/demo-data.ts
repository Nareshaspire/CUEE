import type {
  PendingAction,
  Product,
  ProductionRun,
  User,
} from "@/lib/demo-types"

const now = "2026-10-22T08:00:00.000Z"
const definitions = [
  {
    key: "prepare-ingredients",
    name: "Prepare ingredients",
    sequence: 1,
    category: "preparation" as const,
    prerequisites: [],
  },
  {
    key: "prepare-main",
    name: "Prepare the main component",
    sequence: 2,
    category: "preparation" as const,
    prerequisites: [{ taskKey: "prepare-ingredients" }],
  },
  {
    key: "cook-main",
    name: "Cook or bake the main component",
    sequence: 3,
    category: "active" as const,
    prerequisites: [{ taskKey: "prepare-main" }],
  },
  {
    key: "prepare-packaging",
    name: "Prepare packaging",
    sequence: 4,
    category: "packing" as const,
    prerequisites: [],
    allowsParallel: true,
  },
  {
    key: "cool-main",
    name: "Cool the main component",
    sequence: 5,
    category: "waiting" as const,
    prerequisites: [{ taskKey: "cook-main" }],
    waitingReason: "cooling" as const,
    expectedMinutes: 45,
    physicalCheckRequired: true,
  },
  {
    key: "inspect-main",
    name: "Inspect the finished component",
    sequence: 6,
    category: "inspection" as const,
    prerequisites: [{ taskKey: "cool-main" }],
    physicalCheckRequired: true,
  },
  {
    key: "finish-run",
    name: "Finish and pack order",
    sequence: 7,
    category: "finishing" as const,
    prerequisites: [
      { taskKey: "inspect-main" },
      { taskKey: "prepare-packaging" },
    ],
  },
]

export const demoProducts: Product[] = [
  {
    id: "product-pistachio",
    name: "Chewy Pistachio Crunchies",
    slug: "chewy-pistachio-crunchies",
    description: "Pistachio and kataifi treats",
    taskDefinitions: definitions,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "product-cheesecake",
    name: "Biscoff Cheesecake",
    slug: "no-bake-cheesecake-biscoff",
    description: "Chilled no-bake cheesecake",
    taskDefinitions: definitions.map((task) =>
      task.key === "cook-main"
        ? { ...task, name: "Prepare cheesecake filling" }
        : task.key === "cool-main"
          ? {
              ...task,
              name: "Chill cheesecake",
              waitingReason: "chilling" as const,
            }
          : task,
    ),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "product-cookies",
    name: "Belgian Chocolate Chip Cookies",
    slug: "belgian-chocolate-chip-cookies",
    description: "Small batch cookies",
    taskDefinitions: definitions,
    createdAt: now,
    updatedAt: now,
  },
]

export type DemoState = {
  version: 1
  user: User | null
  runs: ProductionRun[]
  pendingActions: PendingAction[]
}

function makeRun(
  product: Product,
  id: string,
  states: Record<string, ProductionRun["tasks"][number]["state"]>,
): ProductionRun {
  const tasks = product.taskDefinitions.map((definition) => ({
    taskKey: definition.key,
    name: definition.name,
    sequence: definition.sequence,
    category: definition.category,
    prerequisites: definition.prerequisites ?? [],
    allowsParallel: definition.allowsParallel ?? false,
    waitingReason: definition.waitingReason ?? undefined,
    expectedMinutes: definition.expectedMinutes ?? undefined,
    physicalCheckRequired: definition.physicalCheckRequired ?? false,
    mandatory: true,
    state:
      states[definition.key] ??
      (definition.sequence === 1 ? "READY" : "NOT_STARTED"),
    ...(states[definition.key] === "COMPLETED" ? { completedAt: now } : {}),
    ...(states[definition.key] === "WAITING" ? { waitingStartedAt: now } : {}),
  }))
  return {
    id,
    owner: "demo-user",
    runId: `DEMO-${id.slice(-3).toUpperCase()}`,
    product,
    runType: "customer-order",
    quantity: 12,
    selectedProcess: "Baker-selected process",
    status: "IN_PROGRESS",
    version: 1,
    tasks,
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createInitialDemoState(): DemoState {
  const runs = [
    makeRun(demoProducts[0], "run-pistachio", {
      "prepare-ingredients": "COMPLETED",
      "prepare-main": "COMPLETED",
      "cook-main": "COMPLETED",
      "prepare-packaging": "IN_PROGRESS",
      "cool-main": "WAITING",
    }),
    makeRun(demoProducts[1], "run-cheesecake", {
      "prepare-ingredients": "COMPLETED",
      "prepare-main": "COMPLETED",
      "cook-main": "IN_PROGRESS",
      "prepare-packaging": "READY",
    }),
    makeRun(demoProducts[2], "run-cookies", {
      "prepare-ingredients": "COMPLETED",
      "prepare-main": "COMPLETED",
      "cook-main": "BLOCKED",
    }),
  ]
  return {
    version: 1,
    user: null,
    runs,
    pendingActions: [
      {
        id: "pending-demo",
        owner: "demo-user",
        productionRun: runs[0].id,
        taskKey: "prepare-packaging",
        expectedState: "IN_PROGRESS",
        proposedState: "COMPLETED",
        actionType: "transition",
        reason:
          "Demo confirmation: packaging preparation is ready to complete.",
        status: "PENDING",
        snapshotVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}
