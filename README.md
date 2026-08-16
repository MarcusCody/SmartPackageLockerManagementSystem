# Smart Package Locker Management System

A locker station where **delivery agents store packages** and **customers retrieve them** with a pickup code — built for the Everest Engineering coding challenge (Levels 1–4, including the optional concurrency level).

**Live demo:** <https://smartlocker-hjie30.azurewebsites.net> (Azure App Service F1 — allow ~30s for a cold start)

- **Server:** TypeScript (strict), Node 20+, Express 5, zod — domain-driven, dependency-injected, storage behind repository ports (PostgreSQL or in-memory)
- **UI:** React 19 + Vite + react-router — a thin client with a route per role (`/delivery`, `/customer`, `/operation`) over the REST API
- **Persistence:** PostgreSQL via plain `pg` (docker-compose locally, Azure Database for PostgreSQL in the cloud); in-memory remains the zero-config default
- **Tests:** Vitest — 171 tests: domain and application units, supertest API integration, concurrency race/stress tests, Postgres adapter integration (against a real database in CI), and React Testing Library flows

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

Optional PostgreSQL persistence (in-memory is the default):

```bash
docker compose up -d db
DATABASE_URL=postgres://locker:locker@localhost:5433/smartlocker npm run dev
# adapter integration tests run when a test DB is provided:
DATABASE_URL_TEST=postgres://locker:locker@localhost:5433/smartlocker_test npm test
```

Configuration: `PORT` (3000), `SEED_LOCKERS` (`SMALL:3,MEDIUM:3,LARGE:2`), `RETURN_AFTER_DAYS` (15 — set `0` to demo warehouse returns instantly) and `DATABASE_URL` via env vars (see [.env.example](.env.example)); the storage fee schedule is configured at the composition root ([server/src/index.ts](server/src/index.ts)). For real email, set `ACS_CONNECTION_STRING` and `EMAIL_SENDER_ADDRESS` (see **Email notifications**) — without them, emails render to the server console.

## How it works

**Orders** arrive from the e-commerce platform with the customer's name, email and phone attached, and follow a lifecycle:

`AWAITING_DISPATCH` → (operations dispatches to the station) → `PENDING` → (agent stores the package) → `STORED` → (customer collects, or the package goes overdue and is) → `RETURNED`

The delivery agent picks a pending order to store — never typing contact details. The system assigns the **smallest available locker that fits**, generates a unique 6-digit pickup PIN, and **emails it to the order's contact**. Customer enters the PIN → the system finds and opens the right locker (locker id optional; validated as a pair when provided), the package is released, the **storage charge** is returned, and the locker frees up. Packages that sit past the **return threshold (15 days)** appear in the agent's overdue list and can be returned to the warehouse, freeing the locker and killing the PIN.

## Architecture

```
server/src/
├── domain/            # pure rules, no I/O
│   ├── LockerSize.ts        # SMALL | MEDIUM | LARGE, fit + ordering rules
│   ├── Locker.ts            # invariants: one package at a time, only if it fits;
│   │                        #   retrieve validates the code and frees the locker
│   ├── Package.ts
│   ├── Order.ts             # pending delivery with the customer contact attached
│   └── errors.ts            # typed DomainErrors with stable codes
├── application/       # use cases + policies, everything injected
│   ├── StorePackageService.ts
│   ├── StoreOrderService.ts             # store a pending order (composes the above)
│   ├── RetrievePackageService.ts
│   ├── LockerOverviewService.ts         # operations: PINs + accrued charges
│   ├── LockerFactory.ts     # human-friendly sequential ids: S-1, M-2, ...
│   ├── OrderFactory.ts      # ORD-1001, ORD-1002, ... (stands in for platform ids)
│   ├── pickupEmail.ts       # pure, tested email content builder
│   ├── ports.ts             # Clock, PickupCodeGenerator, PickupNotifier, Locker/OrderRepository
│   └── policies/
│       ├── LockerAllocationStrategy.ts  # SmallestSuitableLockerStrategy
│       └── StorageFeePolicy.ts          # TieredStorageFeePolicy
├── infrastructure/    # adapters for the ports
│   ├── InMemoryLockerRepository.ts      # incl. atomic findAndReserve (Level 4)
│   ├── InMemoryOrderRepository.ts
│   ├── RandomPickupCodeGenerator.ts     # keypad-friendly 6-digit PINs
│   ├── SystemClock.ts
│   └── notifications/
│       ├── AcsEmailNotifier.ts          # Azure Communication Services Email
│       └── ConsoleNotifier.ts           # default: renders emails to stdout
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
- `PickupNotifier` — channel-agnostic notification seam: ACS email in production, console in dev, and an SMS adapter would implement the same port (see **Email notifications**).
- `LockerRepository` — the persistence seam. In-memory today; a database adapter implements the same port without touching domain or services.

There is deliberately **no DI container and no ORM** — constructor injection at the composition root is all a codebase of this size needs.

## REST API

| Method & path        | Body                       | Success                                                        | Errors                                     |
| -------------------- | -------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `GET /api/lockers`   | —                          | `200 {lockers: [{id, size, available}]}`                        | —                                          |
| `POST /api/lockers`  | `{size}`                   | `201 {locker}`                                                  | `400` invalid size                         |
| `GET /api/admin/lockers` | —                      | `200` — adds `pickupCode`, `storedAt`, `accruedCharge` per occupied locker | — (internal: would sit behind operator auth in production) |
| `GET /api/orders`    | `?status=pending` (default) or `awaiting-dispatch` | `200 {orders}`                          | —                                          |
| `POST /api/orders`   | `{customerName, customerEmail, customerPhone, size}` | `201 {order}` — the upstream platform registers a delivery (awaiting dispatch) | `400` validation · `409` station at capacity |
| `POST /api/orders/mock` | —                       | `201 {order}` — simulates the platform pushing a random delivery, sized to remaining capacity | `409` station at capacity |
| `POST /api/orders/:id/dispatch` | —               | `200 {order}` — joins the agent's pending queue                 | `404` unknown · `409` already dispatched   |
| `POST /api/orders/:id/store` | —                  | `201 {lockerId, pickupCode, packageId, notification, order}`    | `404` unknown · `409` not dispatched / already stored / no suitable locker |
| `GET /api/returns`   | —                          | `200 {overdue}` — packages past the return threshold            | —                                          |
| `POST /api/lockers/:id/return` | —                | `200 {returned, lockerId, packageId, orderId}` — staff override, no PIN | `404` unknown locker · `422` empty / not overdue |
| `POST /api/packages` | `{size, customerEmail?}`   | `201 {lockerId, pickupCode, packageId, notification}`           | `400` invalid size/email · `409` no suitable locker |
| `POST /api/pickups`  | `{pickupCode, lockerId?}`  | `200 {opened, lockerId, package, storedAt, retrievedAt, storageCharge}` | `400` missing PIN · `404` unknown locker · `422` unmatched/wrong PIN, empty locker |

All errors share one shape: `{"error": {"code": "NO_SUITABLE_LOCKER", "message": "..."}}`.

## UI

One route per role (no authentication — roles are presentation-level, see assumptions):

- **`/delivery`** — the agent's **pending-order queue**: each order arrives with the customer's name, email and phone, so the agent never types contact details. Storing an order assigns the locker, emails the PIN, and confirms who was notified (with a copy button for the PIN). Below it, the **overdue list**: packages past the return threshold show their days-in-locker and go back to the warehouse with one click. Shows the availability board so the agent can see capacity.
- **`/customer`** — enter the 6-digit PIN (locker id optional); the system opens the right locker, names it, and shows the storage charge; failures get friendly, specific copy. **No locker board here** — which lockers exist or are occupied is not the customer's business.
- **`/operation`** (internal) — add lockers, **dispatch incoming platform orders** to the station (nobody types customer data — orders arrive from the platform with contact details attached), **mock a new incoming order** (capacity-checked; a full station explains itself), see capacity counts, a **station wall preview** (cabinet columns of doors sized by locker size, occupied doors showing a parcel), and the locker overview where each occupied locker shows its **pickup PIN, storage time and the charge accrued so far**.

Accessibility: labelled controls, keyboard-operable forms, `alert`/`status` live regions, visible focus outlines.

## Storage charges (Level 3)

Pricing is a configurable schedule of day bands on `TieredStorageFeePolicy`, where **a day is each started 24-hour window from the moment of storage** (a package retrieved after 2 hours is in day 1; at 24h + 1s it enters day 2). The deployed schedule, in RM:

| Days (from storage) | Rate                     |
| ------------------- | ------------------------ |
| 1–5                 | Free — grace period      |
| 6–7                 | RM1/day                  |
| 8+                  | RM2/day                  |

Example: collected on day 6 → RM1; collected on day 12 → RM2 (days 6–7) + RM10 (days 8–12) = RM12.

The challenge PDF's example pricing (X/day for the first 5 days, 2X for the next 5, 3X beyond) is deliberately *not* hardcoded — the spec says the fee "may follow a tiered pricing rule such as" that example. It remains one configuration away and is covered by its own tests, so switching schedules is a change to the composition root, not to code.

The charge is visible in two places: the customer sees the final amount with the pickup confirmation, and `/operation` shows each occupied locker's **live accrued charge** (what the customer would owe if they picked up right now), computed by the same fee policy.

## Concurrency (Level 4)

Reservation is **atomic at the repository boundary**: `findAndReserve` selects and stores in one synchronous critical section, so two concurrent requests can never be handed the same locker, and excess requests get the "no suitable locker" message. This is verified by a race test (10 simultaneous stores against 4 lockers → exactly 4 distinct assignments) and a stress test (120 interleaved store+pickup tasks → every package only ever behind its own code, station fully free at the end).

**Honest scope:** this guarantee holds within one Node process, which is also why the app must run as a single instance while storage is in-memory. Scaling out would fork the locker state — the fix is a database adapter for `LockerRepository` using a transaction / unique constraint / optimistic locking, which is exactly the seam `findAndReserve` marks.

## Station capacity (order intake rule)

The platform never accepts an order the station cannot absorb. `StationCapacityPolicy` counts **free lockers** against **committed demand** — every order still awaiting dispatch or pending delivery — cumulatively across the nested sizes: for each tier from LARGE down, demand at-or-above the tier must not exceed free lockers at-or-above it. That allows upgrades (a SMALL package in a LARGE locker) without ever double-booking, and it guards both `POST /api/orders` and the mock-order button. When nothing fits, the operator sees exactly why (`STATION_AT_CAPACITY`).

## Persistence (PostgreSQL)

Storage sits behind the `LockerRepository`/`OrderRepository` ports. Set `DATABASE_URL` and the composition root selects the plain-`pg` adapters (no ORM); otherwise everything runs in-memory. Two promises made earlier in this README are now kept **by the database**:

- `findAndReserve` is a real transaction: candidates are locked with `SELECT … FOR UPDATE`, the allocation strategy picks in-process, and the reservation commits atomically — no double-assignment even across instances.
- Active-PIN uniqueness is a **partial unique index** (`ON lockers (pickup_code) WHERE pickup_code IS NOT NULL`), not just application logic.

Rows rehydrate through `Locker.restore`/`Order.restore` (the domain's own transitions — no invariant bypass), seeds apply only to an empty station, and id sequences resume from existing rows. The adapter integration suite (round-trips, the transactional reservation race, the unique index, the order lifecycle) runs against a real Postgres service container in CI and locally via `DATABASE_URL_TEST`.

## Warehouse returns (overdue packages)

Packages are expected to be collected; ones that sit past **`RETURN_AFTER_DAYS` (default 15)** become *overdue* — the delivery agent sees them on `/delivery` with their days-in-locker and returns them to the warehouse. The return is a **staff override** (`Locker.removeForReturn` — no PIN required): the locker frees up, the old PIN dies with it, and the linked order is marked `RETURNED`. Walk-in packages stored without an order return too (`orderId: null`). Overdue uses the same started-24h-window day counting as the fees, boundary-tested at exactly 15 days.

Demo tip: start the server with `RETURN_AFTER_DAYS=0` and every stored package is immediately returnable. Future work: notify the customer of the return through the same `PickupNotifier` port.

## Email notifications

When an order is stored (or a `customerEmail` is passed to the raw `POST /api/packages` endpoint), the pickup PIN is emailed via the `PickupNotifier` port. The order's phone number is stored and displayed, reserved for a future SMS channel through the same port. Two adapters exist:

- **`ConsoleNotifier`** (default) — renders the email to the server console, so the repo runs and demos with zero external dependencies or secrets.
- **`AcsEmailNotifier`** — sends real email through **Azure Communication Services**, selected automatically when both env vars are set:

```bash
ACS_CONNECTION_STRING="endpoint=https://<your-resource>.communication.azure.com/;accesskey=<key>"
EMAIL_SENDER_ADDRESS="DoNotReply@<guid>.azurecomm.net"
```

**Design decisions:**

- **Demo redirect**: `EMAIL_REDIRECT_ALL_TO=<inbox>` decorates the active notifier so every email — regardless of the (sample) customer address on the order — is delivered to one real inbox. The live deployment redirects to the author's inbox; the original recipient is logged.
- **A notification failure never fails the store** — the locker is already reserved by then. The API instead reports `notification: "sent" | "failed" | "none"`, and the UI tells the agent to share the PIN manually on failure.
- Email copy lives in a pure, tested builder (`application/pickupEmail.ts`); the ACS adapter is deliberately thin and untested against the real API — the port contract is tested with stubs.
- In production this would be a queued event (store → queue → notification worker) rather than an inline send; inline keeps the take-home honest and simple.

**Azure setup (works on an Azure for Students subscription):**

1. Create a **Communication Services** resource and an **Email Communication Services** resource (same resource group).
2. In the Email resource, add a free **Azure managed domain** (no DNS or custom domain needed), then connect that domain to the Communication Services resource.
3. Copy the connection string (Communication Services → Keys) and the MailFrom address (the `DoNotReply@…azurecomm.net` one), and set the two env vars above (on App Service: Configuration → Application settings).
4. Cost: roughly US$0.00025 per email plus a tiny data fee — negligible against student credit. Managed domains have modest sending limits, fine for a demo.

**Sender identity:** the live deployment sends as `Smart Package Locker <smartlocker@<guid>.azurecomm.net>` — the GUID domain is ACS's free *Azure managed domain* (Microsoft owns the DNS, so SPF/DKIM pass with zero setup). A production system would verify a custom domain (`noreply@yourbrand.com`) with its own SPF/DKIM records; only the friendly display name is configurable on the managed domain.

**Why email and not SMS:** ACS SMS requires acquiring a phone number, which Microsoft does not allow on trial/free-credit subscriptions (including Azure for Students); trial numbers are US-only and calling-only, and Malaysia isn't served by ACS alphanumeric sender IDs. The `PickupNotifier` port is channel-agnostic, so an `SmsNotifier` (e.g. Twilio) plugs in later without touching the domain or services.

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
| L2: retrieve via locker id + code; locker opens and frees | `POST /api/pickups` validates the pair when locker id is given; PIN-only also works since PINs are unique among active packages |
| L2: invalid scenarios | wrong code / wrong locker / empty / unknown / replayed code → 4xx tests |
| L3: record storage time; tiered charge; charge with pickup confirmation | `Clock`, `TieredStorageFeePolicy`, pickup response |
| L4 (optional): no double assignment; excess requests refused; availability stays correct | `findAndReserve` + race/stress tests |

## Assumptions

1. **Fee day counting** — `ceil(elapsed / 24h)`, minimum 1 day: each started 24h window counts. Pricing is a band schedule set at the composition root (currently 5 free grace days, RM1/day for days 6–7, RM2/day from day 8, integer RM amounts); the PDF's X/2X/3X example is an alternative configuration covered by tests (see Level 3 section).
2. **Pickup codes** — keypad-friendly 6-digit numeric PINs (leading zeros preserved); unique among *active* packages, enforced with a bounded retry against active codes. In a multi-instance deployment this becomes a DB unique constraint.
3. **Package size is a category** (S/M/L) matching locker sizes, not physical dimensions.
4. **Storage is in-memory** per the challenge scope; state resets on restart.
5. **No authentication** — the spec defines roles but no auth requirements; tabs model the roles at the presentation level.
6. **Notification of the pickup code** is out of scope per the spec, but implemented as a bonus: email via ACS when configured, console otherwise (see **Email notifications**).
7. **Orders** model the upstream e-commerce platform and follow `AWAITING_DISPATCH → PENDING → STORED → RETURNED`: the platform registers them with the customer contact attached (`POST /api/orders` stands in for that integration), operations dispatches them to the station, the agent stores them — never typing contact details. `POST /api/packages` remains as the spec's direct store-by-size flow.

## Trade-offs & what I'd do with more time

- **Persistence** — a PostgreSQL adapter for `LockerRepository` (transactional `findAndReserve`, unique index on active pickup codes), enabling multi-instance deployment.
- **Pickup-PIN security** — PINs are not hashed at rest, pickup attempts are not rate-limited, and `GET /api/admin/lockers` is unauthenticated; a 6-digit space makes all three mandatory in production (operator auth, attempt lockout, hashed PINs).
- **Package metadata** — recipient, tracking id, expiry/return flow for never-collected packages (the fee policy seam makes an expiry policy natural).
- **UI end-to-end tests** — a Playwright smoke over the three tabs; unit/integration coverage is strong but browser-level coverage is thin by design.
- **Observability** — structured logging and request tracing instead of the single console error hook.

## Deployment (Azure)

The app is a single Node process (Express serves the API **and** the built React UI), deployed as:

- **App Service** `smartlocker-hjie30` — Linux, Node 22 LTS, **F1 free tier** (cold starts after idle are normal), startup `node server/dist/index.js`, built by Oryx on deploy (`SCM_DO_BUILD_DURING_DEPLOYMENT=true`).
- **Azure Database for PostgreSQL Flexible Server** `spl-db-hjie30` — Burstable **B1ms**, 32 GB, no HA (the cheapest configuration); `DATABASE_URL` lives only in App Service application settings.

Redeploy after changes:

```bash
git archive --format=zip HEAD -o /tmp/spl.zip
az webapp deploy -g rg-smart-package-locker -n smartlocker-hjie30 --src-path /tmp/spl.zip --type zip
```

Cost control on a student subscription: `az postgres flexible-server stop -g rg-smart-package-locker -n spl-db-hjie30` halts compute billing between demo sessions (`start` to resume); `az group delete -n rg-smart-package-locker` removes everything after the interview. With Postgres behind the repository port, multi-instance scale-out is now safe — `findAndReserve` is a database transaction.

## AI usage disclosure

**Tool:** Claude Code (Anthropic), used as an interactive pair programmer.

**How it was used:**

- Requirements analysis: extracting a per-slide requirements checklist from the challenge PDF and surfacing ambiguities (e.g. the fee-day interpretation documented above) before any code.
- TDD pairing: for each level, tests specifying the behaviour were written and committed first, then the implementation to make them pass — the commit history mirrors this red→green rhythm.
- Implementation assistance across server and UI, refactor suggestions (e.g. moving reservation atomicity behind the repository boundary), and review passes for edge cases.

**AI-assisted portions:** AI assisted throughout — test authoring, implementation, and this README. Requirements interpretation, architecture decisions (which abstractions earn their place, and which don't), scope calls, and final review are mine, and I own everything submitted.

**Workflow shape:** iterative and reviewed at each step rather than generated in one pass: analyse requirements → agree the design → write failing tests → minimal implementation → lint/test → commit. Each level landed as its own reviewed increment.
