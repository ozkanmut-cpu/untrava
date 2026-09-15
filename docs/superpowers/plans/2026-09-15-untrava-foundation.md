# UNTRAVA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently testable UNTRAVA vertical foundation: repository/tooling, typed shared contracts, identity/consent, append-oriented quit events, quit profile/goals/product model, and a local-first mobile event/sync core that can operate offline.

**Architecture:** Use a TypeScript monorepo with a Fastify modular-monolith API, PostgreSQL/Prisma persistence, shared Zod contracts, and React Native/Expo mobile shell. Domain modules own their persistence and expose narrow typed services; mobile writes client-generated immutable events locally first and syncs idempotently. Risk, Rescue, AI, subscriptions, support, health integrations and UI product flows are deliberately separate follow-on plans so this milestone stays reviewable and executable.

**Tech Stack:** Node.js 24 LTS; TypeScript 5.x strict mode; pnpm workspaces; Fastify 5; Prisma 6 + PostgreSQL 17; Zod 4; Vitest 3; React Native 0.81 / Expo SDK 54; Expo SQLite; ESLint 9; Prettier 3; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-untrava-design.md`

## Global Constraints

- Rescue must eventually work offline; this foundation must never make local event capture depend on network availability.
- Safety must not depend on an LLM; no generative-AI dependency belongs in this foundation.
- Raw quit events are append-oriented; corrections/retractions are new auditable events, never in-place behavioral-history edits.
- Every event is identified by a client-generated UUID and server ingestion is idempotent.
- NRT/treatment data is modeled separately from tobacco-product use and cannot count as smoking failure.
- Goals distinguish `smoke_free`, `tobacco_free`, `nicotine_free`, and `reduction`.
- V1 product model supports `cigarette`, `vape`, `heated_tobacco`, and `multi_product` contexts without flattening all raw usage into cigarettes/day.
- Subscription state must never own or delete raw user history.
- Sensitive health/cessation data must not be emitted into ordinary application logs.
- Secrets never enter source control.
- No release/green claim is made until the required CI run has actually completed successfully.

---

## File Structure

```text
.github/workflows/ci.yml                 # repository-wide quality gate
.editorconfig                            # editor consistency
.gitignore                               # generated/secrets exclusions
.nvmrc                                   # Node 24 runtime pin
package.json                             # root scripts/workspace metadata
pnpm-workspace.yaml                      # workspace declaration
tsconfig.base.json                       # strict shared TS config
eslint.config.mjs                        # lint rules
.prettierrc.json                         # formatting rules

docker-compose.yml                      # local PostgreSQL only

packages/contracts/src/index.ts          # public contract barrel
packages/contracts/src/ids.ts            # branded UUID schemas/types
packages/contracts/src/events.ts         # immutable quit-event envelopes/payloads
packages/contracts/src/profile.ts        # products, strategies, goals, profile contracts
packages/contracts/src/consent.ts        # consent categories/actions/contracts
packages/contracts/test/*.test.ts        # contract invariants

apps/api/src/app.ts                      # Fastify composition root
apps/api/src/server.ts                   # process/bootstrap only
apps/api/src/lib/env.ts                  # validated environment
apps/api/src/lib/errors.ts               # stable API error envelope
apps/api/src/modules/identity/*           # user/device-session domain
apps/api/src/modules/consent/*            # consent ledger domain
apps/api/src/modules/events/*             # append/idempotent event ingestion
apps/api/src/modules/quit-profile/*       # profile/goals/products domain
apps/api/prisma/schema.prisma            # relational persistence schema
apps/api/prisma/migrations/*             # generated migration history
apps/api/test/helpers/*                   # DB/app test harness

apps/mobile/App.tsx                      # minimal shell proving foundation wiring
apps/mobile/src/db/database.ts           # SQLite initialization
apps/mobile/src/events/localEventStore.ts# local immutable event persistence
apps/mobile/src/sync/syncQueue.ts        # pending queue/retry state
apps/mobile/src/sync/syncClient.ts       # API batch transport
apps/mobile/src/sync/syncWorker.ts       # idempotent queue orchestration
apps/mobile/src/session/deviceIdentity.ts# stable client/device IDs
apps/mobile/src/foundation.ts            # typed mobile foundation facade
apps/mobile/test/*.test.ts               # offline/sync tests
```

## Interfaces Locked by This Plan

```ts
export type ProductType = 'cigarette' | 'vape' | 'heated_tobacco';
export type GoalType = 'smoke_free' | 'tobacco_free' | 'nicotine_free' | 'reduction';
export type QuitStrategy = 'quit_now' | 'future_date' | 'gradual_reduction' | 'learn_first';

export type QuitEventType =
  | 'product_use'
  | 'craving'
  | 'withdrawal_observation'
  | 'intervention_started'
  | 'intervention_completed'
  | 'intervention_outcome'
  | 'support_request'
  | 'notification_response'
  | 'goal_changed'
  | 'treatment_adherence'
  | 'health_context_observation'
  | 'correction'
  | 'retraction';

export interface QuitEventEnvelope<TPayload = unknown> {
  eventId: string;
  userId: string;
  deviceId: string;
  eventType: QuitEventType;
  occurredAt: string;
  recordedAt: string;
  schemaVersion: 1;
  payload: TPayload;
}

export interface EventIngestResult {
  eventId: string;
  status: 'accepted' | 'duplicate';
}

export interface SyncBatchRequest { events: QuitEventEnvelope[]; }
export interface SyncBatchResponse { results: EventIngestResult[]; }
```

---

### Task 1: Repository Toolchain and CI Baseline

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.github/workflows/ci.yml`
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`, `packages/contracts/test/smoke.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: root commands `pnpm lint`, `pnpm typecheck`, `pnpm test`; workspace package `@untrava/contracts`.

- [ ] **Step 1: Write the failing workspace smoke test**

```ts
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

describe('@untrava/contracts', () => {
  it('loads as a workspace package', () => {
    expect(contracts).toBeDefined();
  });
});
```

- [ ] **Step 2: Add the minimal workspace/tooling configuration**

Use Node `24`, `pnpm@10`, strict TypeScript, Vitest, ESLint and Prettier. Root scripts must be:

```json
{
  "scripts": {
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  }
}
```

`packages/contracts/src/index.ts` initially contains:

```ts
export const CONTRACT_SCHEMA_VERSION = 1 as const;
```

- [ ] **Step 3: Install and verify locally**

Run:

```bash
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`; smoke test passes.

- [ ] **Step 4: Add CI**

`.github/workflows/ci.yml` must run on pushes and pull requests, use Node 24 + pnpm cache, then execute exactly:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: establish Untrava monorepo quality gates"
```

---

### Task 2: Typed IDs, Product, Goal and Strategy Contracts

**Files:**
- Create: `packages/contracts/src/ids.ts`, `packages/contracts/src/profile.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/profile.test.ts`

**Interfaces:**
- Consumes: Zod.
- Produces: `UserIdSchema`, `DeviceIdSchema`, `EventIdSchema`, `ProductTypeSchema`, `GoalTypeSchema`, `QuitStrategySchema`, `QuitProfileSchema`, `GoalSchema`.

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { GoalSchema, ProductTypeSchema, QuitStrategySchema } from '../src';

describe('quit profile contracts', () => {
  it('accepts all V1 products without cigarette normalization', () => {
    for (const product of ['cigarette', 'vape', 'heated_tobacco']) {
      expect(ProductTypeSchema.parse(product)).toBe(product);
    }
  });

  it('keeps nicotine-free distinct from smoke-free', () => {
    expect(GoalSchema.parse({ id: crypto.randomUUID(), type: 'nicotine_free', startsAt: '2026-09-15T08:00:00.000Z' }).type)
      .toBe('nicotine_free');
  });

  it('supports all four starting strategies', () => {
    expect(QuitStrategySchema.options).toEqual([
      'quit_now', 'future_date', 'gradual_reduction', 'learn_first'
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the contracts are missing**

Run: `pnpm --filter @untrava/contracts test -- profile.test.ts`
Expected: FAIL because the schemas are not exported.

- [ ] **Step 3: Implement the exact schemas**

`profile.ts` must use Zod enums for the locked strings and define `GoalSchema` with UUID `id`, `type`, ISO `startsAt`, nullable `endsAt`, and optional reduction target metadata. `QuitProfileSchema` contains `userId`, non-empty `products`, `strategy`, optional `quitDate`, and `createdAt/updatedAt`. Do not add NRT to `ProductTypeSchema`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @untrava/contracts test -- profile.test.ts
pnpm typecheck
```

Expected: PASS and exit `0`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: define quit profile and goal contracts"
```

---

### Task 3: Immutable Quit Event Contracts

**Files:**
- Create: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/events.test.ts`

**Interfaces:**
- Consumes: ID schemas from Task 2.
- Produces: `QuitEventTypeSchema`, `QuitEventEnvelopeSchema`, `SyncBatchRequestSchema`, `SyncBatchResponseSchema`, and the TypeScript interfaces in the plan header.

- [ ] **Step 1: Write failing event tests**

```ts
import { describe, expect, it } from 'vitest';
import { QuitEventEnvelopeSchema } from '../src';

const base = {
  eventId: crypto.randomUUID(), userId: crypto.randomUUID(), deviceId: crypto.randomUUID(),
  occurredAt: '2026-09-15T08:00:00.000Z', recordedAt: '2026-09-15T08:00:01.000Z', schemaVersion: 1
};

describe('quit events', () => {
  it('accepts a product-use event', () => {
    expect(QuitEventEnvelopeSchema.parse({
      ...base, eventType: 'product_use', payload: { product: 'cigarette', quantity: 1 }
    }).eventType).toBe('product_use');
  });

  it('requires correction to reference an earlier event', () => {
    expect(() => QuitEventEnvelopeSchema.parse({
      ...base, eventType: 'correction', payload: { reason: 'wrong quantity' }
    })).toThrow();
  });

  it('keeps treatment adherence separate from product use', () => {
    expect(QuitEventEnvelopeSchema.parse({
      ...base, eventType: 'treatment_adherence', payload: { treatmentKind: 'nrt', status: 'taken' }
    }).eventType).toBe('treatment_adherence');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @untrava/contracts test -- events.test.ts`
Expected: FAIL because event contracts do not exist.

- [ ] **Step 3: Implement discriminated event payload schemas**

Create a discriminated union on `eventType`. `correction` and `retraction` payloads must contain `targetEventId`; `product_use` must contain `product` and positive `quantity`; `treatment_adherence` must use `treatmentKind` and `status` and never a `ProductType`. Keep `schemaVersion` literal `1`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @untrava/contracts test -- events.test.ts
pnpm test
pnpm typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: define immutable quit event contracts"
```

---

### Task 4: API Composition Root and PostgreSQL Test Harness

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/lib/env.ts`, `apps/api/src/lib/errors.ts`
- Create: `apps/api/prisma/schema.prisma`, `apps/api/test/helpers/app.ts`, `apps/api/test/health.test.ts`, `docker-compose.yml`

**Interfaces:**
- Consumes: `@untrava/contracts`.
- Produces: `buildApp(): Promise<FastifyInstance>`, validated `env`, Prisma client wiring, `GET /health`.

- [ ] **Step 1: Write failing health test**

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('GET /health', () => {
  it('returns an explicit healthy response', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @untrava/api test -- health.test.ts`
Expected: FAIL because `buildApp` is missing.

- [ ] **Step 3: Implement minimal API bootstrap**

`buildApp` creates Fastify with logging configured to redact `authorization`, cookies and request bodies; registers `GET /health`; `server.ts` only validates environment, builds app and listens. `docker-compose.yml` exposes PostgreSQL 17 for local development. The Prisma schema begins with PostgreSQL datasource and UUID-backed `User`/`DeviceSession` placeholders needed by Task 5.

- [ ] **Step 4: Verify API and schema**

Run:

```bash
pnpm --filter @untrava/api test -- health.test.ts
pnpm --filter @untrava/api prisma validate
pnpm typecheck
```

Expected: all exit `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/api docker-compose.yml pnpm-lock.yaml
git commit -m "feat: establish modular API foundation"
```

---

### Task 5: Identity and Device Sessions

**Files:**
- Create: `apps/api/src/modules/identity/identity.repository.ts`, `identity.service.ts`, `identity.routes.ts`, `identity.schemas.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/identity.test.ts`

**Interfaces:**
- Consumes: UUID schemas and Prisma.
- Produces: `IdentityService.createAnonymousUser(deviceId)`, `IdentityService.revokeDeviceSession(userId, sessionId)`, routes `POST /v1/identity/anonymous`, `DELETE /v1/device-sessions/:sessionId`.

- [ ] **Step 1: Write failing identity test**

```ts
it('creates a user and bound device session', async () => {
  const deviceId = crypto.randomUUID();
  const response = await app.inject({
    method: 'POST', url: '/v1/identity/anonymous', payload: { deviceId }
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ deviceId });
  expect(response.json().userId).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.json().sessionId).toMatch(/^[0-9a-f-]{36}$/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @untrava/api test -- identity.test.ts`
Expected: route returns `404`.

- [ ] **Step 3: Implement persistence and service**

`User` has UUID `id`, timestamps and account status. `DeviceSession` has UUID `id`, `userId`, `deviceId`, `createdAt`, nullable `revokedAt`, and a unique active binding strategy. The service owns creation/revocation; route handlers contain no persistence logic. Return opaque session credentials from an authentication adapter boundary rather than logging them.

- [ ] **Step 4: Verify creation and revocation**

Add a second test that revokes the session and proves a second revocation is idempotent. Run API tests and `prisma validate`.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add user and device session identity"
```

---

### Task 6: Consent Ledger

**Files:**
- Create: `packages/contracts/src/consent.ts`, `packages/contracts/test/consent.test.ts`
- Create: `apps/api/src/modules/consent/consent.repository.ts`, `consent.service.ts`, `consent.routes.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/consent.test.ts`

**Interfaces:**
- Produces: `ConsentCategorySchema`, `ConsentActionSchema`; `ConsentService.record(entry)`; `ConsentService.getEffective(userId, category, recipientId?)`; `POST /v1/consents`; `GET /v1/consents/effective`.

- [ ] **Step 1: Write failing ledger test**

```ts
it('uses the latest ledger entry as effective consent', async () => {
  await consent.record({ userId, category: 'progress', action: 'grant', purpose: 'support_circle', version: 1 });
  await consent.record({ userId, category: 'progress', action: 'revoke', purpose: 'support_circle', version: 1 });
  expect(await consent.getEffective(userId, 'progress')).toBe('revoke');
});
```

- [ ] **Step 2: Verify failure**

Run contract/API consent tests; expected failure is missing consent module.

- [ ] **Step 3: Implement append-only ledger**

Persist `ConsentLedgerEntry` with UUID, user, optional recipient, category, purpose, action (`grant|revoke`), consent version and timestamp. Never update an existing consent entry. Effective permission is the latest matching entry by timestamp/id.

- [ ] **Step 4: Verify revocation semantics**

Add route test proving a revoke immediately changes effective permission. Run `pnpm test && pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts apps/api
git commit -m "feat: add append-only consent ledger"
```

---

### Task 7: Idempotent Quit Event Ingestion

**Files:**
- Create: `apps/api/src/modules/events/event.repository.ts`, `event.service.ts`, `event.routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/events.test.ts`

**Interfaces:**
- Consumes: `QuitEventEnvelopeSchema`, authenticated user/device context.
- Produces: `EventService.ingestBatch(userId, events): Promise<SyncBatchResponse>`; `POST /v1/events/batch`.

- [ ] **Step 1: Write failing duplicate-ingest test**

```ts
it('accepts the same client event exactly once', async () => {
  const event = productUseEvent({ userId, deviceId, eventId: crypto.randomUUID() });
  const first = await service.ingestBatch(userId, [event]);
  const second = await service.ingestBatch(userId, [event]);
  expect(first.results[0].status).toBe('accepted');
  expect(second.results[0].status).toBe('duplicate');
  expect(await repository.countByEventId(event.eventId)).toBe(1);
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @untrava/api test -- events.test.ts`
Expected: missing event service/repository.

- [ ] **Step 3: Implement append-only event table and batch ingestion**

Persist unique `eventId`, owner `userId`, `deviceId`, `eventType`, timestamps, schema version and JSON payload. Validate envelope before persistence and reject events whose envelope `userId` differs from authenticated user. Duplicate unique IDs return `duplicate` without rewriting stored payload.

- [ ] **Step 4: Add correction/retraction integrity test**

Test that correction/retraction targets must exist and belong to the same user; original row remains unchanged after correction ingestion.

- [ ] **Step 5: Run full verification and commit**

```bash
pnpm test
pnpm typecheck
pnpm lint
git add apps/api
git commit -m "feat: ingest quit events idempotently"
```

---

### Task 8: Quit Profile, Product Baseline and Time-Varying Goals

**Files:**
- Create: `apps/api/src/modules/quit-profile/profile.repository.ts`, `profile.service.ts`, `profile.routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/profile.test.ts`

**Interfaces:**
- Consumes: profile/goal contracts.
- Produces: `ProfileService.createProfile`, `ProfileService.startGoal`, `ProfileService.endGoal`; `PUT /v1/quit-profile`, `POST /v1/goals`, `POST /v1/goals/:goalId/end`.

- [ ] **Step 1: Write failing goal-history test**

```ts
it('starts a new goal without deleting prior goal history', async () => {
  const first = await service.startGoal(userId, { type: 'smoke_free', startsAt: '2026-09-15T08:00:00.000Z' });
  await service.endGoal(userId, first.id, '2026-09-20T08:00:00.000Z');
  const second = await service.startGoal(userId, { type: 'nicotine_free', startsAt: '2026-09-20T08:00:00.000Z' });
  expect((await repository.listGoals(userId)).map(g => g.id)).toEqual([first.id, second.id]);
});
```

- [ ] **Step 2: Verify failure**

Run profile tests; expected failure is missing service.

- [ ] **Step 3: Implement profile and baseline models**

Persist profile strategy and product-specific baseline records. Cigarette baseline may use cigarettes/day; vape baseline retains its own quantity/unit metadata; heated tobacco retains sticks/sessions metadata. `Goal` is its own time-varying table. Ending a goal sets `endsAt`; it does not delete it.

- [ ] **Step 4: Add NRT separation test**

Prove `ProductTypeSchema` rejects `nrt` and treatment adherence remains accepted only through quit events. Run profile + contract tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/contracts
git commit -m "feat: add quit profile and goal history"
```

---

### Task 9: Mobile Shell and Stable Device Identity

**Files:**
- Create: `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `apps/mobile/app.json`, `apps/mobile/App.tsx`
- Create: `apps/mobile/src/session/deviceIdentity.ts`, `apps/mobile/src/foundation.ts`
- Test: `apps/mobile/test/deviceIdentity.test.ts`

**Interfaces:**
- Consumes: `@untrava/contracts`.
- Produces: `getOrCreateDeviceId(): Promise<string>` and `createFoundation()`.

- [ ] **Step 1: Write failing stable-ID test**

```ts
it('reuses the same persisted device id', async () => {
  const first = await getOrCreateDeviceId(storage);
  const second = await getOrCreateDeviceId(storage);
  expect(second).toBe(first);
});
```

- [ ] **Step 2: Verify failure**

Run mobile test; expected missing module.

- [ ] **Step 3: Implement minimal Expo shell and device identity adapter**

Keep storage behind a small `KeyValueStore` interface so tests use memory storage and the app uses secure/platform storage. `App.tsx` displays only a neutral UNTRAVA foundation screen; no product UX is invented in this milestone.

- [ ] **Step 4: Verify mobile package**

Run:

```bash
pnpm --filter @untrava/mobile test
pnpm --filter @untrava/mobile typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat: establish mobile foundation and device identity"
```

---

### Task 10: Local Immutable Event Store

**Files:**
- Create: `apps/mobile/src/db/database.ts`, `apps/mobile/src/events/localEventStore.ts`
- Test: `apps/mobile/test/localEventStore.test.ts`

**Interfaces:**
- Produces: `LocalEventStore.append(event)`, `get(eventId)`, `listPending(limit)`, `markSynced(eventId, syncedAt)`.

- [ ] **Step 1: Write failing offline append test**

```ts
it('persists an event without a network dependency', async () => {
  await store.append(event);
  expect(await store.get(event.eventId)).toEqual(expect.objectContaining({ eventId: event.eventId }));
  expect(network.calls).toBe(0);
});
```

- [ ] **Step 2: Verify failure**

Run local-store test; expected missing store.

- [ ] **Step 3: Implement SQLite event persistence**

Create table `quit_events_local` keyed by `event_id`, storing serialized validated envelope, `sync_state` (`pending|synced|failed`), attempt count, next-attempt timestamp and synced timestamp. `append` is insert-only; duplicate identical IDs are no-ops locally and conflicting duplicate content throws a local integrity error.

- [ ] **Step 4: Add correction test**

Append original + correction and assert both rows remain queryable. Run mobile tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: persist quit events locally first"
```

---

### Task 11: Sync Queue, Retry and Idempotent Batch Transport

**Files:**
- Create: `apps/mobile/src/sync/syncQueue.ts`, `syncClient.ts`, `syncWorker.ts`
- Modify: `apps/mobile/src/foundation.ts`
- Test: `apps/mobile/test/syncWorker.test.ts`

**Interfaces:**
- Consumes: `LocalEventStore.listPending`, API `POST /v1/events/batch`.
- Produces: `SyncWorker.runOnce(now): Promise<{synced:number; failed:number}>`.

- [ ] **Step 1: Write failing retry test**

```ts
it('keeps events pending after network failure and syncs them on retry', async () => {
  client.failNext(new Error('offline'));
  expect(await worker.runOnce(now)).toEqual({ synced: 0, failed: 1 });
  expect((await store.get(event.eventId))?.syncState).toBe('pending');

  expect(await worker.runOnce(later)).toEqual({ synced: 1, failed: 0 });
  expect((await store.get(event.eventId))?.syncState).toBe('synced');
});
```

- [ ] **Step 2: Verify failure**

Run sync test; expected missing worker.

- [ ] **Step 3: Implement bounded exponential backoff**

Use deterministic delay `min(2 ** attempt * 5 seconds, 15 minutes)` with injectable clock. Batch only due pending events. Treat server `accepted` and `duplicate` as successfully synchronized. A transport failure increments attempt metadata but never deletes the local event.

- [ ] **Step 4: Add replay test**

Simulate response loss after server acceptance, then retry same event ID. Server returns `duplicate`; worker marks local event synced. This proves end-to-end at-least-once delivery with idempotent ingestion.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: add resilient local-first event sync"
```

---

### Task 12: Database Migration, Foundation Integration Test and CI Expansion

**Files:**
- Create: `apps/api/prisma/migrations/<generated>_foundation/migration.sql`
- Create: `apps/api/test/foundation-flow.test.ts`
- Modify: `.github/workflows/ci.yml`, root scripts as required

**Interfaces:**
- Consumes: Tasks 1–11.
- Produces: reproducible database schema and a CI-gated vertical foundation.

- [ ] **Step 1: Write the failing vertical integration test**

The test must execute this exact sequence: create anonymous identity/device → record consent → create profile + smoke-free goal → ingest a cigarette-use event → replay same event → ingest correction → assert original and correction both exist and replay created no third copy.

```ts
expect(firstIngest.results[0].status).toBe('accepted');
expect(replay.results[0].status).toBe('duplicate');
expect(await events.countForUser(userId)).toBe(2); // original + correction
```

- [ ] **Step 2: Generate and inspect the migration**

Run:

```bash
docker compose up -d postgres
pnpm --filter @untrava/api prisma migrate dev --name foundation
pnpm --filter @untrava/api prisma validate
```

Expected: migration succeeds and schema validates. Inspect SQL to confirm unique event IDs, foreign keys, append-oriented consent/event tables and no cascade from subscription-related state (none exists in this milestone) to user history.

- [ ] **Step 3: Run complete local verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @untrava/api prisma validate
```

Expected: all exit `0`.

- [ ] **Step 4: Expand CI with PostgreSQL and migration validation**

CI must start PostgreSQL 17, set a test `DATABASE_URL`, run `prisma migrate deploy`, then run lint, typecheck and all tests. No secrets beyond ephemeral CI database credentials are committed.

- [ ] **Step 5: Commit and verify remote CI**

```bash
git add .github apps/api/prisma apps/api/test package.json pnpm-lock.yaml
git commit -m "test: gate Untrava foundation end to end"
git push
```

Wait for the GitHub Actions run for this commit to reach `completed/success`. If it fails, inspect the first real failing job/log, fix only that failure, commit, and re-run verification. Do not describe the milestone as green before remote CI succeeds.

---

## Acceptance Gate for This Plan

The foundation milestone is complete only when all of the following are demonstrated by tests/CI:

- contracts preserve separate product, goal, treatment and event semantics;
- user/device identity and revocable sessions exist;
- consent is an append-only ledger;
- quit events are immutable, correction/retraction based and idempotently ingested;
- quit profile and time-varying goals preserve history;
- mobile can create and persist events with zero network access;
- failed sync never loses an event;
- replay after uncertain delivery produces one server event and eventually marks the local copy synced;
- Prisma migrations apply from a clean PostgreSQL database;
- lint, typecheck, tests and migration validation pass in remote GitHub Actions.

## Follow-on Plans

After this foundation is green, create separate implementation plans, each grounded in the same approved design spec, in this dependency order:

1. `untrava-rescue-interventions` — versioned intervention library, offline Rescue flow, outcome/reassessment and Recovery Flow.
2. `untrava-intelligence-engines` — Context Builder, deterministic Safety, Risk, Intervention ranking, Learning, uncertainty and Notification Budget.
3. `untrava-core-mobile-ux` — onboarding, first 14 days, home, progress/mastery, withdrawal, savings/rewards.
4. `untrava-autopilot-notifications-ai` — Pre-Craving/autopilot delivery and bounded Coach/Friend/Analyst communication layer.
5. `untrava-support-together` — Support Circle permissions/companion, Rescue Contact and anonymous Together.
6. `untrava-monetization` — 14-day cardless trial, Free/Premium entitlements, ads and no-ad critical-flow enforcement.
7. `untrava-health-wearables` — Health Connect, Apple Health, Wear OS/Apple Watch and manual CO/sensor API.
8. `untrava-reporting-release` — professional reports, observability, privacy/export/delete, E2E, store/release hardening.

Each follow-on plan must retain the 15 non-negotiable invariants from the approved design specification.