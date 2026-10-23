"use server"

import { randomBytes, randomUUID } from "node:crypto"
import { appAuth } from "@/lib/app-auth"
import { getPayloadClient } from "@/lib/payload"
import { instantiateTasks } from "@/lib/workflow"
import type { Product, ProductionRun } from "@/payload-types"

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim()
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email").toLowerCase()
  const password = field(formData, "password")
  if (!email || !password) {
    return { ok: false as const, error: "Enter your email and password." }
  }

  try {
    await appAuth.login(email, password)
  } catch {
    return {
      ok: false as const,
      error: "Those credentials did not match a CUE account.",
    }
  }
  return { ok: true as const }
}

export async function signUp(formData: FormData) {
  const name = field(formData, "name")
  const email = field(formData, "email").toLowerCase()
  const password = field(formData, "password")
  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8
  ) {
    return {
      ok: false as const,
      error:
        "Add your name, a valid email, and a password of at least 8 characters.",
    }
  }

  const payload = await getPayloadClient()
  try {
    await payload.create({
      collection: "users",
      data: { name, email, password, accountType: "baker" },
      draft: false,
      overrideAccess: false,
    })
    await appAuth.login(email, password)
  } catch {
    return {
      ok: false as const,
      error:
        "That account could not be created. The email may already be registered.",
    }
  }
  return { ok: true as const }
}

function setDemoState(tasks: ProductionRun["tasks"], productSlug: string) {
  const now = new Date().toISOString()
  const complete = (key: string) => {
    const task = tasks.find((item) => item.taskKey === key)
    if (!task) return
    task.state = "COMPLETED"
    task.completedAt = now
    if (task.physicalCheckRequired) task.readinessConfirmedAt = now
  }

  if (productSlug === "chewy-pistachio-crunchies") {
    ;["defrost-kataifi", "combine-butter", "bake-kataifi"].forEach(complete)
    const packaging = tasks.find((task) => task.taskKey === "prepare-packaging")
    if (packaging) {
      packaging.state = "IN_PROGRESS"
      packaging.startedAt = now
    }
    const cooling = tasks.find((task) => task.taskKey === "cool-kataifi")
    if (cooling) {
      cooling.state = "WAITING"
      cooling.waitingStartedAt = now
    }
  } else if (productSlug === "no-bake-cheesecake-biscoff") {
    ;["prepare-ingredients", "temper-cream-cheese", "prepare-crust"].forEach(
      complete,
    )
    const chill = tasks.find((task) => task.taskKey === "chill-crust")
    if (chill) chill.state = "NEEDS_INSPECTION"
    const filling = tasks.find((task) => task.taskKey === "prepare-filling")
    if (filling) {
      filling.state = "IN_PROGRESS"
      filling.startedAt = now
    }
  } else {
    ;["prepare-ingredients", "brown-butter"].forEach(complete)
    const cooling = tasks.find((task) => task.taskKey === "cool-butter")
    if (cooling) {
      cooling.state = "BLOCKED"
      cooling.blockedReason =
        "Cooling readiness has not been physically checked."
    }
  }
  return tasks
}

export async function startDemo() {
  if (await appAuth.currentUser()) return { ok: true as const }

  const payload = await getPayloadClient()
  const suffix = randomUUID()
  const email = `demo+${suffix}@cue.local`
  const password = randomBytes(24).toString("base64url")
  let demoId: string | number | undefined
  try {
    const demo = await payload.create({
      collection: "users",
      data: {
        name: "Baker Demo",
        email,
        password,
        accountType: "demo",
      },
      overrideAccess: true,
    })
    demoId = demo.id
    const user = await appAuth.login(email, password)
    const authUser = { ...user, id: demo.id, collection: "users" as const }
    const products = await payload.find({
      collection: "products",
      depth: 0,
      limit: 10,
      sort: "name",
      user: authUser,
      overrideAccess: false,
    })

    let firstRun: ProductionRun | null = null
    for (const product of products.docs as Product[]) {
      const tasks = setDemoState(instantiateTasks(product), product.slug)
      const run = await payload.create({
        collection: "production-runs",
        data: {
          owner: demo.id,
          runId: `DEMO-${product.slug
            .split("-")
            .map((part) => part[0])
            .join("")
            .toUpperCase()}-${suffix.slice(0, 4)}`,
          product: product.id,
          runType:
            product.slug === "belgian-chocolate-chip-cookies"
              ? "planned-production"
              : "customer-order",
          quantity: product.slug === "no-bake-cheesecake-biscoff" ? 8 : 24,
          selectedProcess:
            product.slug === "chewy-pistachio-crunchies"
              ? "Baker-selected freezing process"
              : undefined,
          status: "IN_PROGRESS",
          version: 1,
          tasks,
          history: [],
        },
        user: authUser,
        overrideAccess: false,
      })
      if (product.slug === "chewy-pistachio-crunchies")
        firstRun = (run as ProductionRun)
    }

    if (firstRun) {
      await payload.create({
        collection: "pending-actions",
        data: {
          owner: demo.id,
          productionRun: firstRun.id,
          taskKey: "prepare-packaging",
          expectedState: "IN_PROGRESS",
          proposedState: "COMPLETED",
          actionType: "transition",
          reason:
            "Demo confirmation: packaging preparation is ready to complete.",
          status: "PENDING",
          snapshotVersion: firstRun.version,
        },
        user: authUser,
        overrideAccess: false,
      })
    }
    return { ok: true as const }
  } catch {
    if (demoId !== undefined) {
      await payload.delete({
        collection: "pending-actions",
        where: { owner: { equals: demoId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: "production-runs",
        where: { owner: { equals: demoId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: "users",
        id: demoId,
        overrideAccess: true,
      })
      await appAuth.logout()
    }
    return {
      ok: false as const,
      error: "The demo workspace could not be prepared. Please try again.",
    }
  }
}
