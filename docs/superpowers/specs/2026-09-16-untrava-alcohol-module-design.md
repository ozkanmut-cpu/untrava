# UNTRAVA Alcohol Module — Design Specification

**Date:** 2026-09-16  
**Status:** Approved design direction  
**Branch:** `rescue-interventions`  
**Parent architecture:** `docs/superpowers/specs/2026-09-16-untrava-core-generalization-design.md`  
**Core boundary spec:** `docs/superpowers/specs/2026-09-16-untrava-behavior-change-core-boundaries.md`  
**Scope:** Define the Alcohol Module architecture, medical-safety boundaries, measurement principles, Rescue/Recovery integration and implementation sequence without implementing Alcohol code in this task.

## 1. Decision

UNTRAVA will add Alcohol as a typed domain module on top of the existing domain-neutral Behavior Change Core.

The Alcohol Module owns alcohol-specific meaning, measurement, goals, use-event schemas, safety policy, Rescue content, Recovery semantics, progress/reporting rules and later pattern/risk feature construction.

The shared Core continues to own identity, consent, immutable event-envelope mechanics, local-first storage, sync/idempotence, goal lifecycle, Rescue state-machine mechanics, Recovery invariants, support boundaries, privacy/logging defaults and future Intelligence interfaces.

The key medical decision is that Alcohol safety is **not** one score and is **not** embedded inside Rescue. It is a separate deterministic orchestration layer composed of several independent safety gates.

Target structure:

```text
UNTRAVA Core
│
└── Alcohol Module
    ├── Alcohol Goals
    ├── Alcohol Use Events
    ├── Alcohol Measurement
    ├── Alcohol Safety Orchestrator
    │   ├── AcuteIntoxicationGate
    │   ├── WithdrawalRiskGate
    │   ├── ActiveWithdrawalMonitor
    │   ├── WernickeNutritionGate
    │   ├── InteractionGate
    │   ├── MedicalVulnerabilityGate
    │   └── ClinicianPlanAdapter
    ├── Alcohol Rescue Library
    ├── Alcohol Recovery
    ├── Alcohol Progress / Reporting
    └── Alcohol Pattern/Risk feature builders (later)
```

## 2. Why Alcohol needs a separate safety architecture

Alcohol differs materially from Tobacco because a user who is physiologically dependent on alcohol can develop acute withdrawal after abruptly stopping or substantially reducing intake. Severe alcohol withdrawal can include seizures and delirium tremens and can be fatal. Current UK alcohol-treatment guidance explicitly distinguishes self-directed reduction from medically assisted withdrawal and says people with moderate or severe dependence can experience withdrawal after stopping or substantially reducing alcohol, sometimes beginning within hours.

Therefore UNTRAVA must never implement a generic rule such as:

```text
user wants abstinence → tell user to stop now
```

The correct architecture is:

```text
alcohol use / goal intent
        ↓
Alcohol Safety Orchestrator
        ↓
self-guided path allowed
   OR clinical assessment/routing
   OR urgent/emergency routing
        ↓
Goal / Rescue / Recovery
```

Safety routing is a domain concern owned by Alcohol Module. Core must not contain alcohol-withdrawal semantics.

## 3. Medical-safety invariants

The following are non-negotiable:

1. **No autonomous detox authority.** UNTRAVA does not decide that a physiologically dependent person is safe to detox without clinical assessment.
2. **No autonomous taper plan.** UNTRAVA never invents a schedule such as “drink X today, Y tomorrow”.
3. **No medication dosing.** UNTRAVA never starts, stops, changes or calculates doses for withdrawal medication, relapse-prevention medication, thiamine or any other medication.
4. **No AI safety authority.** Generative AI cannot override deterministic medical-safety gates.
5. **No single-score shortcut.** AUD severity, physical-dependence risk, complicated-withdrawal risk, current withdrawal severity and acute intoxication are distinct concepts.
6. **Emergency conditions override behavior-change flows.** Suspected overdose, seizure, severe confusion, inability to wake, serious breathing abnormality or comparable emergency signals interrupt normal Rescue/goal flows.
7. **Withdrawal risk is evaluated before recommending abrupt abstinence or major reduction.**
8. **History matters.** Prior withdrawal seizures, delirium tremens, repeated withdrawals and serious complications materially affect routing.
9. **Pregnancy is a specialist-routing condition when alcohol dependence is present.** The app must not resolve the conflict by independently recommending abrupt cessation to a dependent user.
10. **Wernicke risk is separate from withdrawal severity.** Malnutrition/neurologic risk is evaluated independently and can escalate care.
11. **Alcohol + other CNS depressants is a separate safety concern.** Opioid/benzodiazepine/sedative co-use must not be treated as ordinary alcohol-use context.
12. **Safety rules are versioned and auditable.** Every safety decision records the deterministic rule-set version and evidence inputs used.
13. **Offline essential safety remains available.** The minimum deterministic safety rules needed to block unsafe self-guided actions must ship locally.
14. **Failure is fail-closed for risky actions.** If required safety data or validated rules are unavailable, the app must not silently authorize a self-guided withdrawal/taper path.

## 4. Alcohol Safety Orchestrator

The orchestrator runs independent gates and combines their results into a routing disposition. It does not diagnose Alcohol Use Disorder and does not prescribe treatment.

Conceptual output:

```ts
interface AlcoholSafetyDecision {
  ruleSetVersion: string;
  disposition:
    | 'self_guided_behavior_support_allowed'
    | 'clinical_assessment_recommended'
    | 'clinical_plan_required'
    | 'urgent_medical_assessment'
    | 'emergency_response';
  triggeredGateIds: string[];
  evidenceFactIds: string[];
  decidedAt: string;
}
```

The exact TypeScript syntax is deferred to implementation tasks. The important invariant is that Safety produces **routing**, not diagnosis, medication or taper instructions.

### 4.1 AcuteIntoxicationGate

Purpose: detect situations where normal behavior-change UX must stop because acute alcohol poisoning or another emergency may be present.

Signals may include user- or observer-reported:

- inability to remain conscious or inability to wake;
- seizure;
- serious breathing difficulty, markedly slow breathing or long pauses;
- severe confusion/stupor;
- repeated vomiting with impaired consciousness;
- severe hypothermia-like signs, cyanosis/pallor or loss of protective responses;
- other emergency conditions supplied by validated clinical policy.

Output can escalate directly to `emergency_response`.

The gate must not attempt to estimate safety from “number of drinks” alone and must not wait for Rescue completion.

### 4.2 WithdrawalRiskGate

Purpose: assess whether stopping or substantially reducing alcohol could require clinical withdrawal management.

Risk evidence should include structured history such as:

- prior alcohol-withdrawal seizure;
- prior delirium tremens or severe withdrawal hallucinosis;
- repeated prior withdrawal episodes;
- prolonged/heavy regular use pattern;
- current signs suggestive of withdrawal after reduction;
- concurrent physiological dependence on benzodiazepines, barbiturates or other relevant sedative-hypnotics;
- epilepsy;
- significant unstable medical illness;
- significant active psychiatric illness or cognitive impairment;
- older age/vulnerability where guideline policy calls for a lower threshold;
- prior medically assisted withdrawal history and complications;
- clinician-authored risk flags.

No single quantity threshold is sufficient on its own to authorize home withdrawal.

This gate may return `clinical_assessment_recommended`, `clinical_plan_required` or higher escalation.

### 4.3 PAWSS policy

PAWSS is a clinically validated predictor of complicated alcohol withdrawal in medically ill hospitalized populations and may inform the Alcohol Module’s risk-factor model.

UNTRAVA must **not** use PAWSS as a stand-alone consumer permission rule such as:

```text
PAWSS < 4 → safe to detox at home
```

Reasons:

- the strongest prospective validation was in medically ill inpatients;
- consumer-app conditions differ materially from the validated setting;
- a low score does not replace clinical assessment when other concerns are present.

PAWSS-derived factors may be represented as structured evidence, with provenance, but Safety routing remains a broader versioned rule set.

### 4.4 ActiveWithdrawalMonitor

Purpose: track symptoms after a user has reduced/stopped alcohol or is following a clinician-authored withdrawal plan.

This component is not a diagnostic engine and does not prescribe treatment.

It may track structured symptoms such as:

- tremor;
- sweating;
- nausea/vomiting;
- agitation/anxiety;
- sleep disturbance;
- perceptual disturbance;
- confusion/disorientation;
- seizure;
- other validated symptom fields.

Serious complications route to urgent/emergency assessment.

### 4.5 CIWA-Ar / SAWS policy

CIWA-Ar is a withdrawal **severity** assessment after alcohol withdrawal is present; ASAM explicitly notes that CIWA-Ar and similar symptom scales are not designed to predict whether a person who is not yet symptomatic will develop severe withdrawal.

Therefore:

- CIWA-Ar must not be used as the sole pre-cessation risk gate;
- consumer self-scoring must not become an autonomous medication/treatment algorithm;
- any future SAWS-style self-monitoring is symptom monitoring only and must remain inside the deterministic escalation architecture;
- no symptom score may directly calculate benzodiazepine or other medication doses in UNTRAVA.

### 4.6 WernickeNutritionGate

Purpose: identify situations where thiamine deficiency/Wernicke encephalopathy risk requires clinical routing.

Potential risk evidence includes validated policy fields such as:

- harmful/dependent long-term alcohol use;
- malnutrition or substantial recent weight loss;
- low body mass/nutritional concern;
- persistent vomiting;
- decompensated liver disease or other high-risk medical context;
- peripheral neuropathy/cognitive concerns;
- clinician-authored nutrition-risk flags.

Potential emergency neurologic signals include:

- new confusion/disorientation;
- ataxia/unsteadiness;
- abnormal eye movements/ophthalmologic signs;
- other validated Wernicke-suspect findings.

UNTRAVA may route risk but must never calculate thiamine route or dose. Suspected Wernicke encephalopathy is an urgent medical condition, not a Rescue intervention.

### 4.7 InteractionGate

Purpose: recognize alcohol + medication/substance combinations that materially increase acute risk.

High-priority examples include:

- opioids;
- benzodiazepines;
- other sedative-hypnotics/CNS depressants;
- clinician-configured medications with relevant alcohol warnings.

NIAAA identifies alcohol combined with opioids or benzodiazepines as particularly dangerous because of additive/synergistic effects on vital functions including respiration.

The app may warn, block unsafe behavior-support suggestions and escalate; it must not independently tell the user how to change prescribed medication.

### 4.8 MedicalVulnerabilityGate

Purpose: add lower-threshold clinical routing where self-directed change requires additional medical context.

Examples include:

- pregnancy;
- epilepsy;
- significant liver disease;
- unstable cardiac disease;
- severe active psychiatric illness;
- major cognitive impairment;
- serious concurrent illness;
- clinician-authored vulnerability flags.

This is not a diagnosis engine. The gate determines whether ordinary self-guided behavior support is appropriate or whether clinician involvement is required.

### 4.9 Pregnancy policy

For pregnancy:

- Alcohol Module does not present alcohol as safe during pregnancy.
- If harmful/dependent use is present or physiological dependence is suspected, the app routes to specialist clinical care rather than independently prescribing abrupt cessation.
- NICE recommends assisted alcohol withdrawal in collaboration with specialist mental-health/alcohol services, preferably inpatient, for pregnant women who are alcohol dependent.

The app therefore distinguishes:

```text
health goal: avoid alcohol in pregnancy
```

from:

```text
medical withdrawal decision: requires specialist assessment when dependence is present
```

### 4.10 ClinicianPlanAdapter

Purpose: allow UNTRAVA to support a plan authored/approved by a qualified clinician without becoming the prescriber.

A clinician plan may contain:

- permitted behavior targets;
- planned reduction or medically assisted withdrawal instructions;
- observation schedule;
- clinical contact/escalation instructions;
- medication instructions authored externally by the clinician;
- plan start/end/version.

UNTRAVA may:

- display the plan;
- remind the user;
- capture observations;
- record adherence facts;
- execute deterministic safety escalation.

UNTRAVA may **not**:

- invent a plan;
- change plan quantities;
- change medication/dose/timing;
- infer replacement medication;
- extend or shorten a clinician plan on its own.

## 5. Goal model

Alcohol goals are module-owned and use the Core Goal lifecycle.

Initial goal families planned for later implementation:

- `abstinence`;
- `reduction`;
- `alcohol_free_days`;
- `usage_limit`;
- optionally other validated goal types in future versions.

Core stores `goalId`, `moduleId`, lifecycle and immutable goal history. Alcohol Module owns goal configuration and semantics.

Safety is orthogonal to goal preference. A user may prefer abstinence while Safety still requires clinical withdrawal assessment before abrupt cessation.

Recovery never silently changes the current goal.

## 6. Alcohol use-event model — design principles

Detailed schema is deferred to TODO #32, but this spec fixes the principles.

Canonical use facts should preserve raw measurement inputs rather than only storing a policy-dependent “drink count”.

At minimum the Alcohol Module should be able to represent:

- beverage type/category;
- volume;
- alcohol by volume (ABV) when known;
- calculated pure-ethanol amount;
- event time;
- context/trigger metadata;
- planned vs unplanned status;
- source/provenance and confidence for estimated quantities.

### 6.1 Standard-drink policy

A “standard drink” is jurisdiction-dependent. NIAAA uses 14 g pure alcohol for the U.S.; WHO tracks whether countries define a national standard drink, confirming that this is a policy-level concept rather than a universal storage unit.

Therefore:

- canonical storage must not be only `standardDrinks: number`;
- pure-ethanol calculation and raw beverage inputs must be retained;
- standard-drink/unit conversion uses an explicit versioned `measurementProfile` or `guidanceProfile`;
- changing locale/guideline must not rewrite historical raw facts.

Core must not know any standard-drink definition.

## 7. “Safe drinking” language

UNTRAVA must not label a quantity as universally “safe”. WHO states that no form of alcohol consumption is risk-free and that even low levels carry some risk.

The app may display jurisdiction-specific **lower-risk guidance** or clinical targets when appropriate, but those values must be:

- source-attributed;
- versioned;
- jurisdiction-aware;
- clearly distinguished from a guarantee of safety.

## 8. Alcohol Rescue

Alcohol Rescue reuses the Core Rescue state machine but uses Alcohol-owned context, eligibility, content and safety policy.

Potential intervention families for later implementation include:

- urge/craving regulation;
- delay;
- non-alcohol substitution;
- environment change;
- ACT urge surfing;
- CBT reframe;
- human support;
- Recovery-specific reset/support.

Critical ordering rule:

```text
Alcohol Safety Orchestrator
        ↓
allowed behavior-support surface
        ↓
Core Rescue orchestration
        ↓
Alcohol intervention content
```

Rescue cannot bypass a medical safety decision. For example, if the user appears at significant risk of dangerous withdrawal, Rescue may offer coping/support while arranging clinical routing, but must not instruct abrupt cessation as a generic craving intervention.

## 9. Alcohol Recovery

Alcohol Recovery adopts the existing Core non-punitive invariants:

- an alcohol-use event is appended as fact;
- previous progress/history is not deleted;
- a single use does not automatically create a `relapse` or `goal_failed` fact;
- current `goalId` is preserved unless the user explicitly changes it;
- Recovery language is non-shaming;
- outcomes are factual observations, not causal proof that an intervention worked.

This supports abstinence and non-abstinence goals without treating every episode as total failure.

## 10. Alcohol use-risk vs AUD vs dependence vs withdrawal

The Alcohol Module must keep these concepts separate:

```text
AlcoholUseRisk
AUDScreeningSignal
PhysicalDependenceRisk
WithdrawalComplicationRisk
CurrentWithdrawalSeverity
AcuteIntoxicationRisk
```

They are related but not interchangeable.

AUDIT/AUDIT-C-style screening may be added as validated screening inputs, but:

- screening does not diagnose AUD by itself;
- AUD score is not a withdrawal-safety score;
- withdrawal routing must consider withdrawal-specific history and current medical context.

## 11. Labs and connected health data

Future integrations may supply liver tests, blood counts, diagnoses, medication lists, sleep/activity or other health data.

Rules:

- labs are contextual evidence, not autonomous AUD diagnosis;
- normal liver tests do not prove absence of alcohol-related liver disease;
- abnormal liver tests do not prove alcohol causation;
- medication lists can inform InteractionGate but do not authorize medication changes;
- all connected-health inputs carry provenance and freshness metadata;
- uncertainty/missingness must be explicit.

## 12. Safety rule versioning

Every deterministic safety policy must have immutable version identity.

Conceptually:

```text
alcoholSafetyRuleSetId
alcoholSafetyRuleSetVersion
publishedAt
sourceGuidelineRefs[]
checksum
```

A safety decision records the version used. Historical safety decisions remain interpretable after guidelines change.

Updated rule sets install with integrity validation and fail closed. A running clinical/safety flow must not silently jump rule versions mid-decision.

## 13. Offline behavior

The following must work without network or generative AI:

- alcohol-use event capture;
- canonical measurement calculation using installed measurement profile;
- essential emergency/withdrawal-risk blocking gates;
- current safety rule set lookup;
- Rescue state machine;
- Recovery flow;
- local immutable event persistence;
- clinician-plan viewing if previously cached and validated;
- queued sync.

If an essential safety rule set is corrupt/missing, the app may still capture facts but must not authorize a risky self-guided withdrawal path.

## 14. Privacy and logging

Alcohol data may contain particularly sensitive health and behavioral information.

Operational logs must not contain:

- free-text drinking narratives;
- full use-event payloads;
- medication lists;
- exact clinical-plan contents;
- pregnancy status;
- withdrawal symptom details;
- contact details;
- exact location.

Safe operational metadata may include constrained identifiers such as module id, rule-set version, gate id, coarse disposition code and non-sensitive error class, subject to the shared Core logging allowlist.

## 15. Intelligence boundary

Future Alcohol Intelligence may derive patterns such as time-of-day risk, trigger clusters, goal adherence, consumption trends or Rescue-response patterns.

It may provide:

- derived pattern facts;
- ranked candidate interventions;
- explanatory summaries with provenance;
- uncertainty/confidence metadata.

It may **not**:

- override Alcohol Safety Orchestrator;
- authorize detox;
- generate taper schedules;
- prescribe medication;
- mutate raw use facts;
- change goals;
- trigger Support automatically;
- present correlation as proven causation.

Removing Intelligence entirely must not break offline Alcohol Rescue/Recovery/safety routing.

## 16. Cross-module coexistence

A user may simultaneously have Tobacco and Alcohol goals.

Requirements:

- `moduleId` namespaces domain data;
- one module cannot mutate another module’s goals/events;
- Alcohol Safety does not affect Tobacco schemas;
- Tobacco Safety does not interpret Alcohol events;
- both share Core event store/sync infrastructure;
- corrections/retractions retain module identity;
- cross-module intelligence, if ever added, requires an explicit normalized adapter and consent rather than direct raw-schema coupling.

## 17. Error handling / fail-closed behavior

Examples:

- invalid/corrupt Alcohol safety rule set → do not authorize risky self-guided withdrawal;
- unknown clinician-plan version → display unavailable/stale state, do not infer replacements;
- impossible measurement inputs → preserve user intent as draft/error state, do not fabricate ethanol quantity;
- stale medication/medical context → show freshness uncertainty and use conservative routing where required by policy;
- unavailable AI/server → deterministic safety/Rescue/Recovery continue locally;
- persistence failure during safety/session transition → state does not advance until local persistence succeeds.

## 18. Acceptance criteria for the Alcohol Module architecture

This design is considered implemented only when later tasks prove all of the following:

1. Core source contains no Alcohol goal enums, beverage types, standard-drink rules or withdrawal logic.
2. Alcohol Module has module-owned goals and use-event schemas.
3. Raw measurement inputs and pure-ethanol representation are preserved independently of jurisdiction-specific standard-drink display.
4. Acute intoxication/emergency routing can interrupt normal Rescue.
5. Withdrawal risk is evaluated independently of craving/Rescue.
6. PAWSS is not a consumer stand-alone permission rule.
7. CIWA-Ar is not used as pre-withdrawal risk prediction or autonomous medication dosing.
8. Wernicke/nutrition risk has an independent gate.
9. Opioid/benzodiazepine/sedative interaction risk has an independent gate.
10. Pregnancy + dependence routes to specialist clinical assessment rather than autonomous abrupt-cessation advice.
11. UNTRAVA never generates its own taper schedule.
12. UNTRAVA never generates medication dosing.
13. Clinician-authored plans are immutable/versioned inputs; UNTRAVA cannot change them autonomously.
14. Alcohol Rescue cannot override medical safety gates.
15. Alcohol Recovery preserves history and goal identity and remains non-punitive.
16. Essential safety routing works offline with a validated locally installed rule set.
17. Safety decisions record rule-set version and evidence references.
18. Tobacco acceptance behavior remains unchanged.
19. Tobacco + Alcohol coexist on the shared local event store/sync path without schema collision.
20. Exact-HEAD CI remains green after each implementation milestone.

## 19. Implementation sequence mapped to roadmap

This spec defines architecture only. Implementation remains deliberately decomposed:

- **#31** Alcohol goal types and goal-config contracts.
- **#32** Alcohol use-event model and measurement contracts.
- **#33** Alcohol-specific Safety Engine/Orchestrator and dangerous-withdrawal routing.
- **#34** Hard invariant: no taper/medication dosing authority.
- **#35** Alcohol Rescue Library.
- **#36** Alcohol Recovery Flow.
- **#37** Alcohol Pattern/Risk Engine data contracts.
- **#38** Alcohol vertical offline E2E.
- **#39** Tobacco + Alcohol cross-module coexistence test.
- **#40** Intelligence Engines only after Core + Tobacco + Alcohol prerequisites are green.

No #31–#39 implementation is part of this document commit.

## 20. Medical evidence and source policy

The medical architecture above is grounded in current authoritative guidance and validation literature available as of 2026-09-16. These references guide architecture; they are not copied into code as permanent unversioned medical truth. Production safety policy must record source/version metadata so later guideline updates can be reviewed and deployed deliberately.

Primary references:

1. American Society of Addiction Medicine (ASAM), *The ASAM Clinical Practice Guideline on Alcohol Withdrawal Management* (2020). https://www.asam.org/docs/default-source/quality-science/the_asam_clinical_practice_guideline_on_alcohol-1.pdf
2. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Harm reduction*; published 2025-11-28, updated 2026-04-17. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/8-harm-reduction
3. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Pharmacological interventions*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/10-pharmacological-interventions
4. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Community based medically assisted withdrawal*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/11-community-based-medically-assisted-withdrawal
5. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Alcohol care in acute hospitals*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/16-alcohol-care-in-acute-hospitals
6. NICE CG115, *Alcohol-use disorders: diagnosis, assessment and management of harmful drinking and alcohol dependence*. https://www.nice.org.uk/guidance/cg115/chapter/Recommendations
7. NICE CG192, pregnancy/postnatal recommendations for harmful/dependent alcohol misuse and assisted withdrawal. https://www.nice.org.uk/guidance/cg192/chapter/Recommendations
8. NIAAA, *Understanding the Dangers of Alcohol Overdose*. https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose
9. NIAAA, *Alcohol-Medication Interactions: Potentially Dangerous Mixes*. https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/alcohol-medication-interactions-potentially-dangerous-mixes
10. NIAAA, *What is a Standard Drink*. https://rethinkingdrinking.niaaa.nih.gov/how-much-too-much/whats-standard-drink
11. WHO, *Alcohol* fact sheet. https://www.who.int/news-room/fact-sheets/detail/alcohol
12. WHO Global Health Observatory, *Alcohol policy: standard drink defined*. https://www.who.int/data/gho/data/indicators/indicator-details/GHO/standard-drink-defined
13. Maldonado JR et al. *Prospective Validation Study of the Prediction of Alcohol Withdrawal Severity Scale (PAWSS) in Medically Ill Inpatients*. Alcohol Alcohol. 2015;50(5):509-518. PMID 25999438. https://pubmed.ncbi.nlm.nih.gov/25999438/

## 21. Non-goals

This spec does not:

- diagnose AUD;
- create a medical device claim;
- define medication regimens;
- define a taper protocol;
- implement PAWSS/CIWA-Ar scoring;
- define final Alcohol event TypeScript schemas (#32);
- implement safety logic (#33/#34);
- implement Rescue content (#35);
- implement Alcohol Intelligence (#37/#40);
- merge to `main`;
- touch production infrastructure.
