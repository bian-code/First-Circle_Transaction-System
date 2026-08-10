# TMS QA Test Plan

## 1. Purpose & Scope

This document defines how the Transaction Management System (TMS) is tested before a release.

**In scope:** functional correctness of the REST API (`/api/transactions`), the React UI
(Transactions, Dashboard, Customers pages), client-side export (CSV/XLSX), and CSV-file data
integrity.

**Out of scope:** load/performance testing, security/penetration testing, accessibility audit,
and a cross-browser compatibility matrix. TMS is a single-user local development tool with no
auth layer and a single-file datastore, so these are judged low-value for the current scope —
revisit if the app moves toward multi-user/production use.

## 2. System Under Test

TMS is a Spring Boot (Java 17) REST API backed by a CSV file, with a React (Vite) frontend. Full
setup/config/run instructions and the API reference live in
[`docs/TMS-Documentation.md`](TMS-Documentation.md) — this plan assumes that setup is done and
focuses on what to verify, not how to run the app.

## 3. Test Strategy

Three levels, from fastest/most isolated to broadest:

| Level | What it exercises | Tooling |
|---|---|---|
| Unit | Pure logic and the service layer against a temp CSV file — no Spring context, no HTTP | JUnit 5 + AssertJ (`backend/src/test/.../service`, `.../model`) |
| Integration (component) | Controller routing, request validation, JSON (de)serialization, and error mapping, with the service mocked | JUnit 5 + Spring `@WebMvcTest`/MockMvc (`backend/src/test/.../controller`); React component rendering/interaction with `fetch` mocked | Vitest + React Testing Library (`frontend/src/**/*.test.jsx`) |
| Manual / exploratory | End-to-end flows through a real browser and a real running backend, and anything not worth automating yet | curl, Chrome |

See [Section 7](#7-traceability) for exactly which cases each automated test file covers.

## 4. Test Environment & Tools

- Java 17, Maven 3.6+ — JUnit 5, Mockito, AssertJ, and MockMvc all ship via the existing
  `spring-boot-starter-test` dependency in `backend/pom.xml`; no extra install needed.
- Node 18+, npm 9+ — Vitest, React Testing Library, `@testing-library/user-event`, and jsdom,
  added as devDependencies in `frontend/package.json`.
- curl (or any HTTP client) for manual API checks; Chrome for manual UI checks.
- No database, mocking server, or CI system is involved — the backend's own MockMvc test slice
  and the service's temp-directory tests are self-contained and don't touch the real
  `backend/src/main/resources/data/transactions.csv`.

Run everything with:
```bash
cd backend && mvn test
cd frontend && npm install && npm test
```

## 5. Entry / Exit Criteria

**Entry:** code compiles (`mvn compile`, `npm run build`); both automated suites are runnable
locally.

**Exit (per release):**
- `mvn test` and `npm test` both pass with zero failures.
- The manual-only cases in [Section 7](#7-traceability) have been walked through once in a
  browser against a freshly started backend.
- Any new endpoint, page, or field added since the last release has corresponding rows added to
  Section 6 and, where practical, a new automated test.

## 6. Test Cases

### 6.1 API

| ID | Title | Steps | Expected Result |
|---|---|---|---|
| API-01 | Default GET pagination | `GET /api/transactions` | `200`; envelope `{data, page:0, size:20, totalItems, totalPages}` |
| API-02 | `page` below 0 rejected | `GET ?page=-1` | `400`, error mentions `page must be >= 0` |
| API-03 | `size` below 1 rejected | `GET ?size=0` | `400` |
| API-04 | `size` above 100 rejected | `GET ?size=101` | `400` |
| API-05 | Invalid `status` filter rejected | `GET ?status=Bogus` | `400` |
| API-06 | `from` after `to` rejected | `GET ?from=2026-01-01&to=2025-01-01` | `400` |
| API-07 | Filter by `status` | `GET ?status=Settled` on mixed data | Only `Settled` rows returned |
| API-08 | Filter by `accountNumber` | `GET ?accountNumber=<x>` | Only matching rows returned |
| API-09 | Filter by date range | `GET ?from=&to=` | Only rows with `transactionDate` in `[from, to]` |
| API-10 | Pagination slices correctly | 5 seeded rows, `page=1&size=2` | Returns rows 3–4; `totalItems=5`, `totalPages=3` |
| API-11 | Page past the last page | `page` far beyond data size | `data` empty; `totalItems` still correct |
| API-12 | Create a valid transaction | `POST` with all 4 required fields | `201`; response has server-generated `id` and a `status` |
| API-13 | Create with missing fields | `POST {}` | `400`; one error message per missing field |
| API-14 | Create with malformed JSON | `POST` with invalid JSON body | `400` |
| API-14b | Create with invalid `accountNumber` format | `POST` with `accountNumber` that is the wrong length, contains dashes, or contains letters | `400`; error mentions "exactly 12 digits" |
| API-15 | Update an existing transaction | `PUT /{id}` with valid body | `200`; `id`/`status` unchanged from the stored record even if the body tries to set them |
| API-16 | Update an unknown id | `PUT /not-real` | `404` |
| API-17 | Update with invalid body | `PUT /{id}` with `{}` | `400` |
| API-17b | Update with invalid `accountNumber` format | `PUT /{id}` with a non-12-digit `accountNumber` | `400` |
| API-18 | Delete an existing transaction | `DELETE /{id}` | `204`; row no longer returned by `GET` |
| API-19 | Delete an unknown id | `DELETE /not-real` | `404` |
| API-20 | Uniform error shape | Any `4xx`/`5xx` above | Body is `{"status": <code>, "errors": [...]}` |

### 6.2 UI

| ID | Title | Steps | Expected Result |
|---|---|---|---|
| UI-01 | Transactions load on open | Open the app | Table rows render from the API response |
| UI-02 | Add a transaction | `+ New Transaction` → fill form → Submit | New row appears immediately |
| UI-02b | Account number input enforces 12-digit numeric format | Type non-digit characters and more than 12 characters into Account Number | Non-digits are stripped, length is capped at 12, and Submit stays disabled until exactly 12 digits are entered |
| UI-03 | Edit a transaction | Row kebab → Edit → change a field → Save | Row reflects the change |
| UI-04 | Delete a transaction | Row kebab → Delete | Row disappears |
| UI-05 | Search filter | Type into the search box | Rows not matching name/account/amount are hidden |
| UI-06 | Status filter | Choose a status from the dropdown | Only matching rows shown |
| UI-07 | Column sort toggle | Click a sortable column header | Row order flips; clicking again reverses it |
| UI-08 | Bulk select + export/delete | Select multiple rows via checkboxes, use the bulk action bar | Export downloads only the selection; Delete removes only the selection |
| UI-09 | CSV/XLSX export content | Use the Export menu (all rows or a selection) | Downloaded `.csv` has the right header/quoting; `.xlsx` opens as a valid spreadsheet |
| UI-10 | Modal dismissal | Open Add/Edit modal, then Cancel / `Escape` / click outside | Modal closes without submitting |
| UI-11 | Dashboard stat cards | Open Dashboard with known data | Totals/counts match the underlying transactions |
| UI-12 | Dashboard top customers | Open Dashboard | Customers ranked by volume, highest first |
| UI-13 | Dashboard empty state | Open Dashboard with no transactions | Empty-state copy shown for chart/list panels |
| UI-14 | Customers grouping & totals | Open Customers page | One row per distinct account number, with correct totals |
| UI-15 | Customers search/sort | Search and click column headers | Rows filter/reorder correctly |
| UI-16 | Customer detail drawer | Click a customer row | Drawer shows correct stats and full transaction history |
| UI-17 | Fetch-failure state | Stop the backend, reload the frontend | A visible error state, not a crash or infinite spinner |
| UI-18 | Loading states | Observe on initial page load | Spinner/loading copy shown before data arrives |

### 6.3 Data Integrity

| ID | Title | Steps | Expected Result |
|---|---|---|---|
| DATA-01 | CSV auto-created on first write | Delete `transactions.csv`, then `POST` a transaction | File and header row are created automatically |
| DATA-02 | No duplicate header on repeated writes | Add several transactions in sequence | Exactly one header line in the file |
| DATA-03 | Amount persisted with 2 decimals | Add a transaction with a whole-number amount (e.g. `100`) | CSV row stores `100.00` |
| DATA-04 | Round-trip integrity | Add a transaction, then read it back via `GET` | All fields match what was submitted (plus server-assigned `id`/`status`) |
| DATA-05 | Concurrent add/delete safety | Fire several `POST`/`DELETE` requests concurrently | File is not corrupted/interleaved (guarded by `TransactionService`'s `ReentrantReadWriteLock`) |

## 7. Traceability

| Automated test file | Cases covered |
|---|---|
| `backend/.../controller/TransactionControllerTest.java` | API-01, API-02–06, API-12–19, API-14b, API-17b, API-20 (via `$.status`/`$.errors` assertions) |
| `backend/.../service/TransactionServiceTest.java` | API-07–11, API-15/16 (service-level), API-18/19 (service-level), DATA-02, DATA-04 |
| `backend/.../model/TransactionFilterTest.java` | Filter-matching logic underlying API-07–09 |
| `backend/.../model/PagedResultTest.java` | Pagination-total-calculation logic underlying API-01/10/11 |
| `frontend/src/App.test.jsx` | UI-01–07, UI-02b |
| `frontend/src/exportUtils.test.js` | UI-09 |
| `frontend/src/pages/DashboardPage.test.jsx` | UI-11–13, UI-18 |
| `frontend/src/pages/CustomersPage.test.jsx` | UI-14–16, UI-18 |

**Manual-only** (no automated coverage yet): UI-08, UI-10, UI-17, DATA-01, DATA-03, DATA-05, and
a full browser walk against the real backend as a release smoke test — the frontend tests above
run against a mocked `fetch`, not the real API, and the backend tests above never write to the
real `transactions.csv`.

## 8. Risks & Known Limitations

- **Single CSV file as the datastore.** Every write rewrites or appends to one file; there is no
  transaction log, backup, or recovery path. A corrupted file breaks the whole app.
- **Frontend only loads the API's default first page.** `App.jsx` calls `GET /api/transactions`
  without `page`/`size`, so with more than 20 transactions the UI silently shows only the most
  recent-looking 20 (per the API's default), even though more data exists and is reachable
  directly via the API. See `docs/TMS-Documentation.md` for details.
- **No true end-to-end tests.** The frontend suite (Vitest + jsdom) exercises component logic
  with a mocked `fetch`, not a real browser talking to a real backend — it won't catch things
  like the Vite proxy misconfiguration or actual CORS behavior. Consider adding Playwright/
  Cypress e2e tests if this gap becomes a real source of regressions.
- **No CI wiring.** This project is not currently a git repository with a CI pipeline, so
  `mvn test` / `npm test` must be run manually before each release — nothing enforces it today.
