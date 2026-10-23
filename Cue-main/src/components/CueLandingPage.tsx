'use client'

import { useEffect, useState, type ReactNode } from "react"
const assets = {
  logo: "/cue/logo.png",
  mascot: "/cue/mascot.png",
  clarifying: "/cue/clarifying.png",
  thinking: "/cue/thinking.png",
  success: "/cue/success.png",
}

type IconName = "arrow" | "board" | "check" | "chat" | "chevron" | "clock" | "edit" | "help" | "layers" | "menu" | "people" | "search" | "spark" | "target" | "x"

function Icon({ name, size = 20 }: { name: IconName, size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18M8 13h3M8 17h7" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    chat: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3.9-1.3 1.8M12 17h.01" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="m15 9 6-6M17 3h4v4" />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <a
      className={`brand-mark ${inverse ? "brand-mark--inverse" : ""}`}
      href="#home"
      aria-label="CUE home"
    >
      <img className="brand-logo" src={assets.logo} alt="CUE logo" />
    </a>
  )
}

function ActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string
  children: ReactNode
  variant?: "primary" | "secondary" | "light" | "ghost"
}) {
  return (
    <a className={`button button--${variant}`} href={href}>
      {children}
    </a>
  )
}

function SectionIntro({
  eyebrow,
  title,
  copy,
  align = "center",
}: {
  eyebrow: string
  title: ReactNode
  copy: string
  align?: "center" | "left"
}) {
  return (
    <div className={`section-intro section-intro--${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="section-copy">{copy}</p>
    </div>
  )
}

function ImageWithFallback({
  src,
  alt,
  label,
  className = "",
}: {
  src: string
  alt: string
  label: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div
        className={`asset-fallback ${className}`}
        role="img"
        aria-label={`${alt}. Placeholder shown because the supplied artwork is not available.`}
      >
        <span className="fallback-orbit" aria-hidden="true" />
        <span className="fallback-mark">C</span>
        <small>{label}</small>
      </div>
    )
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  )
}

function Navbar() {
  const [open, setOpen] = useState(false)
  const links = [
    ["Home", "home"],
    ["The Problem", "problem"],
    ["Features", "features"],
    ["How It Works", "how-it-works"],
    ["FAQ", "faq"],
  ]
  return (
    <header className="site-header">
      <nav className="nav shell" aria-label="Primary navigation">
        <BrandMark />
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="nav-panel"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "x" : "menu"} size={23} />
        </button>
        <div id="nav-panel" className={`nav-panel ${open ? "is-open" : ""}`}>
          <div className="nav-links">
            {links.map(([label, id]) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
                {label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <ActionLink href="/auth/signin" variant="ghost">
              Sign in
            </ActionLink>
            <ActionLink href="/auth/signup">
              Get started free <Icon name="arrow" size={17} />
            </ActionLink>
          </div>
        </div>
      </nav>
    </header>
  )
}

function HeroSection() {
  const rotatingWords = ["CUE", "track", "time"]
  const [wordIndex, setWordIndex] = useState(0)
  const [hasRotated, setHasRotated] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reducedMotion.matches) return

    const interval = window.setInterval(() => {
      setHasRotated(true)
      setWordIndex((current) => (current + 1) % rotatingWords.length)
    }, 3400)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="hero" id="home">
      <div className="hero-glow hero-glow--one" />
      <div className="hero-glow hero-glow--two" />
      <div className="shell hero-grid">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span>
              <Icon name="spark" size={15} />
            </span>{" "}
            Meet CUE · Your baking workflow assistant
          </div>
          <h1>
            <span className="headline-fixed">Your next step,</span>
            <span className="headline-line">
              right on{" "}
              <span
                className={`rotating-word ${hasRotated ? "is-animating" : ""}`}
                key={rotatingWords[wordIndex]}
              >
                {rotatingWords[wordIndex]}.
              </span>
            </span>
          </h1>
          <p className="hero-lede">
            A conversational baking-workflow assistant that helps Bookiery’s
            solo baker understand production status, identify eligible work,
            and record progress with confirmation.
          </p>
          <div className="hero-actions">
            <ActionLink href="/auth/signup">
              Get started free <Icon name="arrow" size={18} />
            </ActionLink>
            <ActionLink href="/auth/signin" variant="secondary">
              Sign in
            </ActionLink>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mascot-stage">
            <div className="mascot-zone">
              <span className="stage-ring stage-ring--one" />
              <span className="stage-ring stage-ring--two" />
              <ImageWithFallback
                src={assets.mascot}
                alt="CUE mascot, Bookiery’s baking workflow assistant"
                label="Mascot of CUE.png"
                className="mascot-image"
              />
              <span className="assistant-badge">
                <i />
                Ready to help
              </span>
            </div>
          </div>
        </div>
      </div>
      <a className="scroll-cue" href="#problem">
        <span>Explore how CUE works</span>
        <Icon name="chevron" size={17} />
      </a>
    </section>
  )
}

const storyCards: {
  number: string
  kind: string
  title: string
  copy: string
  icon: IconName
}[] = [
  {
    number: "01",
    kind: "The problem",
    title: "Interruptions make progress harder to track.",
    copy: "With several orders moving, notes, messages, checklists, and memory can leave bakers reconstructing what has already happened.",
    icon: "layers",
  },
  {
    number: "02",
    kind: "The solution",
    title: "Meet your conversational workflow assistant.",
    copy: "Check recorded status, clarify the intended task, confirm a change, and see it reflected on one organized order board.",
    icon: "chat",
  },
  {
    number: "03",
    kind: "The opportunity",
    title: "Less reconstructing. Clearer next steps.",
    copy: "CUE explores a simpler way to retrieve progress, track waiting stages, and see what can move forward—an approach to validate through prototype testing.",
    icon: "target",
  },
]

function ProblemSection() {
  return (
    <section className="section section--warm" id="problem">
      <div className="shell">
        <SectionIntro
          eyebrow="Why CUE exists"
          title={
            <>
              Baking has many moving parts.
              <br />
              <span>Your workflow shouldn’t.</span>
            </>
          }
          copy="When several orders are in progress, knowing what is finished and what comes next can become another task in itself."
        />
        <div className="story-grid">
          {storyCards.map((card, index) => (
            <article
              className={`story-card story-card--${index + 1}`}
              key={card.kind}
            >
              <div className="card-number">{card.number}</div>
              <div className="story-icon">
                <Icon name={card.icon} size={25} />
              </div>
              <p className="card-kicker">{card.kind}</p>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
              <div className="mini-visual" aria-hidden="true">
                {index === 0 && (
                  <>
                    <span className="note note--one" />
                    <span className="note note--two" />
                    <span className="note note--three" />
                  </>
                )}
                {index === 1 && (
                  <>
                    <span className="message-pill">Order B101</span>
                    <span className="check-line">
                      <i />
                      <i />
                      <i />
                    </span>
                  </>
                )}
                {index === 2 && (
                  <>
                    <span className="before-lines">
                      <i />
                      <i />
                      <i />
                    </span>
                    <Icon name="arrow" size={20} />
                    <span className="after-check">
                      <Icon name="check" size={22} />
                    </span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const meanings = [
  {
    letter: "C",
    word: "Confirmed",
    text: "CUE identifies the intended order and task, then asks for confirmation before recording a change when required.",
    icon: "check" as IconName,
  },
  {
    letter: "U",
    word: "Updates",
    text: "CUE maintains recorded task progress, supports corrections, and reflects confirmed changes on the order board.",
    icon: "edit" as IconName,
  },
  {
    letter: "E",
    word: "Execution",
    text: "CUE helps the baker identify the next eligible task while respecting configured prerequisites and required checks.",
    icon: "arrow" as IconName,
  },
]

function MeaningSection() {
  return (
    <section className="section meaning-section">
      <div className="shell">
        <SectionIntro
          eyebrow="The name behind the signal"
          title="Three ideas. One clearer workflow."
          copy="CUE is more than a name. It reflects how the assistant helps one baker stay informed, make reliable updates, and move to the next eligible task."
        />
        <div className="meaning-row">
          {meanings.map((item, index) => (
            <article className="meaning-card" key={item.letter}>
              <div className="meaning-letter">{item.letter}</div>
              <div className="meaning-icon">
                <Icon name={item.icon} size={21} />
              </div>
              <h3>{item.word}</h3>
              <p>{item.text}</p>
              {index < meanings.length - 1 && (
                <span className="meaning-connector" aria-hidden="true">
                  <Icon name="arrow" size={18} />
                </span>
              )}
            </article>
          ))}
        </div>
        <div className="brand-statement">
          <Icon name="spark" size={22} />
          <p>
            <strong>CUE is a signal to act.</strong> With Confirmed Updates
            &amp; Execution, that familiar idea becomes a product identity built
            around reliable progress and a clear next step.
          </p>
        </div>
      </div>
    </section>
  )
}

const features: {
  icon: IconName
  title: string
  copy: string
  example: string
}[] = [
  {
    icon: "search",
    title: "Conversational order lookup",
    copy: "Retrieve a specific order’s recorded status, completed tasks, and remaining work.",
    example: "“What is the status of B101?”",
  },
  {
    icon: "arrow",
    title: "Next-task guidance",
    copy: "Find the next unfinished, eligible task from the configured sequence and known prerequisites.",
    example: "“What should I do next?”",
  },
  {
    icon: "check",
    title: "Confirmed task updates",
    copy: "Confirm the intended order and task before a required change is recorded.",
    example: "“Mark ingredient prep complete.”",
  },
  {
    icon: "clock",
    title: "Waiting-stage awareness",
    copy: "Keep cooling, chilling, freezing, and setting stages visible without treating elapsed time as proof of readiness.",
    example: "Graham crust · Chilling · Check required",
  },
  {
    icon: "target",
    title: "Inspection & packing readiness",
    copy: "Keep required quality checks, finishing, packing, and storage work visible before a production run is finished.",
    example: "Cooling confirmed · Inspection required",
  },
  {
    icon: "layers",
    title: "Parallel-work opportunities",
    copy: "See which preparation activity is eligible while another component waits, based on the configured workflow.",
    example: "Kataifi baking · Packaging ready to prepare",
  },
]

function FeaturesSection() {
  return (
    <section className="section section--lavender" id="features">
      <div className="shell">
        <SectionIntro
          eyebrow="Core MVP capabilities"
          title="Everything you need to keep orders moving."
          copy="From checking progress to confirming an update, CUE brings essential baking-workflow coordination into one conversational experience."
        />
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className="feature-card" key={feature.title}>
              <div className="feature-head">
                <span className="feature-icon">
                  <Icon name={feature.icon} size={23} />
                </span>
                <span className="feature-index">0{index + 1}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <div className="feature-example">{feature.example}</div>
            </article>
          ))}
        </div>
        <p className="scope-note">
          <Icon name="spark" size={16} />
          <span>
            <strong>Built for a focused first release.</strong> CUE’s MVP
            centers on lookup, guidance, confirmation, corrections, and visual
            progress—not full bakery administration.
          </span>
        </p>
      </div>
    </section>
  )
}

function UsersSection() {
  return (
    <section className="section users-section">
      <div className="shell">
        <SectionIntro
          eyebrow="Designed around the primary user"
          title="Built for one baker managing every moving part."
          copy="CUE keeps the solo baker in control of production—from preparation and waiting stages to inspection, packing, and storage."
        />
        <div className="users-grid">
          <article className="user-card user-card--baker">
            <div className="role-label">Primary user</div>
            <div className="user-heading">
              <div className="user-icon">
                <Icon name="board" size={27} />
              </div>
              <div>
                <h3>The home-based baker</h3>
                <p>Production overview &amp; control</p>
              </div>
            </div>
            <div className="role-board" aria-hidden="true">
              <div className="role-board-top">
                <span>Today’s orders</span>
                <span>4 active</span>
              </div>
              <div className="role-row">
                <span>Chewy Pistachio Crunchies</span>
                <i className="progress p75" />
              </div>
              <div className="role-row">
                <span>Biscoff Cheesecake</span>
                <i className="progress p45" />
              </div>
            </div>
            <ul>
              <li>Monitor product runs and batch progress</li>
              <li>Review waiting, blocked, and eligible tasks</li>
              <li>Confirm updates and correct recorded progress</li>
            </ul>
            <p className="user-benefit">
              <strong>With CUE:</strong> Check what remains and keep progress
              organized without reconstructing the full production run.
            </p>
          </article>
          <article className="user-card user-card--workflow">
            <div className="role-label">Workflow focus</div>
            <div className="user-heading">
              <div className="user-icon">
                <Icon name="clock" size={27} />
              </div>
              <div>
                <h3>Waiting does not mean idle</h3>
                <p>Dependencies &amp; parallel preparation</p>
              </div>
            </div>
            <div className="workflow-prompt" aria-hidden="true">
              <span className="cue-avatar">C</span>
              <div>
                <small>Illustrative next step</small>
                <p>Prepare packaging while kataifi batches bake.</p>
              </div>
              <span className="prompt-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </div>
            <ul>
              <li>Keep cooling and setting stages visible</li>
              <li>See what prerequisites still block a task</li>
              <li>Require inspection before finishing and packing</li>
            </ul>
            <p className="user-benefit">
              <strong>With CUE:</strong> See what can move forward while another
              component waits—without assuming that a timer proves readiness.
            </p>
          </article>
        </div>
        <p className="roles-disclaimer">
          Examples use illustrative workflow data informed by Bookiery’s
          production process, not live order records.
        </p>
      </div>
    </section>
  )
}

const steps = [
  {
    title: "Select the production run",
    copy: "Choose a product run on the board or ask CUE to retrieve its recorded status.",
    example: "“Show the Biscoff cheesecake run.”",
    image: assets.clarifying,
    label: "Clarifying.png",
    icon: "search" as IconName,
  },
  {
    title: "Review readiness",
    copy: "See completed, pending, waiting, and blocked work alongside known prerequisites.",
    example: "“What is waiting, and what is ready?”",
    image: assets.thinking,
    label: "Thinking.png",
    icon: "layers" as IconName,
  },
  {
    title: "Confirm progress",
    copy: "Report a task change and confirm the intended update before CUE records it when required.",
    example: "“Confirm the crust is chilling?”",
    image: assets.clarifying,
    label: "Clarifying.png",
    icon: "check" as IconName,
  },
  {
    title: "Complete required checks",
    copy: "CUE surfaces the next eligible work and keeps inspection, finishing, packing, and storage checks visible.",
    example: "“Cooling confirmed. Inspection is next.”",
    image: assets.success,
    label: "Success.png",
    icon: "arrow" as IconName,
  },
]

function HowItWorksSection() {
  return (
    <section className="section section--deep" id="how-it-works">
      <div className="shell">
        <SectionIntro
          eyebrow="A clearer sequence"
          title={
            <>
              From “what’s next?”
              <br />
              to the next task.
            </>
          }
          copy="CUE helps turn a complex production run into a clearer sequence of eligible work, waiting stages, and confirmed actions."
        />
        <div className="steps">
          {steps.map((step, index) => (
            <article className="step" key={step.title}>
              <div className="step-number">0{index + 1}</div>
              <div className="step-art">
                <ImageWithFallback
                  src={step.image}
                  alt={`CUE mascot supporting the ${step.title.toLowerCase()} step`}
                  label={step.label}
                />
                <span className="step-icon">
                  <Icon name={step.icon} size={19} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <div className="step-example">{step.example}</div>
              {index < steps.length - 1 && (
                <span className="step-connector" aria-hidden="true">
                  <Icon name="arrow" size={18} />
                </span>
              )}
            </article>
          ))}
        </div>
        <div className="workflow-note">
          <Icon name="check" size={19} />
          <p>
            Every status shown is based on recorded information. CUE clarifies
            ambiguity rather than inventing order progress.
          </p>
        </div>
      </div>
    </section>
  )
}

const faqs = [
  [
    "What is CUE?",
    "CUE is Bookiery’s conversational baking-workflow assistant for a solo home-based baker. It helps track production progress, identify eligible tasks, and record or correct updates with confirmation.",
  ],
  [
    "What does CUE stand for?",
    "CUE stands for Confirmed Updates & Execution. The name reflects its focus on reliable task updates and guidance toward the next action.",
  ],
  [
    "Who is CUE designed for?",
    "CUE is designed first for Bookiery’s solo home-based baker, who manages preparation, waiting stages, finishing, inspection, packing, and storage across production runs.",
  ],
  [
    "How is CUE different from a checklist or spreadsheet?",
    "CUE aims to add a conversational way to retrieve order progress and identify the next task, alongside a visual order board. It is designed to complement existing methods, not assume they are ineffective.",
  ],
  [
    "Can CUE update an order automatically?",
    "CUE is intended to confirm the relevant change when required before recording an update. It should never imply that an update was saved if the operation fails.",
  ],
  [
    "What happens when CUE does not understand a request?",
    "CUE should ask a clarifying question rather than guess the order or task.",
  ],
  [
    "How does CUE handle cooling, chilling, or freezing?",
    "CUE can keep a reported waiting stage visible and apply configured prerequisites. It does not independently inspect temperature, texture, firmness, or readiness; the baker confirms physical readiness.",
  ],
  [
    "Does CUE support real voice commands?",
    "Not in the initial scope. Any Alexa+-style interaction shown in the prototype should be understood as a simulation unless real voice integration is implemented.",
  ],
  [
    "Is CUE a complete bakery management system?",
    "No. The initial focus is production status, dependency-aware guidance, waiting stages, confirmed updates, corrections, quality checks, and a visual production board.",
  ],
  [
    "Does CUE guarantee faster baking or fewer mistakes?",
    "No. Those are potential benefits to investigate through usability testing with the baker, not guaranteed outcomes.",
  ],
]

function FAQItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string
  answer: string
  open: boolean
  onToggle: () => void
}) {
  const id = `faq-${question.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <div className={`faq-item ${open ? "is-open" : ""}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{question}</span>
        <span className="faq-toggle">
          <Icon name="chevron" size={19} />
        </span>
      </button>
      <div className="faq-answer" id={id} role="region">
        <div>
          <p>{answer}</p>
        </div>
      </div>
    </div>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0)
  return (
    <section className="section faq-section" id="faq">
      <div className="shell faq-layout">
        <div className="faq-aside">
          <p className="eyebrow">Frequently asked</p>
          <h2>Questions about CUE?</h2>
          <p>
            Honest answers about the prototype, its intended users, and what it
            is designed to do.
          </p>
          <div className="faq-callout">
            <span>
              <Icon name="chat" size={21} />
            </span>
            <div>
              <strong>Still curious?</strong>
              <p>
                Explore the workflow above or get started with the prototype.
              </p>
            </div>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <FAQItem
              key={question}
              question={question}
              answer={answer}
              open={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const trustItems = [
  "Designed for baking workflows",
  "Confirmation for required updates",
  "Progress tracking",
  "Responsive interface",
  "Conversational assistance",
  "Prototype under validation",
]

function FinalCTASection() {
  return (
    <section className="final-wrap" id="access">
      <div className="shell">
        <div className="final-cta">
          <span className="cta-orbit cta-orbit--one" />
          <span className="cta-orbit cta-orbit--two" />
          <div className="final-content">
            <p className="eyebrow">Move your workflow forward</p>
            <h2>Your next baking task starts here.</h2>
            <p>
              Keep production progress, waiting stages, and required checks in
              view. When the workflow becomes difficult to reconstruct, ask CUE
              what is eligible to move next.
            </p>
            <div className="hero-actions">
              <ActionLink href="#features" variant="light">
                Explore CUE <Icon name="arrow" size={18} />
              </ActionLink>
              <ActionLink href="#how-it-works" variant="secondary">
                See how it works
              </ActionLink>
            </div>
          </div>
          <div className="prototype-note" id="prototype-note">
            Prototype preview · Account access is not connected yet
          </div>
          <div className="trust-grid">
            {trustItems.map((item) => (
              <span key={item}>
                <i>
                  <Icon name="check" size={13} />
                </i>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-main">
          <div className="footer-brand">
            <BrandMark inverse />
            <p>
              Confirmed Updates &amp; Execution.
              <br />
              Your next step, right on cue.
            </p>
            <small>
              A conversational baking-workflow assistant by Bookiery.
            </small>
          </div>
          <div className="footer-links">
            <div>
              <strong>Explore</strong>
              <a href="#problem">The problem</a>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
            </div>
            <div>
              <strong>Product</strong>
              <a href="#faq">FAQ</a>
              <a href="#features">Explore CUE</a>
              <a href="#how-it-works">Workflow</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CUE. All rights reserved.</span>
          <span>
            Built with <span aria-label="love">♥</span> for independent bakers.
          </span>
        </div>
      </div>
    </footer>
  )
}

export default function CueLandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <MeaningSection />
        <FeaturesSection />
        <UsersSection />
        <HowItWorksSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  )
}
