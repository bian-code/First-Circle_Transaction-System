# Transaction Management System (TMS)

## Project Documentation

A full-stack web application for viewing and managing financial transaction records. The
backend is built with **Java 17 / Spring Boot 3** and stores data in a **CSV file**. The
frontend is built with **React 18** and served by the **Vite** development server.

This document is the authoritative reference for setting up, configuring, running, and testing
the application, and for integrating with its REST API. It reflects the code as of the current
`main` state, including pagination/filtering, full CRUD, and the Dashboard/Customers pages.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [Running the Application](#4-running-the-application)
5. [API Documentation](#5-api-documentation)
6. [Testing](#6-testing)

---

## 1. Prerequisites

Install all of the following before you begin.

| Software | Version Required | Used For | Download |
|---|---|---|---|
| Java (JDK) | 17 or higher | Runs the Spring Boot backend | https://adoptium.net |
| Apache Maven | 3.6 or higher | Builds and runs the Java backend | https://maven.apache.org/download.cgi |
| Node.js | 18 or higher | Runs the React frontend | https://nodejs.org |
| npm | 9 or higher (bundled with Node.js) | Installs frontend packages | Included with Node.js |

No database, message queue, or other external service is required — all data is stored in a
CSV file on disk.

### Verifying your installations

```bash
java -version
# Expected: openjdk version "17.0.x" ...

mvn -version
# Expected: Apache Maven 3.9.x ...

node -version
# Expected: v18.x.x or higher

npm -version
# Expected: 9.x.x or higher
```

If any command reports "command not found," that tool is not installed or not on your `PATH`.

---

## 2. Installation

1. **Get the code.** Clone or copy the repository, then note its absolute path — it's referred
   to below as `/path/to/transaction-system`.

2. **Install backend dependencies.**
   ```bash
   cd /path/to/transaction-system/backend
   mvn install
   ```
   Maven reads `pom.xml` and downloads Spring Boot, Bean Validation, and Apache Commons CSV the
   first time it runs; this can take a few minutes. You do not need to run this as a separate
   step — `mvn spring-boot:run` (see [Running the Application](#4-running-the-application)) will
   trigger the same download automatically on first use.

3. **Install frontend dependencies.**
   ```bash
   cd /path/to/transaction-system/frontend
   npm install
   ```
   This installs React, Vite, and the Vite React plugin per `package.json`.

No build step is required before running in development mode — `mvn spring-boot:run` and
`npm run dev` compile/bundle on the fly.

---

## 3. Configuration

### Backend — `backend/src/main/resources/application.properties`

```properties
# The port the backend server listens on
server.port=8080

# Path to the CSV file where transactions are stored (relative to backend/ when run via Maven)
tms.csv.file-path=src/main/resources/data/transactions.csv
```

Defaults work out of the box. If port `8080` is already in use, change `server.port` and update
the frontend proxy target below to match.

### CORS

`TransactionController` is annotated with `@CrossOrigin(origins = "http://localhost:5173")` —
only that origin may call the API directly from browser JavaScript. This is independent of the
Vite proxy (next section); if you change the frontend's dev port, update this annotation too.

### Frontend — `frontend/vite.config.js`

```js
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
},
```

The dev server forwards any request starting with `/api` to the backend, so the frontend never
needs a hardcoded API base URL or CORS workaround during development.

### Environment variables

None. There are no `.env` files anywhere in the project — all configuration lives in
`application.properties` (backend) and `vite.config.js` (frontend).

---

## 4. Running the Application

Run the backend and frontend as two separate processes, each in its own terminal.

### Start the backend

```bash
cd /path/to/transaction-system/backend
mvn spring-boot:run
```

Wait for a line like:
```
Started TmsApplication in 2.345 seconds (process running for 2.678)
```
The API is now listening on `http://localhost:8080`. Keep this terminal open.

### Start the frontend

```bash
cd /path/to/transaction-system/frontend
npm install   # first run only, or after dependency changes
npm run dev
```

Wait for:
```
VITE v5.x.x  ready in 300 ms
➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in a browser. Keep this terminal open as well.

### Production frontend build (optional)

```bash
npm run build     # bundles to frontend/dist
npm run preview   # serves the production build locally for a sanity check
```
The backend has no equivalent "production" mode distinction for this project — `mvn
spring-boot:run` is used the same way in both development and casual production use, or you can
package it with `mvn package` and run the resulting jar with `java -jar target/*.jar`.

---

## 5. API Documentation

Base URL: `http://localhost:8080`. All endpoints consume and produce JSON. Every `Transaction`
returned by the API includes a server-generated `id` (UUID string) — never supplied by the
client.

### Transaction object

| Field | Type | Notes |
|---|---|---|
| `id` | string | Server-generated UUID. Read-only. |
| `transactionDate` | string (`yyyy-MM-dd`) | Required on write. |
| `accountNumber` | string | Required. Exactly 12 digits, numbers only (e.g. `123456789012`). |
| `accountHolderName` | string | Required, non-blank. |
| `amount` | number | Required, must be `> 0`. |
| `status` | string | One of `Pending`, `Settled`, `Failed`. Assigned randomly by the server at creation; read-only thereafter. |

### GET /api/transactions

Returns a paginated, optionally filtered page of transactions.

**Query parameters** (all optional, combinable):

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `0` | Zero-based page index |
| `size` | integer | `20` | Records per page, `1`–`100` |
| `status` | string | — | Exact match: `Pending`, `Settled`, `Failed` |
| `accountNumber` | string | — | Exact match |
| `from` | date `yyyy-MM-dd` | — | Inclusive lower bound on `transactionDate` |
| `to` | date `yyyy-MM-dd` | — | Inclusive upper bound on `transactionDate` |

`totalItems`/`totalPages` reflect the filtered result set, not the whole file.

```bash
curl "http://localhost:8080/api/transactions?status=Pending&from=2025-01-01&to=2025-06-30&page=0&size=10"
```

**200 OK**
```json
{
  "data": [
    {
      "id": "3a1f9e2c-8b7d-4e11-9c2a-6f0d1b2a3c4d",
      "transactionDate": "2025-03-01",
      "accountNumber": "728934451121",
      "accountHolderName": "Maria Johnson",
      "amount": 150.0,
      "status": "Settled"
    }
  ],
  "page": 0,
  "size": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

**400 Bad Request** — invalid `page`/`size`/`status`, or `from` after `to`.
**500 Internal Server Error** — CSV file could not be read.
Both use the [Error Response Format](#error-response-format).

### POST /api/transactions

Creates a transaction. The server generates `id` and randomly assigns `status`.

```bash
curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"123456789012","accountHolderName":"Jane Doe","amount":250.00}'
```

**201 Created**
```json
{
  "id": "b6e2c1a0-4d3f-4a2b-9e1c-7f8a9b0c1d2e",
  "transactionDate": "2026-08-05",
  "accountNumber": "123456789012",
  "accountHolderName": "Jane Doe",
  "amount": 250.0,
  "status": "Settled"
}
```

**400 Bad Request** — missing/invalid field or malformed JSON.
**500 Internal Server Error** — CSV file could not be written.

### PUT /api/transactions/{id}

Updates `transactionDate`, `accountNumber`, `accountHolderName`, and `amount` of an existing
transaction. `id` and `status` are preserved from the stored record regardless of what's sent.

```bash
curl -X PUT http://localhost:8080/api/transactions/b6e2c1a0-4d3f-4a2b-9e1c-7f8a9b0c1d2e \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"123456789012","accountHolderName":"Jane A. Doe","amount":275.00}'
```

**200 OK** — the updated transaction. **404 Not Found** — no transaction with that `id`.
**400 Bad Request** — same validation as `POST`.

### DELETE /api/transactions/{id}

```bash
curl -X DELETE http://localhost:8080/api/transactions/b6e2c1a0-4d3f-4a2b-9e1c-7f8a9b0c1d2e
```

**204 No Content** — empty body. **404 Not Found** — no transaction with that `id`.

### Error Response Format

Every non-2xx response from any endpoint above uses:

```json
{ "status": 400, "errors": ["<message>", "..."] }
```

Single-message example:
```json
{ "status": 400, "errors": ["page must be >= 0"] }
```

Multi-message example (Bean Validation on the request body):
```json
{
  "status": 400,
  "errors": [
    "accountHolderName: Account holder name is required",
    "amount: Amount must be greater than 0"
  ]
}
```

An `accountNumber` that isn't exactly 12 digits fails validation the same way:
```json
{ "status": 400, "errors": ["accountNumber: Account number must be exactly 12 digits (numbers only)"] }
```

### Not backed by a dedicated endpoint

The **Dashboard** and **Customers** pages in the frontend are computed entirely client-side from
`GET /api/transactions` results — there is no `/api/dashboard` or `/api/customers` endpoint.
Likewise, CSV/Excel export is generated in the browser (`frontend/src/exportUtils.js`), not by
the server.

> **Known limitation:** the frontend calls `GET /api/transactions` without `page`/`size`
> parameters, so it only ever displays the API's default first page (up to 20 records). Data
> beyond that is still stored and reachable via the API directly, just not shown in the current
> UI.

---

## 6. Testing

Automated coverage exists at three levels; see [`docs/TEST-PLAN.md`](TEST-PLAN.md) for the full
strategy, test case tables, and traceability:

```bash
cd backend && mvn test                                              # JUnit 5 + MockMvc
cd frontend && npm install && npm test                              # Vitest + React Testing Library
cd frontend && npx playwright install chromium && npm run test:e2e  # Playwright, one-time browser install
```

`npm run test:e2e` drives a real Chromium browser against real, dedicated backend and frontend
instances (`frontend/playwright.config.js` starts both automatically), with the backend's CSV
path overridden to a scratch file under `backend/target/e2e-data/` — it never touches the real
seed data at `backend/src/main/resources/data/transactions.csv`. The manual checklist below is
for anything not yet covered by an automated layer.

### Backend — manual API verification (curl)

```bash
# Happy path
curl "http://localhost:8080/api/transactions?page=0&size=5"

curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"123456789012","accountHolderName":"Jane Doe","amount":250.00}'
# copy the returned "id" for the next two calls

curl -X PUT http://localhost:8080/api/transactions/<id> \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"123456789012","accountHolderName":"Jane A. Doe","amount":275.00}'

curl -X DELETE http://localhost:8080/api/transactions/<id>
```

```bash
# Error paths — each should return the {status, errors} shape with the noted code
curl "http://localhost:8080/api/transactions?page=-1"                       # 400
curl "http://localhost:8080/api/transactions?size=0"                        # 400
curl "http://localhost:8080/api/transactions?status=Bogus"                  # 400
curl "http://localhost:8080/api/transactions?from=2026-01-01&to=2025-01-01" # 400
curl -X POST http://localhost:8080/api/transactions -H "Content-Type: application/json" -d '{}'  # 400
curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":250.00}' # 400: not exactly 12 digits
curl -X PUT http://localhost:8080/api/transactions/not-a-real-id \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"999999999999","accountHolderName":"X","amount":1}'   # 404
curl -X DELETE http://localhost:8080/api/transactions/not-a-real-id         # 404
```

### Frontend — manual UI checklist

With both servers running, open `http://localhost:5173`:

- **Transactions** — table loads on open; add, edit, and delete a transaction and confirm the
  row updates immediately; sort each column; filter by status; search by name, account number,
  and amount; export CSV and `.xlsx` and open the downloaded files to confirm they're valid.
- **Dashboard** — stat cards, monthly volume chart, and status donut reflect current data
  correctly; "View all transactions" navigates to the Transactions page.
- **Customers** — the customer list matches the distinct account numbers present in your data;
  search and sorting work; opening a row's drawer shows correct per-customer totals and
  transaction history.
- **Error handling** — stop the backend, reload the frontend, and confirm it shows a fetch-error
  state instead of crashing or hanging silently.

Still manual-only per `docs/TEST-PLAN.md`: bulk select/export/delete, modal-dismissal (Cancel /
`Escape` / click-outside), and the backend-down error state above — the e2e suite doesn't cover
these yet.
