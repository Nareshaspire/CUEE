export type TaskState = "NOT_STARTED" | "READY" | "IN_PROGRESS" | "WAITING" | "NEEDS_INSPECTION" | "BLOCKED" | "COMPLETED"
export type TaskCategory = "preparation" | "active" | "waiting" | "inspection" | "finishing" | "packing" | "storage"

export interface User {
  id: string
  name: string
  email: string
  accountType: "baker" | "demo"
  collection: "users"
  createdAt: string
  updatedAt: string
}
export interface ProductTask {
  key: string
  name: string
  sequence: number
  category: TaskCategory
  prerequisites?: { taskKey: string }[]
  allowsParallel?: boolean | null
  waitingReason?: "cooling" | "freezing" | "chilling" | "setting" | null
  expectedMinutes?: number | null
  physicalCheckRequired?: boolean | null
  completionCriteria?: string | null
  mandatory?: boolean | null
}
export interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  taskDefinitions: ProductTask[]
  createdAt: string
  updatedAt: string
}
export interface RunTask {
  taskKey: string
  name: string
  sequence: number
  category: string
  prerequisites?: { taskKey: string }[] | null
  allowsParallel?: boolean | null
  waitingReason?: "cooling" | "freezing" | "chilling" | "setting" | null
  expectedMinutes?: number | null
  physicalCheckRequired?: boolean | null
  mandatory?: boolean | null
  state: TaskState
  startedAt?: string | null
  completedAt?: string | null
  waitingStartedAt?: string | null
  readinessConfirmedAt?: string | null
  blockedReason?: string | null
  qualityStatus?: "PENDING" | "PASSED" | "FAILED" | null
  qualityIssue?: string | null
}
export interface ProductionRun {
  id: string
  owner: string | User
  runId: string
  product: string | Product
  runType: "customer-order" | "planned-production"
  quantity?: number | null
  selectedProcess?: string | null
  status: TaskState
  version: number
  tasks: RunTask[]
  history?: {
    taskKey: string
    fromState: string
    toState: string
    reason?: string | null
    actor: string
    recordedAt: string
  }[] | null
  createdAt: string
  updatedAt: string
}
export interface PendingAction {
  id: string
  owner: string | User
  productionRun: string | ProductionRun
  taskKey: string
  expectedState: string
  proposedState: string
  actionType: "transition" | "correction" | "inspection"
  reason?: string | null
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "STALE"
  snapshotVersion: number
  createdAt: string
  updatedAt: string
}
