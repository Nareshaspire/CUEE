# CUE: Three-Minute Product Demo Script

## Part A: Repository and demo verification

Reviewed `README.md`, `package.json`, the sign-in route and `DemoButton`, the app route, `DashboardClient`, `demo-data.ts`, `workflow.ts`, `demo-storage.ts`, `demo-types.ts`, and the demo/workflow tests.

Use the first sample run: **DEMO-HIO — Chewy Pistachio Crunchies**, a fictional 12-unit customer order. Its initial record shows ingredient preparation, main-component preparation, and cooking complete; packaging in progress; cooling waiting; and the subsequent inspection and finishing tasks not started. Cooling has a recorded 45-minute estimate and requires a physical check. The “main component” and other task names are generic: the code does not model kataifi or a recipe-specific filling step.

The verified code path supports the chat prompts **“What is waiting?”** and **“What can I do next?”** The first reports the cooling stage, its recorded start and estimate, and the physical-check requirement. The second says packaging is already underway and may continue; it keeps later inspection work unavailable until its prerequisite is complete. The board’s **Confirm After Inspection** action creates a review proposal; confirming it records the cooling task complete and makes the next inspection task ready. Chat and board derive from the same browser-local demo state. Existing tests cover the seeded run, pending confirmation, cancellation, and workflow rules; a targeted runtime check confirmed this exact state path.

This is a deterministic keyword-matching chat, fictional sample data, and browser-local storage—not an open-ended AI, Alexa hardware integration, shared backend, validated recipe, timer, or food sensor. The seeded workspace includes a packaging-completion proposal; cancel it during setup so the recording begins with a clean board. Browser automation could not capture the available browser window, so labels and results were traced in source and tests rather than clicked live. Avoid claims of measured time savings, error reduction, food readiness, or product-market fit.

## Part B: Research-backed opening

**Statistic:** The Philippine Statistics Authority’s final results for the 2022 Annual Survey of Philippine Business and Industry counted **30,861 formal-sector establishments** in accommodation and food-service activities in reference year **2022**. Within that sector, restaurants and mobile food services accounted for 23,242 establishments (75.3%). The release was published **September 16, 2025**.

**Source:** Philippine Statistics Authority, [2022 ASPBI: Accommodation and Food Service Activities Section — Final Results](https://psa.gov.ph/content/2022-annual-survey-philippine-business-and-industry-aspbi-accommodation-and-food-service-0), released September 16, 2025 (Reference No. 2025-SSO-130).

This is context about the formal-sector accommodation and food-service landscape, not a count of solo bakers and not evidence that Bookiery has a tracking problem.

**Opening wording:** “The PSA counted 30,861 formal-sector accommodation and food-service establishments in the Philippines in 2022. That’s context, not proof of a problem at Bookiery. For one baker, though, a tray in the oven and another component cooling can compete for attention.”

## Part C: Three-minute script

| Timestamp | Spoken narration | On-screen action | Demo verification |
|---|---|---|---|
| **0:00–0:20** | The PSA counted 30,861 formal-sector accommodation and food-service establishments in the Philippines in 2022. That’s context, not proof of a problem at Bookiery. For one baker, though, a tray in the oven and another component cooling can compete for attention. | Open on the homepage at `/` for the tagline, then cut to the prepared `/app` board. Keep the first run selected. | The statistic describes formal-sector establishments in 2022; it does not establish Bookiery’s experience. |
| **0:20–0:40** | CUE’s tagline is “Your next step, right on cue.” The prototype brings a conversational status lookup together with task dependencies and confirmed updates. Let’s follow one sample run and see what its records actually say. | Show the selected run and its task list. Briefly point to the “Ask CUE” panel. | Do not describe this as a deployed Alexa integration or unrestricted AI. |
| **0:40–1:15** | This is Chewy Pistachio Crunchies, run DEMO-HIO, for twelve. Ingredient preparation, main-component preparation, and cooking are complete. Packaging is already in progress; cooling is waiting. The next inspection and finishing tasks are not ready yet. Notice the task names are generic: this sample is not a validated pistachio recipe. | Keep DEMO-HIO selected. Show the run summary, then the cooling, packaging, inspection, and finishing rows. | Initial states and quantity come from `demo-data.ts`. The product-specific recipe steps in the brief are not implemented. |
| **1:15–1:50** | I’ll ask, “What is waiting?” CUE reads the selected run: the main component is cooling. The record says that stage began at 8:00 AM UTC and gives a 45-minute estimate, with a physical check required before completion. That estimate is not a readiness timer. Now I’ll ask, “What can I do next?” CUE says packaging is already underway and may continue; it doesn’t tell us to start it again. | Enter **“What is waiting?”** in Ask CUE and submit. Pause while the answer appears. Then enter **“What can I do next?”** and submit. | Expected answer: “Waiting stages for DEMO-HIO”; “Cool the main component: cooling started Oct 22, 2026, 8:00 AM UTC; estimated duration 45 minutes; physical inspection is required before completion.” The next-work answer says packaging is active work that may continue; inspection remains unavailable because `cool-main` is incomplete. |
| **1:50–2:20** | I’ll record the human check now. In the cooling row, I choose “Confirm After Inspection.” CUE asks whether I physically verified the condition and shows the proposed update for review. For this sample, I’m recording a simulated baker confirmation. The app records that decision; it does not inspect the component. | In the **Cool the main component** row, click **Confirm After Inspection**. Scroll to the proposal at the top, read the physical-check question, then click **Confirm After Inspection** only after stating the simulated confirmation. | The proposal moves the waiting task to completed as an inspection action. The app does not observe food or validate the user’s statement. |
| **2:20–2:40** | I’ll ask once more, “What can I do next?” Now the answer names “Inspect the finished component” as ready, while packaging remains in progress. The board and chat use the same local sample state, so the prerequisite change is reflected in the next-work answer. | Submit **“What can I do next?”** again. Show the newly ready inspection row beside the answer. | Confirmed state recalculates readiness; `inspect-main` becomes READY because `cool-main` is complete. |
| **2:40–3:00** | This is a browser-local prototype with a limited, deterministic chat and a generic task model. It does not sense food or sync a bakery team. Whether it helps Bookiery more than its current method still needs to be tested. CUE makes the recorded state and next dependency easier to discuss, while the baker stays responsible for physical readiness and quality. | End on the updated board and CUE response. Hold the final frame for a beat. | No measured time savings, fewer errors, team sync, real-time readiness, or product-market fit is established. |

**Spoken narration length:** approximately 358 words. Target an unhurried delivery; use the marked response pauses and trim a sentence if the live UI takes longer.

## Part D: Demo preparation checklist

1. Open `/auth/signin` and click **Try Baker Demo**. This creates the sample workspace and navigates to `/app`.
2. The fresh workspace contains an initial pending proposal to complete **Prepare packaging**. Before recording, click **Cancel** on that proposal. It leaves the production run unchanged and removes the seeded confirmation panel.
3. If returning to an existing demo, click **Reset demo data**, accept the app’s “Reset the demo to its original sample data?” prompt, then cancel the seeded packaging proposal again.
4. Confirm the **DEMO-HIO** / **Chewy Pistachio Crunchies** tab is selected. The default selected run is the first sample.
5. Check the initial state: packaging **in progress**, cooling **waiting**, and the later inspection not yet ready. In Ask CUE, use these exact prompts in order: **“What is waiting?”**, **“What can I do next?”**.
6. For the update, use **Confirm After Inspection** on **Cool the main component**, then confirm the proposal. Only say the physical condition was checked if that is true in the demonstration; otherwise call it a simulated sample confirmation. Re-ask **“What can I do next?”** to show the inspection task becoming ready.
7. If a prompt returns a clarification or the sample state differs, do not improvise its answer. Reset using step 3, cancel the seeded proposal, and verify the selected run again. If the interaction still differs, show the board and describe only its recorded states.

## Part E: Final quality review

- **Relevant opening:** uses a PSA statistic about the broader formal-sector accommodation and food-service population, with scope and reference year stated.
- **Problem and product:** frames the solo-baker coordination scenario, then demonstrates status, dependencies, and a confirmed update.
- **Demo accuracy:** uses the implemented run ID, quantity, task labels, prompts, controls, and prerequisite change. It does not invent a kataifi-specific interaction.
- **Trust and limits:** separates recorded estimates from physical readiness and identifies local storage, deterministic chat, and generic sample tasks.
- **Claims:** avoids unmeasured improvements, automatic safety, recipe validation, and product-market fit.
- **Timing:** timestamped for 3:00, with pauses reserved for entering prompts and confirming the task. Spoken-word count is approximately 358; rehearse once with the actual screen before recording.
