# UNTRAVA — Product & System Design Specification

**Date:** 2026-09-15  
**Status:** Design approved in conversation; written-spec review pending  
**Product:** UNTRAVA  
**Working positioning:** *Break the loop. Take back control.*  
**Brand status:** Product name locked for design; formal trademark clearance remains pending.

## 1. Product vision

UNTRAVA is a global, evidence-informed behavior-change platform whose first product focuses on stopping or reducing combustible cigarettes, vaping/e-cigarettes, heated tobacco and dual/poly-use. It is not merely a tracker or motivational counter. Its core is a Personal Quit Intelligence system that observes the user's own patterns, estimates near-term risk, selects safe interventions, measures outcomes and learns what works for that individual.

The system should feel human, calm and non-judgmental while retaining strong technical and safety boundaries. A lapse is data and a recovery opportunity, not a moral failure. The product must remain useful without Premium and must never place core cessation, Rescue or safety functions behind a paywall.

Core loop:

`Observe → Understand → Predict → Intervene → Measure → Learn`

Technical decision chain:

`Context → Risk Engine → Safety/Eligibility Gate → Intervention Engine → Delivery → Outcome → Learning Engine`

AI is a communication and personalization layer around this chain. It is not the clinical or safety authority.

## 2. Goals and non-goals

### Goals

- Support quit-today, future quit-date, gradual-reduction and adaptive strategies.
- Support cigarette, vape/e-cigarette, heated-tobacco and dual/poly-use from V1.
- Distinguish smoke-free, tobacco-free, nicotine-free and reduction goals.
- Provide immediate, low-friction Rescue support online or offline.
- Build a transparent Personal Quit Memory and personalized Trigger Map.
- Predict elevated risk conservatively and explain why an intervention was suggested.
- Learn intervention effectiveness per user without unsafe experimentation.
- Treat lapse and relapse with recovery-oriented UX.
- Allow carefully scoped support from trusted people without turning the product into surveillance.
- Offer anonymous Together signals without exposing users to an unmoderated social network in V1.
- Integrate relevant Health Connect / Apple Health context and lightweight watch interactions.
- Provide meaningful permanent Free value and a clearly differentiated Personal Quit Intelligence Premium tier.
- Preserve user history and data ownership regardless of subscription state.

### Non-goals for V1

- Diagnosing medical or psychiatric conditions.
- Starting, prescribing or changing medication/NRT doses.
- Claiming that a wearable signal caused a craving or lapse.
- Using CO or other sensors as a lie detector.
- Requiring a Bluetooth CO device.
- Building a clinician dashboard; V1 is Care-Team-ready and exports professional reports.
- Building an open free-text forum or anonymous direct messaging.
- Building a full family cessation product.
- Proving clinical quit-rate efficacy from product analytics alone.

## 3. Architecture decision

UNTRAVA V1 uses a **modular monolith backend with independently testable decision engines**, plus native-capable mobile clients and lightweight wearable companions.

This approach is preferred over early microservices because it minimizes deployment and operational complexity while preserving strong module boundaries. Engines such as Risk, Safety and Learning have explicit interfaces so they can later be extracted if scale or organizational needs justify it.

### 3.1 Four layers

**Client layer**

- iOS app
- Android app
- Apple Watch companion
- Wear OS companion
- Support Circle companion experience
- Local Rescue Library
- Local event store and sync queue

**Backend application layer**

- Identity & Consent
- Quit Profile & Goals
- Tobacco/Nicotine Usage
- Craving & Withdrawal
- Event Timeline
- Support Circle
- Together
- Savings & Rewards
- Notifications
- Subscription
- Reporting

**Quit Intelligence layer**

- Context Builder
- Risk Engine
- Safety/Eligibility Engine
- Intervention Engine
- Learning Engine
- Trigger Map / derived intelligence

**AI communication layer**

- Coach
- Friend
- Analyst
- Auto mode

The AI layer may explain, summarize, personalize language and conduct bounded conversations. It cannot override deterministic safety decisions or invent treatment/dosing instructions.

## 4. Local-first and offline behavior

Rescue must not depend on server or LLM availability. The client ships with a versioned Local Rescue Library containing safe, editorially approved short interventions and decision rules sufficient to complete a basic Rescue flow offline.

Events generated offline receive client-generated unique IDs, are persisted locally and enter a durable sync queue. Sync retries use backoff and idempotent server writes. The UI does not block on network acknowledgement for ordinary logging or Rescue.

Server/AI outages may reduce personalization depth, but must never remove the user's ability to record craving/use or access core crisis support.

## 5. Domain model and event system

### 5.1 Quit Profile

The profile stores stable and slowly changing facts such as supported products, approximate baseline consumption, dependence-related answers, preferences and current strategy. Goals are time-varying records rather than one mutable field.

Supported goal types:

- smoke-free
- tobacco-free
- nicotine-free
- reduction

NRT and prescribed cessation treatment are modeled separately from tobacco-use events. NRT use must not be treated as a smoking failure.

### 5.2 Product-specific usage

The model must not force all products into “cigarettes per day.” Product types retain meaningful units and context:

- combustible cigarettes
- e-cigarette/vape
- heated tobacco
- dual/poly-use combinations

Cross-product normalization may be used internally only when scientifically defensible and must not erase raw product-specific data.

### 5.3 Immutable Quit Event Timeline

Behavioral history is append-oriented. Important event families include:

- product use
- craving
- withdrawal symptom observation
- intervention started/completed
- intervention outcome
- support request/contact
- notification delivery/open/dismissal
- goal/strategy change
- treatment/NRT adherence entry
- relevant health-context observation
- correction/retraction

Existing historical facts are not silently rewritten. Corrections and retractions reference prior events. Each event has a unique client-generated ID, actor/device context, timestamps and schema version. Server ingestion is idempotent and deduplicates repeated submissions.

## 6. Derived intelligence

Raw facts are distinct from derived intelligence. Derived models include:

- Trigger Map
- vulnerable time windows
- craving baseline and change
- withdrawal pattern
- intervention efficacy by context
- lapse pattern
- notification response pattern
- risk profile
- recovery pattern

Every derived insight stores at minimum:

- confidence/state
- evidence count or sample size
- last-updated time
- relevant evidence references or reproducible derivation metadata

The product must communicate uncertainty. Sparse data should result in “learning” or low-confidence states rather than false precision.

## 7. Personal Quit Memory

AI memory is transparent and user-governed. It has three classes:

1. **Explicit durable facts** — facts the user intentionally provides or confirms.
2. **Learned preferences/patterns** — e.g. the user tends to prefer walking over breathing exercises in a certain context.
3. **Temporary context** — short-lived information that should decay or expire.

The app includes a **“What does UNTRAVA know about me?”** experience where the user can inspect, correct and delete memory items.

AI memory is not the source of truth for raw tobacco, treatment or health records. Contradictions are resolved against authoritative domain records or surfaced for confirmation rather than silently merged.

## 8. Risk Engine

The Risk Engine estimates near-term vulnerability from personal baseline, recent events, current context and learned patterns. It does not present pseudo-clinical certainty.

Risk levels:

- **Low / Observe**
- **Elevated / Prepare**
- **High / Intervene**
- **Critical / Rescue**

Each result includes confidence and human-readable reasons. The UI should prefer language such as “this looks like one of your harder time windows” rather than “you have an 87% chance of smoking.”

Cold start progression:

`Population/default priors → Personal baseline → Contextual personalization → Personal Quit Intelligence`

The engine must remain deterministic/reproducible for the same versioned inputs. Model/rule versions are logged for audit and analysis.

## 9. Quit Autopilot and Intervention Engine

Autopilot receives risk/context, filters interventions through eligibility and safety constraints, ranks remaining candidates using personal evidence and selects the lowest-burden intervention likely to help.

Flow:

`Risk → Eligible interventions → Personal ranking → Delivery → Outcome → Learning`

The system may perform controlled exploration between **safe** interventions when personal evidence is insufficient. Safety constraints always dominate exploration.

A Notification Budget limits interruption frequency and learns from ignored/dismissed prompts. Repeatedly ignored intervention types or times should be down-ranked unless safety requires otherwise.

Premium enables deeper history/context and predictive Pre-Craving behavior. Manual Rescue remains free and unlimited.

## 10. Rescue Mode

Rescue is a first-class product surface, reachable with minimal friction from the main app and, where platform capabilities permit, widgets, lock-screen surfaces and watches.

Primary action: **“I’m about to smoke/use.”**

Flow:

`Stabilize → Select/serve intervention → Short application → Reassess → Escalate if needed → Support or Recovery`

Escalation levels:

1. Micro Rescue
2. Guided Rescue
3. Environment Escape
4. Human Support

Intervention families include evidence-informed ACT, CBT, behavioral coping and mindfulness/regulation techniques. User-created coping methods may become personal candidates after appropriate confirmation.

Success is not defined only as “did not smoke.” Outcome signals include:

- craving reduction
- delay minutes
- environment change
- exercise completion
- support requested
- no use / use

If the user uses a product, **“I used”** remains easy to access. There is no shame animation or punitive copy; the app transitions into Recovery Flow.

Support Circle contact is suggested rather than automatically triggered by default.

## 11. AI experience

The same underlying memory, science content and decision constraints power three presentation modes:

- **Coach:** structured, action-oriented, encouraging
- **Friend:** warm, conversational, less formal
- **Analyst:** concise, evidence/pattern-oriented

An optional Auto mode may adapt tone to context and learned preference without changing safety or treatment boundaries.

AI should explain personalization when useful, e.g. that walking has helped in similar situations, while avoiding causal overclaiming.

Intervention content is versioned and editorially approved. The LLM may personalize wording and conversation around approved content but cannot invent medication regimens, NRT dosing or unsupported treatment claims.

## 12. Onboarding and first 14 days

### 12.1 First session

Target initial setup is roughly 60–90 seconds. Collect only high-value information:

- tobacco/nicotine products used
- approximate consumption
- first use after waking / basic dependence context
- hardest or most automatic use situations
- past quit attempts
- preferred starting strategy

Strategy options:

- quit now
- choose a future quit date
- gradual reduction
- learn me first / adaptive recommendation

UNTRAVA may recommend a strategy but the user decides.

### 12.2 Progressive profiling

Do not present a long intake form. Trigger and context questions appear progressively when they can improve personalization. The Trigger Map develops from small, timely observations.

A future quit date creates a learning/preparation phase. An immediate quit starts now while learning continues in parallel.

### 12.3 Quit-Day Playbook

UNTRAVA builds a personalized playbook containing likely difficult moments, If→Then plans, coping methods and an Environment Reset checklist.

The first 72 hours can be more attentive, subject to Notification Budget and user notification mode.

### 12.4 Trial

A **14-day cardless Premium trial** begins at account creation, not at the quit date. There is no automatic charge. Around day 7 the product presents “what I’ve learned”; around day 14 it presents a richer Quit Intelligence report and then a Premium offer. If the user does not purchase, the account downgrades to Free while retaining data and core functionality.

## 13. Lapse, relapse and recovery

The domain distinguishes:

- single unplanned use
- lapse
- relapse
- intentional goal/strategy change

One use may reset a continuous streak where mathematically appropriate, but must not erase long-term progress. The UI can simultaneously show, for example, a new continuous streak and “30 of the last 31 days smoke-free.” Savings already achieved and mastery already learned are not deleted.

Recovery Flow should be brief and useful: record what happened, capture minimal context, offer immediate recovery action and feed the event into Learning.

## 14. Withdrawal and treatment companion

Withdrawal tracking is optional and can include sleep, restlessness, concentration, appetite, cough, constipation, mood/anxiety and craving. Health data may provide context but must not be used to diagnose conditions or make deterministic medical predictions.

Treatment Companion supports user-entered NRT and prescribed cessation plans, reminders and adherence tracking. UNTRAVA does not initiate treatment or alter dosage. Treatment and NRT records are private by default and separately permissioned if sharing is ever enabled.

## 15. Deterministic Safety Engine

Safety rules are versioned, auditable and independent of generative AI. Safety may interrupt the ordinary conversational flow when predefined conditions require it.

The engine owns boundaries around:

- treatment and dosing advice
- high-risk symptom guidance
- intervention eligibility/contraindication metadata where applicable
- emergency/escalation messaging

Rescue and Safety are never quota-limited or paywalled.

## 16. Support Circle

Support Circle consists of real people selected by the user. Sharing is granular, revocable and enforced at read time.

Separately permissionable categories include:

- progress/streak
- craving
- lapse
- high-risk alerts
- goals
- savings/rewards

Default-private categories include:

- AI conversations
- health data
- treatment/NRT
- location

The companion experience is intentionally focused: it teaches supporters how to help and presents context-appropriate evidence-informed support prompts rather than exposing a miniature copy of the user's app.

Rescue Contact can make contacting a chosen person easy. Automatic sharing/contact is not the default; user consent is required according to configured rules.

A **Consent Ledger** records data category, recipient/purpose, consent version and time. The app includes a clear “Who sees what?” view. Revocation stops future access.

Premium includes one Companion Premium support person in V1. Multiple supporters and advanced permissions are Premium capabilities. Future Duo/Family products may exist, but each person retains a separate private cessation account.

## 17. Together

Together provides anonymous community signals without creating an unmoderated social network.

V1 supports:

- anonymous aggregate activity/progress signals
- predefined supportive reactions
- carefully designed collective milestones or encouragement

V1 excludes free-text public posting and anonymous DMs. The product must not fabricate community counts when there is insufficient data.

## 18. Main UX

The home screen centers on the current goal and resilient progress rather than a single fragile streak.

Core elements:

- current goal
- continuous streak
- resilient progress metric, e.g. percentage smoke-free over a recent period
- persistent actions: **I’m about to smoke/use**, **I used**, **I’m good today**
- Today Intelligence card
- savings/reward progress

Gamification has three dimensions:

- **Streak** — continuity
- **Progress** — longer-term behavior change
- **Mastery** — skills/triggers the user has learned to handle

Avoid childish XP systems and login streaks unrelated to cessation behavior.

## 19. Savings and rewards

Savings are based on real consumption/cost assumptions that the user can review. Users may attach meaningful goals such as a trip or purchase. A lapse does not retroactively erase savings already achieved.

Premium may add AI-supported reward planning and richer projections, but basic savings remain Free.

## 20. Notifications

Modes:

- Quiet
- Balanced
- Active
- Auto-learn

Pre-Craving prompts are risk-based and confidence-aware. The system learns from ignored/dismissed notifications and reduces low-value interruption. Notification Budget provides a hard product-level defense against spammy behavior.

Safety-critical messaging is handled separately from ordinary engagement notifications.

## 21. Wearables and health platforms

### V1

Health Connect and Apple Health may contribute only allowed, relevant signals. Correlation must not be presented as causation.

Wear OS / Apple Watch lightweight actions:

- start Rescue
- record craving
- record use
- run a short intervention/timer
- reassess craving

A small offline Rescue library is available on the watch where technically practical.

### CO / biomarker roadmap

V1 supports optional manual CO entry and prepares a sensor integration API. Bluetooth CO integration is targeted for a later V1.x release rather than being required for launch. Sensor data is never used as a truth/lie detector.

## 22. Monetization

### Free

Free is permanent and genuinely useful. It includes:

- quit plan and supported strategies
- supported tobacco product logging
- craving logging
- unlimited Rescue
- basic ACT/CBT interventions
- lapse Recovery Flow
- withdrawal tracking
- streak/progress/savings
- basic Trigger Map and playbook
- basic AI assistance
- Safety Engine
- data export
- Together
- basic professional report

### Premium — Personal Quit Intelligence

Target price:

- **USD 1.99/month**
- **USD 14.99/year**
- localized store pricing where appropriate

Premium includes:

- advanced/full Trigger Map
- dynamic adaptive Quit-Day Playbook
- high fair-use AI without token/credit UX
- full Coach/Friend/Analyst modes and adaptive personality
- advanced long-term AI memory
- full Quit Autopilot
- Personal Risk Engine
- predictive Pre-Craving alerts
- advanced Learning Engine
- personalized withdrawal forecast/correlations
- deeper Health Connect / Apple Health analysis
- richer wearable capabilities
- multiple Support Circle members and advanced permissions
- advanced Rescue Contact automation
- AI-supported rewards
- detailed professional/clinical report
- no ads
- future Bluetooth CO integration may be Premium

Lifetime purchase is not part of V1 because recurring AI/infrastructure costs make the economics uncertain.

### Advertising rules

Free may show ads during ordinary non-critical use, including home outside an active intervention, statistics, progress, savings, Together, history, Trigger Map, education and passive withdrawal history.

**No ads are permitted during active intervention or safety moments**, including:

- Rescue Mode
- active craving intervention
- “I’m about to smoke/use” flow
- immediate lapse Recovery Flow
- emergency/safety guidance
- active ACT/CBT exercise

Sensitive craving, lapse, health, NRT/treatment and private AI conversation content must not be used for ad targeting. Tobacco, vape and nicotine-product advertising is prohibited. Ad-category controls should also block categories that undermine cessation or create obvious addiction-related harm.

Premium is ad-free.

## 23. Privacy, consent and data ownership

Sensitive quit and health data is not an advertising-targeting asset. Sharing is purpose- and category-scoped. Permissions are enforced by backend authorization at read time, not merely hidden in UI.

Security baseline:

- short-lived access credentials plus refresh/session management
- device sessions and revocation
- encryption in transit and at rest using platform/cloud capabilities
- secrets outside source control
- rate limiting and abuse controls
- auditable sensitive operations
- structured log redaction
- explicit data classification

Raw history and user data remain accessible independent of Premium status. Export and deletion flows must be designed as first-class account capabilities.

## 24. Reporting and Care Team readiness

V1 can generate a professional sharing report containing user-authorized cessation history, goals, product use, cravings/withdrawal summaries, treatment adherence entries and relevant derived patterns with uncertainty clearly labeled.

The data model and permission system should be Care-Team-ready, but a clinician dashboard is deferred until after V1. Reports must not convert product analytics into diagnoses or unsupported clinical claims.

## 25. Observability

UNTRAVA needs end-to-end product observability without logging sensitive free text unnecessarily.

Traceable decision chain:

`risk calculated → intervention selected → notification delivered → Rescue opened → intervention completed → outcome recorded → learning updated`

Use pseudonymous identifiers and structured metadata. Log model/rule/content versions needed to reproduce decisions while redacting sensitive content.

Core product metrics include:

- onboarding completion
- D1/D3/D7/D14 retention
- Rescue use and completion
- craving change after intervention
- lapse recovery behavior
- notification usefulness/engagement
- trial-to-paid conversion
- crash-free sessions/users

Quit-rate efficacy claims require separate clinical validation and are not inferred casually from engagement telemetry.

## 26. Testing strategy

Testing priority follows risk.

### Unit / deterministic engine tests

Strong deterministic coverage for:

- Risk Engine
- Safety Engine
- Learning Engine
- goal semantics
- lapse/relapse/recovery semantics
- intervention eligibility/ranking
- Notification Budget
- consent/permission decisions

Use fixtures for cold-start, sparse-data, conflicting-data, offline/replay and multi-product scenarios.

### Contract and API tests

Verify module contracts, authorization, event schemas, versioning, idempotency and subscription entitlements.

### Sync and persistence tests

Cover retries, duplicate submissions, correction/retraction, offline queues, device concurrency and conflict scenarios.

### Mobile integration tests

Cover local event creation, offline Rescue, sync recovery, notification deep links, Health platform adapters and entitlement changes.

### End-to-end critical flows

At minimum:

- first-run onboarding → strategy selection
- quit-now and future-date paths
- Rescue offline and online
- record use → Recovery Flow
- Support Circle invite/permission/revoke
- trial expiry → Free downgrade without data loss
- Premium purchase/restore
- safety interruption path

## 27. CI and release gates

Every change should pass automated quality gates appropriate to its layer:

- formatting/lint/static analysis
- unit tests
- integration/contract tests
- database migration validation
- secret scanning
- mobile builds

Release candidates additionally run critical E2E/smoke checks and store-package validation. A release is not described as ready/green until required CI has actually completed successfully.

## 28. Proposed module boundaries

The initial backend should remain one deployable application but keep these explicit modules:

- `identity-consent`
- `quit-profile`
- `events`
- `intelligence`
- `interventions`
- `safety`
- `support`
- `together`
- `notifications`
- `subscription`
- `reporting`

Decision engines should expose narrow typed interfaces and not reach arbitrarily into persistence owned by other modules. Context is assembled explicitly and passed into engines. This keeps engine behavior reproducible and allows future extraction without designing distributed systems prematurely.

## 29. Implementation sequencing

This specification defines the product architecture, not the detailed implementation plan. The subsequent implementation-planning phase should decompose work into independently verifiable milestones. The expected dependency direction is:

1. repository/tooling and shared contracts
2. identity/consent + event foundation
3. quit profile/goals/product model
4. local-first mobile event/sync foundation
5. intervention library + offline Rescue
6. Risk/Safety/Learning engines
7. onboarding/home/recovery/withdrawal flows
8. notifications/autopilot
9. AI communication layer
10. Support Circle/Together
11. subscriptions/ads/entitlements
12. health/wearable integrations
13. reporting/observability/release hardening

The implementation plan may split these into smaller milestones and branches, but must preserve the safety, privacy and offline invariants in this document.

## 30. Non-negotiable invariants

1. **Rescue works offline.**
2. **Safety does not depend on an LLM.**
3. **AI cannot prescribe or change medication/NRT dosing.**
4. **Core Rescue/Safety is free and never quota-limited.**
5. **No ads during active intervention or safety flows.**
6. **Sensitive cessation/health/private-AI data is not used for ad targeting.**
7. **A lapse never erases historical progress.**
8. **NRT is not treated as smoking failure.**
9. **Raw events are append-oriented; corrections/retractions are auditable.**
10. **Risk and learned insights expose uncertainty rather than false precision.**
11. **Support sharing is granular, revocable and enforced server-side.**
12. **Subscription downgrade never deletes user history.**
13. **Wearable/health correlations are not presented as causation.**
14. **Sensor data is not a lie detector.**
15. **No clinical efficacy claim is made without appropriate validation.**

## 31. Brand note

The product name is **UNTRAVA** for design and development. Preliminary web/app research found no obvious exact-match cessation, digital-health or AI product occupying the name; unrelated linguistic/corporate traces exist, so this is not a legal clearance. Formal trademark and jurisdiction-specific review remain a business/legal prerequisite before major brand investment or public launch.

---

### Design approval record

The architecture, data/event model, Risk/Autopilot/Learning model, Rescue/AI model, onboarding/first-14-days flow, lapse/withdrawal/treatment/safety model, Support Circle/Together privacy model, UX/gamification/notification/wearable model, monetization rules and technical architecture were reviewed iteratively and approved in the product-design conversation. This document consolidates those decisions for written-spec review before implementation planning.