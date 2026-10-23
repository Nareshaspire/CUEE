import { spawn } from "node:child_process"

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}

try {
  await run("pnpm", ["run", "build"])
  const child = spawn(
    "pnpm",
    ["run", "preview"],
    { stdio: "inherit", env: process.env },
  )
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0)
  })
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
