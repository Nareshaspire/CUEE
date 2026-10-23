import {
  eligibleTasks,
  progressFor,
  recalculateReadiness,
  validateTransition,
} from "../src/lib/workflow.ts"
import { createAlexaSkillResponse } from "./skill.js"

const SESSION_COOKIE = "cue_session"
const CSRF_COOKIE = "cue_csrf"
const SESSION_SECONDS = 60 * 60 * 24 * 7
const ACCESS_SECONDS = 60 * 60
const REFRESH_SECONDS = 60 * 60 * 24 * 180
const PASSWORD_ITERATIONS = 210_000
const encoder = new TextEncoder()
const jsonHeaders = { "content-type": "application/json; charset=utf-8" }

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  })
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { location, ...headers } })
}

function fail(message, status = 400) {
  return json({ error: message }, status)
}

function base64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function fromBase64url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0))
}

async function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return base64url(value)
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return base64url(new Uint8Array(digest))
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64url(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  )
  return base64url(new Uint8Array(bits))
}

function equalText(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function cookie(request, name) {
  const prefix = `${name}=`
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
}

function setSessionCookies(token, csrf) {
  const secure = "; Secure; SameSite=Lax; Path=/"
  return [
    [`${SESSION_COOKIE}=${token}; HttpOnly${secure}; Max-Age=${SESSION_SECONDS}`],
    [`${CSRF_COOKIE}=${csrf}${secure}; Max-Age=${SESSION_SECONDS}`],
  ]
}

function clearSessionCookies() {
  const secure = "; Secure; SameSite=Lax; Path=/; Max-Age=0"
  return [
    [`${SESSION_COOKIE}=; HttpOnly${secure}`],
    [`${CSRF_COOKIE}=${secure}`],
  ]
}

function appendCookies(headers, values) {
  for (const [value] of values) headers.append("set-cookie", value)
  return headers
}

async function parseJson(request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > 32_768) throw new Error("Request body is too large.")
  const text = await request.text()
  if (text.length > 32_768) throw new Error("Request body is too large.")
  return text ? JSON.parse(text) : {}
}

function safeString(value, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : ""
}

async function sessionFor(request, env) {
  const raw = cookie(request, SESSION_COOKIE)
  if (!raw) return null
  const tokenHash = await hash(raw)
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.account_type, users.created_at,
            sessions.csrf_token, sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?`,
  ).bind(tokenHash).first()
  if (!row) return null
  if (row.expires_at <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run()
    return null
  }
  return {
    tokenHash,
    csrf: row.csrf_token,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      accountType: row.account_type,
      collection: "users",
      createdAt: row.created_at,
      updatedAt: row.created_at,
    },
  }
}

async function allowAuthAttempt(env, scope, identity, limit) {
  const now = Math.floor(Date.now() / 1000)
  const windowSeconds = 15 * 60
  const key = await hash(`${scope}:${identity}`)
  const result = await env.DB.prepare(
    `INSERT INTO auth_rate_limits (identity_hash, attempts, window_started, expires_at)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(identity_hash) DO UPDATE SET
       attempts = CASE
         WHEN auth_rate_limits.window_started <= ? THEN 1
         ELSE auth_rate_limits.attempts + 1
       END,
       window_started = CASE
         WHEN auth_rate_limits.window_started <= ? THEN excluded.window_started
         ELSE auth_rate_limits.window_started
       END,
       expires_at = CASE
         WHEN auth_rate_limits.window_started <= ? THEN excluded.expires_at
         ELSE auth_rate_limits.expires_at
       END
     RETURNING attempts`,
  ).bind(key, now, now + windowSeconds, now - windowSeconds, now - windowSeconds, now - windowSeconds).first()
  return result?.attempts <= limit
}

async function requireSession(request, env, csrf = false) {
  const session = await sessionFor(request, env)
  if (!session) return { response: fail("Sign in to continue.", 401) }
  if (csrf) {
    const origin = request.headers.get("origin")
    if (origin !== new URL(request.url).origin)
      return { response: fail("Request origin is not allowed.", 403) }
    if (
      !equalText(cookie(request, CSRF_COOKIE) ?? "", session.csrf) ||
      !equalText(request.headers.get("x-csrf-token") ?? "", session.csrf)
    )
      return { response: fail("Security token is missing or expired.", 403) }
  }
  return { session }
}

function userView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    collection: "users",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

async function createSession(env, userId) {
  const token = await randomToken()
  const csrf = await randomToken(24)
  const now = new Date().toISOString()
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(await hash(token), userId, csrf, Math.floor(Date.now() / 1000) + SESSION_SECONDS, now)
    .run()
  return { token, csrf }
}

function cookieResponse(body, session) {
  const headers = new Headers({
    ...jsonHeaders,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  })
  appendCookies(headers, setSessionCookies(session.token, session.csrf))
  return new Response(JSON.stringify(body), { headers })
}

async function issueUserSession(env, user) {
  const session = await createSession(env, user.id)
  return cookieResponse({ user: userView(user) }, session)
}

function hydrateRun(row) {
  const product = JSON.parse(row.product_json)
  return {
    id: row.id,
    owner: row.owner_id,
    runId: row.run_id,
    product,
    runType: row.run_type,
    quantity: row.quantity,
    selectedProcess: row.selected_process,
    status: row.status,
    version: row.version,
    tasks: JSON.parse(row.tasks),
    history: JSON.parse(row.history),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const RUN_SELECT = `SELECT runs.*, json_object(
  'id', products.id, 'name', products.name, 'slug', products.slug,
  'description', products.description, 'taskDefinitions', json(products.task_definitions),
  'createdAt', runs.created_at, 'updatedAt', runs.updated_at
) AS product_json FROM production_runs runs
JOIN products ON products.id = runs.product_id`

function makeRunId() {
  return `run-${crypto.randomUUID()}`
}

function instantiateTasks(product, initial = {}) {
  return product.taskDefinitions.map((definition) => ({
    taskKey: definition.key,
    name: definition.name,
    sequence: definition.sequence,
    category: definition.category,
    prerequisites: definition.prerequisites ?? [],
    allowsParallel: definition.allowsParallel ?? false,
    waitingReason: definition.waitingReason ?? undefined,
    expectedMinutes: definition.expectedMinutes ?? undefined,
    physicalCheckRequired: definition.physicalCheckRequired ?? false,
    mandatory: definition.mandatory ?? true,
    state: initial[definition.key] ?? (definition.sequence === 1 ? "READY" : "NOT_STARTED"),
    ...(initial[definition.key] === "COMPLETED" ? { completedAt: new Date().toISOString() } : {}),
    ...(initial[definition.key] === "WAITING" ? { waitingStartedAt: new Date().toISOString() } : {}),
  }))
}

async function getRun(env, userId, runId) {
  const row = await env.DB.prepare(`${RUN_SELECT} WHERE runs.id = ? AND runs.owner_id = ?`)
    .bind(runId, userId)
    .first()
  return row ? hydrateRun(row) : null
}

async function saveRun(env, userId, product, options = {}) {
  const now = new Date().toISOString()
  const id = makeRunId()
  const runId = `CUE-${id.slice(-6).toUpperCase()}`
  const tasks = instantiateTasks(product, options.initialStates)
  await env.DB.prepare(
    `INSERT INTO production_runs
      (id, owner_id, run_id, product_id, run_type, quantity, selected_process, status, version, tasks, history, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', 1, ?, '[]', ?, ?)`,
  ).bind(
    id, userId, runId, product.id, options.runType ?? "planned-production",
    options.quantity ?? 12, options.selectedProcess ?? null,
    JSON.stringify(tasks), now, now,
  ).run()
  return getRun(env, userId, id)
}

async function createDemoUser(env) {
  const userId = `demo-${crypto.randomUUID()}`
  const salt = await randomToken(16)
  const now = new Date().toISOString()
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, account_type, password_salt, password_hash, created_at) VALUES (?, ?, ?, 'demo', ?, ?, ?)",
  ).bind(
    userId, `${userId}@demo.invalid`, "Baker Demo", salt,
    await passwordHash(await randomToken(), salt), now,
  ).run()
  await seedDemoRuns(env, userId)
  const session = await createSession(env, userId)
  return { user: { id: userId, name: "Baker Demo", email: `${userId}@demo.invalid`, accountType: "demo", createdAt: now }, session }
}

async function seedDemoRuns(env, userId) {
  const result = await env.DB.prepare(
    `SELECT * FROM products
      ORDER BY CASE id
        WHEN 'product-pistachio' THEN 1
        WHEN 'product-cheesecake' THEN 2
        WHEN 'product-cookies' THEN 3 ELSE 4 END`,
  ).all()
  const rows = result.results ?? []
  const initialStates = [
    {
      "prepare-ingredients": "COMPLETED",
      "prepare-main": "COMPLETED",
      "cook-main": "COMPLETED",
      "prepare-packaging": "IN_PROGRESS",
      "cool-main": "WAITING",
    },
    {
      "prepare-ingredients": "COMPLETED",
      "prepare-main": "IN_PROGRESS",
      "prepare-packaging": "READY",
    },
    {
      "prepare-ingredients": "READY",
      "prepare-packaging": "READY",
    },
  ]
  for (const [index, productRow] of rows.entries()) {
    const product = {
      id: productRow.id,
      name: productRow.name,
      slug: productRow.slug,
      description: productRow.description,
      taskDefinitions: JSON.parse(productRow.task_definitions),
    }
    const states = initialStates[index] ?? {}
    const run = await saveRun(env, userId, product, {
      initialStates: states,
      runType: index === 0 ? "customer-order" : "planned-production",
      selectedProcess: "Baker-selected process",
      quantity: 12,
    })
    if (index === 0) {
      await env.DB.prepare(
        `UPDATE production_runs SET run_id = ? WHERE owner_id = ? AND product_id = ?`,
      ).bind("DEMO-HIO", userId, product.id).run()
      const run = await env.DB.prepare(
        "SELECT id FROM production_runs WHERE owner_id = ? AND product_id = ?",
      ).bind(userId, product.id).first()
      const now = new Date().toISOString()
      await env.DB.prepare(
        `INSERT INTO pending_actions
          (id, owner_id, run_id, task_key, expected_state, proposed_state, action_type, status, snapshot_version, created_at, updated_at)
         VALUES (?, ?, ?, 'prepare-packaging', 'IN_PROGRESS', 'COMPLETED', 'transition', 'PENDING', 1, ?, ?)`,
      ).bind(`pending-${crypto.randomUUID()}`, userId, run.id, now, now).run()
    }
  }
}

async function products(env) {
  const result = await env.DB.prepare("SELECT * FROM products ORDER BY name").all()
  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    taskDefinitions: JSON.parse(row.task_definitions),
  }))
}

function actionView(row) {
  return {
    id: row.id,
    owner: row.owner_id,
    productionRun: row.run_id,
    taskKey: row.task_key,
    expectedState: row.expected_state,
    proposedState: row.proposed_state,
    actionType: row.action_type,
    reason: row.reason ?? undefined,
    status: row.status,
    snapshotVersion: row.snapshot_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listActions(env, userId) {
  const result = await env.DB.prepare(
    "SELECT * FROM pending_actions WHERE owner_id = ? ORDER BY created_at DESC",
  ).bind(userId).all()
  return (result.results ?? []).map(actionView)
}

async function createProposal(env, userId, runId, input) {
  const run = await getRun(env, userId, runId)
  if (!run) return fail("That task or run is no longer available.", 404)
  const taskKey = safeString(input.taskKey, 100)
  const proposedState = safeString(input.proposedState, 40)
  const task = run.tasks.find((item) => item.taskKey === taskKey)
  if (!task) return fail("That task or run is no longer available.", 404)
  const validation = validateTransition(run, taskKey, proposedState)
  if (!validation.ok) return fail(validation.error, 409)
  const reason = safeString(input.reason, 500)
  const requestedType = safeString(input.actionType, 40)
  if (requestedType === "correction" && !reason)
    return fail("A correction requires a reason.")
  const actionType =
    requestedType === "correction"
      ? "correction"
      : requestedType === "inspection" || (task.physicalCheckRequired && proposedState === "COMPLETED")
        ? "inspection"
        : "transition"
  const existing = await env.DB.prepare(
    "SELECT id FROM pending_actions WHERE owner_id = ? AND run_id = ? AND task_key = ? AND status = 'PENDING' LIMIT 1",
  ).bind(userId, runId, taskKey).first()
  if (existing) return fail("Review or cancel the pending confirmation first.", 409)
  const id = `pending-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  try {
    await env.DB.prepare(
      `INSERT INTO pending_actions
        (id, owner_id, run_id, task_key, expected_state, proposed_state, action_type, reason, status, snapshot_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    ).bind(id, userId, runId, taskKey, task.state, proposedState, actionType, reason || null, run.version, now, now).run()
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return fail("Review or cancel the pending confirmation first.", 409)
    throw error
  }
  return json({ ok: true, action: { id, taskKey, proposedState, actionType } }, 201)
}

function applyAction(run, action, user) {
  const now = new Date().toISOString()
  const tasks = run.tasks.map((item) => {
    if (item.taskKey !== action.task_key) return item
    const nextState = action.proposed_state
    return {
      ...item,
      state: nextState,
      startedAt: nextState === "IN_PROGRESS" ? now : item.startedAt,
      waitingStartedAt: nextState === "WAITING" ? now : item.waitingStartedAt,
      completedAt: nextState === "COMPLETED" ? now : undefined,
      readinessConfirmedAt: action.action_type === "inspection" && nextState === "COMPLETED" ? now : item.readinessConfirmedAt,
      blockedReason: nextState === "BLOCKED" ? action.reason : undefined,
      qualityStatus: action.action_type === "inspection"
        ? nextState === "COMPLETED" ? "PASSED" : nextState === "BLOCKED" ? "FAILED" : item.qualityStatus
        : item.qualityStatus,
      qualityIssue: action.action_type === "inspection" && nextState === "BLOCKED" ? action.reason : item.qualityIssue,
    }
  })
  const refreshed = recalculateReadiness(tasks, run.selectedProcess)
  const complete = refreshed
    .filter((item) => item.mandatory !== false)
    .every((item) => item.state === "COMPLETED")
  return {
    tasks: refreshed,
    status: complete ? "COMPLETED" : "IN_PROGRESS",
    version: run.version + 1,
    history: [
      ...(run.history ?? []),
      {
        taskKey: action.task_key,
        fromState: action.expected_state,
        toState: action.proposed_state,
        reason: action.reason ?? undefined,
        actor: user.name,
        actionId: action.id,
        recordedAt: now,
      },
    ],
    updatedAt: now,
  }
}

async function resolveAction(env, user, actionId, confirm) {
  const action = await env.DB.prepare(
    "SELECT * FROM pending_actions WHERE id = ? AND owner_id = ? AND status = 'PENDING'",
  ).bind(actionId, user.id).first()
  if (!action) return fail("That proposal is no longer available.", 404)
  const run = await getRun(env, user.id, action.run_id)
  const task = run?.tasks.find((item) => item.taskKey === action.task_key)
  if (!run || !task) return fail("That proposal is no longer available.", 404)
  const now = new Date().toISOString()
  if (run.version !== action.snapshot_version || task.state !== action.expected_state) {
    await env.DB.prepare(
      "UPDATE pending_actions SET status = 'STALE', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'PENDING'",
    ).bind(now, actionId, user.id).run()
    return fail("The run changed. Review its latest state before trying again.", 409)
  }
  if (!confirm) {
    await env.DB.prepare(
      "UPDATE pending_actions SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'PENDING'",
    ).bind(now, actionId, user.id).run()
    return json({ ok: true })
  }
  const validation = validateTransition(run, action.task_key, action.proposed_state)
  if (!validation.ok) return fail(validation.error, 409)
  const next = applyAction(run, action, user)
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE production_runs SET tasks = ?, status = ?, history = ?, version = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND version = ?
          AND EXISTS (
            SELECT 1 FROM pending_actions
             WHERE pending_actions.id = ? AND pending_actions.owner_id = ?
               AND pending_actions.status = 'PENDING'
               AND pending_actions.snapshot_version = ?
          )`,
    ).bind(
      JSON.stringify(next.tasks), next.status, JSON.stringify(next.history),
      next.version, next.updatedAt, run.id, user.id, run.version,
      actionId, user.id, run.version,
    ),
    env.DB.prepare(
      `UPDATE pending_actions SET status = 'CONFIRMED', updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'PENDING' AND snapshot_version = ?
          AND EXISTS (
            SELECT 1 FROM production_runs
             WHERE production_runs.id = pending_actions.run_id
               AND production_runs.version = ?
               AND EXISTS (
                 SELECT 1 FROM json_each(production_runs.history)
                  WHERE json_extract(json_each.value, '$.actionId') = ?
               )
          )`,
    ).bind(now, actionId, user.id, run.version, run.version + 1, actionId),
  ])
  if (results.some((result) => result.meta.changes !== 1))
    return fail("The run changed. Review its latest state before trying again.", 409)
  return json({ ok: true, run: { ...run, ...next } })
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

async function register(request, env) {
  const body = await parseJson(request)
  const email = safeString(body.email, 254).toLowerCase()
  const name = safeString(body.name, 100)
  const password = typeof body.password === "string" ? body.password : ""
  if (!name || !validEmail(email) || password.length < 12 || password.length > 1024)
    return fail("Add your name, a valid email, and a password of at least 12 characters.")
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown"
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowAuthAttempt(env, "register-ip", ip, 5),
    allowAuthAttempt(env, "register-email", email, 3),
  ])
  if (!ipAllowed || !emailAllowed)
    return fail("Too many account attempts. Try again in 15 minutes.", 429)
  const salt = await randomToken(16)
  const user = {
    id: `user-${crypto.randomUUID()}`,
    email,
    name,
    accountType: "baker",
    createdAt: new Date().toISOString(),
  }
  try {
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, account_type, password_salt, password_hash, created_at) VALUES (?, ?, ?, 'baker', ?, ?, ?)",
    ).bind(user.id, email, name, salt, await passwordHash(password, salt), user.createdAt).run()
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return fail("An account already exists for this email.", 409)
    throw error
  }
  return issueUserSession(env, user)
}

async function login(request, env) {
  const body = await parseJson(request)
  const email = safeString(body.email, 254).toLowerCase()
  const password = typeof body.password === "string" ? body.password : ""
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown"
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowAuthAttempt(env, "login-ip", ip, 12),
    allowAuthAttempt(env, "login-email", email, 8),
  ])
  if (!ipAllowed || !emailAllowed)
    return fail("Too many sign-in attempts. Try again in 15 minutes.", 429)
  const row = await env.DB.prepare(
    "SELECT id, email, name, account_type, password_salt, password_hash, created_at FROM users WHERE email = ?",
  ).bind(email).first()
  const salt = row?.password_salt ?? "AAAAAAAAAAAAAAAAAAAAAA"
  const supplied = await passwordHash(password, salt)
  if (!row || !equalText(supplied, row.password_hash))
    return fail("Those credentials did not match a CUE account.", 401)
  return issueUserSession(env, {
    id: row.id,
    email: row.email,
    name: row.name,
    accountType: row.account_type,
    createdAt: row.created_at,
  })
}

function authRedirect(request) {
  const url = new URL(request.url)
  const returnTo = `${url.pathname}${url.search}`
  const signin = new URL("/auth/signin/", url.origin)
  signin.searchParams.set("returnTo", returnTo)
  return redirect(signin.toString())
}

function validRedirectUri(value, env) {
  const allowed = (env.ALEXA_REDIRECT_URIS ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  return allowed.includes(value)
}

async function authorizeGet(request, env) {
  const url = new URL(request.url)
  const required = ["client_id", "redirect_uri", "response_type", "state", "code_challenge", "code_challenge_method"]
  if (required.some((key) => !url.searchParams.get(key)))
    return fail("Authorization request is missing required parameters.")
  if (
    url.searchParams.get("client_id") !== env.ALEXA_CLIENT_ID ||
    url.searchParams.get("response_type") !== "code" ||
    url.searchParams.get("code_challenge_method") !== "S256" ||
    !validRedirectUri(url.searchParams.get("redirect_uri"), env)
  ) return fail("This skill authorization request is not allowed.", 400)
  const challenge = url.searchParams.get("code_challenge")
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge))
    return fail("Invalid PKCE challenge.", 400)
  if (!/^[A-Za-z0-9._~-]{16,256}$/.test(url.searchParams.get("state")))
    return fail("Invalid authorization state.", 400)
  if (!(await sessionFor(request, env))) return authRedirect(request)
  const consent = new URL("/auth/alexa-consent/", url.origin)
  for (const key of required) consent.searchParams.set(key, url.searchParams.get(key))
  return redirect(consent.toString())
}

async function authorizePost(request, env, user) {
  const body = await parseJson(request)
  const clientId = safeString(body.client_id, 200)
  const redirectUri = safeString(body.redirect_uri, 1000)
  const challenge = safeString(body.code_challenge, 100)
  const state = safeString(body.state, 256)
  if (
    clientId !== env.ALEXA_CLIENT_ID ||
    body.response_type !== "code" ||
    body.code_challenge_method !== "S256" ||
    !validRedirectUri(redirectUri, env) ||
    !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
    !/^[A-Za-z0-9._~-]{16,256}$/.test(state)
  ) return fail("This skill authorization request is not allowed.", 400)
  const code = await randomToken(32)
  const now = new Date()
  await env.DB.prepare(
    "INSERT INTO oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(
    await hash(code), user.id, clientId, redirectUri, challenge,
    Math.floor(now.getTime() / 1000) + 300,
  ).run()
  const callback = new URL(redirectUri)
  callback.searchParams.set("code", code)
  callback.searchParams.set("state", state)
  return json({ redirect: callback.toString() })
}

function parseBasicAuth(header) {
  if (!header?.startsWith("Basic ")) return null
  try {
    const decoded = atob(header.slice(6))
    const colon = decoded.indexOf(":")
    return colon > 0 ? [decoded.slice(0, colon), decoded.slice(colon + 1)] : null
  } catch {
    return null
  }
}

async function exchangeToken(request, env) {
  if (!env.ALEXA_CLIENT_ID || !env.ALEXA_CLIENT_SECRET)
    return fail("Alexa account linking is not configured.", 503)
  const credentials = parseBasicAuth(request.headers.get("authorization"))
  if (!credentials || credentials[0] !== env.ALEXA_CLIENT_ID ||
      !equalText(credentials[1], env.ALEXA_CLIENT_SECRET))
    return fail("Invalid OAuth client credentials.", 401)
  if (Number(request.headers.get("content-length") ?? 0) > 8192)
    return fail("Request body is too large.", 413)
  const formBody = await request.text()
  if (formBody.length > 8192) return fail("Request body is too large.", 413)
  const form = new URLSearchParams(formBody)
  const grantType = form.get("grant_type")
  if (grantType === "authorization_code") {
    const code = form.get("code") ?? ""
    const verifier = form.get("code_verifier") ?? ""
    const redirectUri = form.get("redirect_uri") ?? ""
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))
      return fail("Invalid PKCE verifier.")
    const challenge = await hash(verifier)
    const row = await env.DB.prepare(
      "SELECT * FROM oauth_codes WHERE code_hash = ? AND client_id = ? AND redirect_uri = ? AND expires_at > ? AND used_at IS NULL",
    ).bind(await hash(code), env.ALEXA_CLIENT_ID, redirectUri, Math.floor(Date.now() / 1000)).first()
    if (!row || !equalText(challenge, row.code_challenge))
      return fail("Authorization code is invalid or expired.", 400)
    const used = await env.DB.prepare(
      "UPDATE oauth_codes SET used_at = ? WHERE code_hash = ? AND expires_at > ? AND used_at IS NULL",
    ).bind(Date.now(), row.code_hash, Math.floor(Date.now() / 1000)).run()
    if (used.meta.changes !== 1) return fail("Authorization code is invalid or expired.", 400)
    const familyId = crypto.randomUUID()
    return issueAlexaTokens(env, row.user_id, familyId)
  }
  if (grantType === "refresh_token") {
    const oldRefresh = form.get("refresh_token") ?? ""
    const oldHash = await hash(oldRefresh)
    const row = await env.DB.prepare(
      "SELECT user_id, family_id FROM alexa_tokens WHERE token_hash = ? AND token_type = 'refresh' AND expires_at > ?",
    ).bind(oldHash, Math.floor(Date.now() / 1000)).first()
    if (!row) return fail("Refresh token is invalid or expired.", 400)
    const deleted = await env.DB.prepare(
      "DELETE FROM alexa_tokens WHERE token_hash = ? AND token_type = 'refresh'",
    ).bind(oldHash).run()
    if (deleted.meta.changes !== 1) return fail("Refresh token is invalid or expired.", 400)
    return issueAlexaTokens(env, row.user_id, row.family_id)
  }
  return fail("Unsupported OAuth grant type.", 400)
}

async function issueAlexaTokens(env, userId, familyId) {
  const access = await randomToken()
  const refresh = await randomToken()
  const now = Math.floor(Date.now() / 1000)
  const created = new Date(now * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO alexa_tokens (token_hash, user_id, token_type, family_id, expires_at, created_at) VALUES (?, ?, 'access', ?, ?, ?)",
    ).bind(await hash(access), userId, familyId, now + ACCESS_SECONDS, created),
    env.DB.prepare(
      "INSERT INTO alexa_tokens (token_hash, user_id, token_type, family_id, expires_at, created_at) VALUES (?, ?, 'refresh', ?, ?, ?)",
    ).bind(await hash(refresh), userId, familyId, now + REFRESH_SECONDS, created),
  ])
  return json({
    access_token: access,
    token_type: "bearer",
    expires_in: ACCESS_SECONDS,
    refresh_token: refresh,
  })
}

async function alexaUser(env, accessToken) {
  if (!accessToken) return null
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.account_type, users.created_at
       FROM alexa_tokens JOIN users ON users.id = alexa_tokens.user_id
      WHERE alexa_tokens.token_hash = ? AND alexa_tokens.token_type = 'access'
        AND alexa_tokens.expires_at > ?`,
  ).bind(await hash(accessToken), Math.floor(Date.now() / 1000)).first()
  return row ? {
    id: row.id,
    email: row.email,
    name: row.name,
    accountType: row.account_type,
    createdAt: row.created_at,
  } : null
}

async function alexaRuns(env, userId) {
  const rows = await env.DB.prepare(`${RUN_SELECT} WHERE runs.owner_id = ? ORDER BY runs.updated_at DESC`)
    .bind(userId).all()
  return (rows.results ?? []).map(hydrateRun)
}

async function alexaProposal(env, user, run, taskName, proposedState) {
  const task = run.tasks.find(
    (item) => item.name.toLowerCase() === taskName.trim().toLowerCase() ||
      item.taskKey.toLowerCase() === taskName.trim().toLowerCase(),
  )
  if (!task) return { error: `I could not find a task named ${taskName}.` }
  const validation = validateTransition(run, task.taskKey, proposedState)
  if (!validation.ok) return { error: validation.error }
  const existing = await env.DB.prepare(
    "SELECT id FROM pending_actions WHERE owner_id = ? AND run_id = ? AND task_key = ? AND status = 'PENDING' LIMIT 1",
  ).bind(user.id, run.id, task.taskKey).first()
  if (existing) return { error: "There is already an update waiting for confirmation on that task." }
  const id = `pending-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const inspection = task.physicalCheckRequired && proposedState === "COMPLETED"
  try {
    await env.DB.prepare(
      `INSERT INTO pending_actions
        (id, owner_id, run_id, task_key, expected_state, proposed_state, action_type, status, snapshot_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    ).bind(
      id, user.id, run.id, task.taskKey, task.state, proposedState,
      inspection ? "inspection" : "transition", run.version, now, now,
    ).run()
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return { error: "There is already an update waiting for confirmation on that task." }
    throw error
  }
  return { id, task, inspection }
}

function linesForIntent(intentName, run) {
  if (intentName === "StatusIntent") {
    const complete = run.tasks.filter((task) => task.state === "COMPLETED")
    return `${run.runId} is ${progressFor(run)} percent complete. ${complete.length} of ${run.tasks.filter((task) => task.mandatory !== false).length} required tasks are recorded as completed.`
  }
  if (intentName === "NextStepsIntent") {
    const eligible = eligibleTasks(run)
    return eligible.length
      ? `You can work on ${eligible.map((task) => task.name).join(", ")}. These tasks have their recorded prerequisites completed.`
      : `There are no newly eligible tasks recorded for ${run.runId}.`
  }
  if (intentName === "WaitingIntent") {
    const waiting = run.tasks.filter((task) => task.state === "WAITING")
    return waiting.length
      ? waiting.map((task) => `${task.name} is waiting for ${task.waitingReason ?? "a recorded wait"}${task.physicalCheckRequired ? " and needs a human physical check before completion" : ""}`).join(". ")
      : `There are no tasks recorded as waiting for ${run.runId}.`
  }
  if (intentName === "BlockersIntent") {
    const blocked = run.tasks.filter((task) => task.state === "BLOCKED")
    const unmet = run.tasks.flatMap((task) => {
      if (task.state !== "NOT_STARTED") return []
      const missing = (task.prerequisites ?? [])
        .filter((prerequisite) => !run.tasks.some(
          (candidate) => candidate.taskKey === prerequisite.taskKey && candidate.state === "COMPLETED",
        ))
      return missing.length ? [`${task.name} is waiting on ${missing.map((item) => item.taskKey).join(", ")}`] : []
    })
    return [...blocked.map((task) => `${task.name} is blocked: ${task.blockedReason ?? "no reason recorded"}`), ...unmet].join(". ") ||
      `No blockers are recorded for ${run.runId}.`
  }
  return `Here is the recorded status for ${run.runId}: ${progressFor(run)} percent complete.`
}

async function handleAlexa(request, env) {
  if (!env.ALEXA_SKILL_ID)
    return fail("Alexa skill endpoint is not configured.", 503)
  const rawBody = await request.text()
  if (rawBody.length > 64_000) return fail("Request body is too large.", 413)
  const verifier = new (await import("ask-sdk-express-adapter")).SkillRequestSignatureVerifier()
  const timestampVerifier = new (await import("ask-sdk-express-adapter")).TimestampVerifier()
  try {
    await verifier.verify(rawBody, Object.fromEntries(request.headers.entries()))
    await timestampVerifier.verify(rawBody)
    const timestamp = new Date(JSON.parse(rawBody)?.request?.timestamp).getTime()
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 150_000)
      return fail("Alexa request timestamp is outside the accepted window.", 401)
  } catch {
    return fail("Alexa request signature or timestamp is invalid.", 401)
  }
  const envelope = JSON.parse(rawBody)
  const applicationId = envelope?.context?.System?.application?.applicationId ??
    envelope?.session?.application?.applicationId
  if (applicationId !== env.ALEXA_SKILL_ID)
    return fail("Alexa skill ID does not match this endpoint.", 403)
  const body = await createAlexaSkillResponse(envelope, {
    getUser: (accessToken) => alexaUser(env, accessToken),
    getRuns: (userId) => alexaRuns(env, userId),
    createProposal: (user, run, taskName, state) => alexaProposal(env, user, run, taskName, state),
    resolveProposal: (user, actionId, confirm) => resolveAction(env, user, actionId, confirm),
  })
  return json(body)
}

export async function handleApi(request, env) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "") || "health"
  const method = request.method.toUpperCase()

  try {
    if (method === "GET" && path === "health")
      return json({ ok: true, service: "cue-api" })
    if (method === "POST" && path === "auth/register")
      return register(request, env)
    if (method === "POST" && path === "auth/login")
      return login(request, env)
    if (method === "POST" && path === "auth/demo") {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown"
      if (!(await allowAuthAttempt(env, "demo-ip", ip, 20)))
        return fail("Too many demo sessions requested. Try again in 15 minutes.", 429)
      const { user, session } = await createDemoUser(env)
      return cookieResponse({ user: userView(user) }, session)
    }
    if (method === "GET" && path === "auth/me") {
      const session = await sessionFor(request, env)
      return session ? json({ user: userView(session.user) }, 200, { "x-cue-csrf": session.csrf }) : fail("Sign in to continue.", 401)
    }
    if (method === "POST" && path === "auth/logout") {
      const auth = await requireSession(request, env, true)
      if (auth.response) return auth.response
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(auth.session.tokenHash).run()
      const headers = appendCookies(new Headers(jsonHeaders), clearSessionCookies())
      return new Response(JSON.stringify({ ok: true }), { headers })
    }
    if (method === "GET" && path === "products")
      return json({ products: await products(env) })
    if (method === "GET" && path === "oauth/authorize")
      return authorizeGet(request, env)
    if (method === "POST" && path === "oauth/authorize") {
      const auth = await requireSession(request, env, true)
      if (auth.response) return auth.response
      return authorizePost(request, env, auth.session.user)
    }
    if (method === "POST" && path === "oauth/token")
      return exchangeToken(request, env)
    if (method === "POST" && path === "alexa")
      return handleAlexa(request, env)

    const auth = await requireSession(request, env, method !== "GET")
    if (auth.response) return auth.response
    const user = auth.session.user

    if (method === "GET" && path === "runs") {
      const rows = await env.DB.prepare(`${RUN_SELECT} WHERE runs.owner_id = ? ORDER BY runs.updated_at DESC`)
        .bind(user.id).all()
      return json({ runs: (rows.results ?? []).map(hydrateRun), pendingActions: await listActions(env, user.id) })
    }
    if (method === "POST" && path === "runs") {
      const body = await parseJson(request)
      const productId = safeString(body.productId, 100)
      const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first()
      if (!row) return fail("Choose a valid product.", 400)
      const product = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        taskDefinitions: JSON.parse(row.task_definitions),
      }
      const run = await saveRun(env, user.id, product, {
        runType: body.runType === "customer-order" ? "customer-order" : "planned-production",
        quantity: Number.isInteger(body.quantity) && body.quantity > 0 && body.quantity <= 10000 ? body.quantity : 12,
        selectedProcess: safeString(body.selectedProcess, 120) || null,
      })
      return json({ run }, 201)
    }
    if (method === "POST" && path === "demo/reset") {
      if (user.accountType !== "demo") return fail("Reset is available only in a demo workspace.", 403)
      await env.DB.batch([
        env.DB.prepare("DELETE FROM pending_actions WHERE owner_id = ?").bind(user.id),
        env.DB.prepare("DELETE FROM production_runs WHERE owner_id = ?").bind(user.id),
      ])
      await seedDemoRuns(env, user.id)
      return json({ ok: true })
    }
    const proposalMatch = path.match(/^runs\/([^/]+)\/proposals$/)
    if (method === "POST" && proposalMatch)
      return createProposal(env, user.id, decodeURIComponent(proposalMatch[1]), await parseJson(request))
    const actionMatch = path.match(/^actions\/([^/]+)\/confirm$/)
    if (method === "POST" && actionMatch) {
      const body = await parseJson(request)
      if (typeof body.confirm !== "boolean") return fail("Choose whether to confirm or cancel.")
      return resolveAction(env, user, decodeURIComponent(actionMatch[1]), body.confirm)
    }
    if (method === "POST" && path === "assistant") {
      const body = await parseJson(request)
      const input = safeString(body.query, 500)
      if (!input) return fail("Enter a question.")
      const lower = input.toLowerCase()
      const listed = await env.DB.prepare(`${RUN_SELECT} WHERE runs.owner_id = ? ORDER BY runs.updated_at DESC`)
        .bind(user.id).all()
      const runs = (listed.results ?? []).map(hydrateRun)
      const matches = runs.filter((candidate) =>
        lower.includes(candidate.runId.toLowerCase()) ||
        lower.includes(candidate.product.name.toLowerCase()),
      )
      if (matches.length > 1) {
        return json({
          kind: "clarifying",
          answer: `Which production run do you mean? ${matches.map((candidate) => `${candidate.runId} — ${candidate.product.name}`).join("; ")}.`,
        })
      }
      const mentionsRunId = /\b(?:demo|cue)-[a-z0-9-]+\b/i.test(input)
      if (mentionsRunId && matches.length === 0)
        return json({ kind: "clarifying", answer: `I could not find that run. Choose one of: ${runs.map((candidate) => candidate.runId).join(", ")}.` })
      const run = matches[0] ?? runs.find((candidate) => candidate.id === safeString(body.runId, 100))
      if (!run) return fail("That production run is not available.", 404)
      if (/\b(customer|client|buyer)\b/.test(lower) && /\b(update|message|email|text|draft|write)\b/.test(lower)) {
        const { buildAlexaResponse } = await import("../src/lib/alexa.ts")
        return json({ kind: "customer-draft", answer: buildAlexaResponse(input, run) })
      }
      if (/\b(next|ready|eligible)\b/.test(lower)) {
        return json({ kind: "answer", answer: eligibleTasks(run).map((task) => task.name).join(", ") || "No tasks are newly eligible." })
      }
      if (/\b(wait|waiting)\b/.test(lower)) {
        return json({ kind: "answer", answer: run.tasks.filter((task) => task.state === "WAITING").map((task) => `${task.name}: ${task.waitingReason ?? "waiting"}`).join(". ") || "No tasks are waiting." })
      }
      if (/\b(block|blocked|why)\b/.test(lower)) {
        return json({ kind: "answer", answer: run.tasks.filter((task) => task.state === "BLOCKED").map((task) => `${task.name}: ${task.blockedReason ?? "no reason recorded"}`).join(". ") || "No blockers are recorded." })
      }
      return json({ kind: "answer", answer: `${run.runId} is ${progressFor(run)}% complete.` })
    }
    return fail("Endpoint not found.", 404)
  } catch (error) {
    console.error("CUE API request failed", {
      path,
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof SyntaxError) return fail("Request body must be valid JSON.")
    if (error instanceof Error && error.message === "Request body is too large.")
      return fail(error.message, 413)
    return fail("The request could not be completed.", 500)
  }
}
