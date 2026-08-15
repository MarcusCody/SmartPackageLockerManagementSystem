# Smart Package Locker Management System

A locker station where **delivery agents store packages** and **customers retrieve them** with a pickup code — built for the Everest Engineering coding challenge (Levels 1–4, including the optional concurrency level).

- **Server:** TypeScript (strict), Node 20, Express 5, zod — domain-driven, dependency-injected, in-memory storage behind a repository port
- **UI:** React 19 + Vite — a thin client with three role tabs (Delivery Agent, Customer, Operations) over the REST API
- **Tests:** Vitest — 70 tests: domain and application units, supertest API integration, concurrency race/stress tests, and React Testing Library flows

## Quick start

```bash
npm ci
npm run dev        # API on :3000, UI on :5173 (proxied to the API)
```

Production mode (single process serves API + built UI):

```bash
npm run build
npm start          # http://localhost:3000
```

Other scripts:

```bash
npm test               # all server + web tests
npm run test:coverage  # server coverage report
npm run demo           # scripted API walkthrough (server must be running)
npm run lint           # ESLint over both workspaces
```

Configuration (env vars, all optional): `PORT` (3000), `STORAGE_RATE_PER_DAY` (10 — the "X" in the fee tiers), `SEED_LOCKERS` (`SMALL:3,MEDIUM:3,LARGE:2`).

## How it works

Delivery agent stores a package → the system assigns the **smallest available locker that fits** and returns the locker id + a unique 6-character pickup code (assumed to reach the customer via SMS/email, out of scope). Customer enters locker id + code → the locker opens, the package is released, the **storage charge** for the time it sat there is returned, and the locker becomes available again.

## Architecture

```
server/src/
├── domain/            # pure rules, no I/O
│   ├── LockerSize.ts        # SMALL | MEDIUM | LARGE, fit + ordering rules
│   ├── Locker.ts            # invariants: one package at a time, only if it fits;
│   │                        #   retrieve validates the code and frees the locker
│   ├── Package.ts
│   └── errors.ts            # typed DomainErrors with stable codes
├── application/       # use cases + policies, everything injected
│   ├── StorePackageService.ts
│   ├── RetrievePackageService.ts
│   ├── LockerFactory.ts     # human-friendly sequential ids: S-1, M-2, ...
│   ├── ports.ts             # Clock, PickupCodeGenerator, LockerRepository
│   └── policies/
│       ├── LockerAllocationStrategy.ts  # SmallestSuitableLockerStrategy
│       └── StorageFeePolicy.ts          # TieredStorageFeePolicy
├── infrastructure/    # adapters for the ports
│   ├── InMemoryLockerRepository.ts      # incl. atomic findAndReserve (Level 4)
│   ├── RandomPickupCodeGenerator.ts     # crypto-random, ambiguity-free alphabet
│   └── SystemClock.ts
├── api/               # Express adapter: zod validation + error mapping
│   ├── routes.ts
│   ├── errorHandler.ts
│   └── server.ts            # createApp(deps) — fully injectable for tests
└── index.ts           # composition root: wiring + locker seeding

web/src/               # thin client — zero business rules
├── api/client.ts      # typed fetch wrapper + ApiError
├── components/LockerBoard.tsx
└── views/             # OperationsView · AgentView · CustomerView
```

**Why each abstraction exists** (and no more than these):

- `Clock` — Level 3 charges depend on elapsed time; injecting a `FixedClock` makes every fee test deterministic.
- `StorageFeePolicy` — the spec says the fee "may follow" a tiered rule; rate, tier boundaries and grace period are configuration, not code.
- `LockerAllocationStrategy` — the spec asks for a design that "can be extended easily"; smallest-suitable is the current rule, not the only conceivable one.
- `PickupCodeGenerator` — real codes are crypto-random; tests use a scripted sequence to prove the uniqueness-retry logic.
- `LockerRepository` — the persistence seam. In-memory today; a database adapter implements the same port without touching domain or services.

There is deliberately **no DI container and no ORM** — constructor injection at the composition root is all a codebase of this size needs.

## REST API

| Method & path        | Body                       | Success                                                        | Errors                                     |
| -------------------- | -------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `GET /api/lockers`   | —                          | `200 {lockers: [{id, size, available}]}`                        | —                                          |
| `POST /api/lockers`  | `{size}`                   | `201 {locker}`                                                  | `400` invalid size                         |
| `POST /api/packages` | `{size}`                   | `201 {lockerId, pickupCode, packageId}`                         | `400` invalid size · `409` no suitable locker |
| `POST /api/pickups`  | `{lockerId, pickupCode}`   | `200 {opened, package, storedAt, retrievedAt, storageCharge}`   | `400` missing fields · `404` unknown locker · `422` wrong code / empty locker |

All errors share one shape: `{"error": {"code": "NO_SUITABLE_LOCKER", "message": "..."}}`.

## UI

Three role tabs (no authentication — roles are presentation-level, see assumptions):

- **Delivery Agent** — choose a package size, store it, get the locker id + pickup code with a copy button.
- **Customer** — enter locker id + pickup code; on success the locker opens and the storage charge is shown; failures get friendly, specific copy.
- **Operations** (internal) — add lockers, see capacity counts. Locker creation belongs to the station operator, not the delivery agent, so it lives here.

Every view shows the live **locker board** (id, size, available/occupied). Accessibility: labelled controls, keyboard-operable forms, `role=tablist`, `alert`/`status` live regions, visible focus outlines.

## Storage charges (Level 3)

The spec's example: X units/day for days 1–5, 2X for days 6–10, 3X from day 11, where **a day is each started 24-hour window from the moment of storage**. So a package retrieved after 2 hours is in day 1 and owes X; after exactly 24h it still owes X; at 24h + 1s it enters day 2.

Interpretation note: the phrase "packages are expected to be picked up within a reasonable time" *could* be read as a grace period before charging starts. The example ("X/day for the **first** 5 days") reads more literally as day 1 being charged, so the default is `freeDays: 0` — but the grace reading is a one-line config change on `TieredStorageFeePolicy`, and both are covered by tests.

## Concurrency (Level 4)

Reservation is **atomic at the repository boundary**: `findAndReserve` selects and stores in one synchronous critical section, so two concurrent requests can never be handed the same locker, and excess requests get the "no suitable locker" message. This is verified by a race test (10 simultaneous stores against 4 lockers → exactly 4 distinct assignments) and a stress test (120 interleaved store+pickup tasks → every package only ever behind its own code, station fully free at the end).

**Honest scope:** this guarantee holds within one Node process, which is also why the app must run as a single instance while storage is in-memory. Scaling out would fork the locker state — the fix is a database adapter for `LockerRepository` using a transaction / unique constraint / optimistic locking, which is exactly the seam `findAndReserve` marks.

## Requirements coverage

| Requirement (spec) | Where |
| --- | --- |
| Lockers in Small/Medium/Large | `domain/LockerSize.ts` |
| Package must fit its locker | `LockerSize.fits`, enforced in `Locker.store` |
| Smallest available locker that fits | `SmallestSuitableLockerStrategy` |
| One package per locker | `Locker` invariant (`LockerOccupiedError`) |
| Locker available again after retrieval | `Locker.retrieve` |
| Unique pickup code per stored package | `StorePackageService.uniquePickupCode` |
| Code tied to a specific package and locker | `Locker.retrieve` validates the pair |
| L1: create lockers / view list with availability | `POST/GET /api/lockers`, Operations view + board |
| L1: "cannot be stored" when nothing fits | `NoSuitableLockerError` → 409 |
| L1: return code + locker identifier | `POST /api/packages` response |
| L2: retrieve via locker id + code; locker opens and frees | `POST /api/pickups`, Customer view |
| L2: invalid scenarios | wrong code / wrong locker / empty / unknown / replayed code → 4xx tests |
| L3: record storage time; tiered charge; charge with pickup confirmation | `Clock`, `TieredStorageFeePolicy`, pickup response |
| L4 (optional): no double assignment; excess requests refused; availability stays correct | `findAndReserve` + race/stress tests |

## Assumptions

1. **Fee day counting** — `ceil(elapsed / 24h)`, minimum 1 day, day 1 charged (see Level 3 section; grace period configurable).
2. **Pickup codes** — 6 characters from an ambiguity-free alphabet (no 0/O/1/I); unique among *active* packages; uniqueness enforced with a bounded retry against active codes. In a multi-instance deployment this becomes a DB unique constraint.
3. **Package size is a category** (S/M/L) matching locker sizes, not physical dimensions.
4. **Storage is in-memory** per the challenge scope; state resets on restart.
5. **No authentication** — the spec defines roles but no auth requirements; tabs model the roles at the presentation level.
6. **Notification of the pickup code** (SMS/email) is explicitly out of scope per the spec.

## Trade-offs & what I'd do with more time

- **Persistence** — a PostgreSQL adapter for `LockerRepository` (transactional `findAndReserve`, unique index on active pickup codes), enabling multi-instance deployment.
- **Pickup-code security** — codes are not hashed at rest and there's no rate limiting on pickup attempts; both matter in production.
- **Package metadata** — recipient, tracking id, expiry/return flow for never-collected packages (the fee policy seam makes an expiry policy natural).
- **UI end-to-end tests** — a Playwright smoke over the three tabs; unit/integration coverage is strong but browser-level coverage is thin by design.
- **Observability** — structured logging and request tracing instead of the single console error hook.

## Deploying to Azure (optional)

The app is a single Node process (Express serves the API and the built UI), so Azure App Service (Linux, Node 20) fits directly:

1. Create an App Service with startup command `node server/dist/index.js`.
2. Build with `npm ci && npm run build`; deploy the repo (e.g. GitHub Actions `azure/webapps-deploy` with a publish-profile secret).
3. **Set instance count to 1** — locker state is in-memory (see Concurrency). The repository port is where Azure Database for PostgreSQL / Cosmos DB would slot in to lift that constraint.

## AI usage disclosure

**Tool:** Claude Code (Anthropic), used as an interactive pair programmer.

**How it was used:**

- Requirements analysis: extracting a per-slide requirements checklist from the challenge PDF and surfacing ambiguities (e.g. the fee-day interpretation documented above) before any code.
- TDD pairing: for each level, tests specifying the behaviour were written and committed first, then the implementation to make them pass — the commit history mirrors this red→green rhythm.
- Implementation assistance across server and UI, refactor suggestions (e.g. moving reservation atomicity behind the repository boundary), and review passes for edge cases.

**AI-assisted portions:** AI assisted throughout — test authoring, implementation, and this README. Requirements interpretation, architecture decisions (which abstractions earn their place, and which don't), scope calls, and final review are mine, and I own everything submitted.

**Workflow shape:** iterative and reviewed at each step rather than generated in one pass: analyse requirements → agree the design → write failing tests → minimal implementation → lint/test → commit. Each level landed as its own reviewed increment.
