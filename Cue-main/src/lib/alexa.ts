import type { ProductionRun } from "@/lib/demo-types"
import { productName, progressFor } from "@/lib/workflow"

function customerContext(value: string) {
  const statedContext = value.match(
    /\b(?:tell|inform)\s+(?:the\s+)?(?:customer|client|buyer)\s+(?:that\s+)?(.+?)["”]?[.!?]*$/i,
  )
  const additionalContext = value.match(
    /\b(?:saying|say|mentioning|mention|including|include|explaining|explain|because|due to)\s*[:,-]?\s*["“]?(.+?)["”]?[.!?]*$/i,
  )
  return (statedContext?.[1] ?? additionalContext?.[1])?.trim()
}

export function buildAlexaResponse(input: string, run: ProductionRun) {
  const required = run.tasks.filter((task) => task.mandatory !== false)
  const completed = required.filter((task) => task.state === "COMPLETED")
  const context = customerContext(input)
  const progressText = required.length
    ? `${progressFor(run)}% of the planned production steps are recorded as complete (${completed.length} of ${required.length}).`
    : "No required production steps are configured in the current production record."

  return [
    `Hello! Here's a quick update on ${productName(run)}: ${progressText}`,
    context ? `Additional detail you provided: ${context}` : "",
    "This update reflects the production record currently available.",
  ]
    .filter(Boolean)
    .join("\n\n")
}
