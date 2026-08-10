# Transaction Management System (TMS)

A full-stack web application for viewing and managing financial transaction records.
The backend is built with **Java / Spring Boot** and stores data in a **CSV file**.
The frontend is built with **React** and served by the **Vite** development server.

---

## Table of Contents

1. [Required Software](#1-required-software)
2. [Project Structure](#2-project-structure)
3. [Configuration](#3-configuration)
4. [Running the Application](#4-running-the-application)
   - [Step 1 – Start the Backend](#step-1--start-the-backend)
   - [Step 2 – Start the Frontend](#step-2--start-the-frontend)
5. [Using the Application](#5-using-the-application)
6. [API Endpoint Reference](#6-api-endpoint-reference)
   - [GET /api/transactions](#get-apitransactions)
   - [POST /api/transactions](#post-apitransactions)
   - [PUT /api/transactions/{id}](#put-apitransactionsid)
   - [DELETE /api/transactions/{id}](#delete-apitransactionsid)
   - [Error Response Format](#error-response-format)
7. [Data Storage](#7-data-storage)
8. [Testing](#8-testing)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Required Software

Install all of the following before you begin. Links to official download pages are included.

| Software | Version Required | What it is used for | Download |
|---|---|---|---|
| Java (JDK) | 17 or higher | Runs the Spring Boot backend | https://adoptium.net |
| Apache Maven | 3.6 or higher | Builds the Java backend | https://maven.apache.org/download.cgi |
| Node.js | 18 or higher | Runs the React frontend | https://nodejs.org |
| npm | 9 or higher (comes with Node.js) | Installs frontend packages | Included with Node.js |

### Verifying your installations

Open a terminal and run each command below. You should see a version number printed — if you get a "command not found" error, that software is not installed or not on your PATH.

```bash
java -version
# Expected output example: openjdk version "17.0.x" ...

mvn -version
# Expected output example: Apache Maven 3.9.x ...

node -version
# Expected output example: v20.x.x

npm -version
# Expected output example: 10.x.x
```

---

## 2. Project Structure

```
transaction-system/
├── backend/                        # Java Spring Boot application
│   ├── pom.xml                     # Maven build file (lists dependencies)
│   └── src/
│       └── main/
│           ├── java/com/example/tms/
│           │   ├── TmsApplication.java              # Application entry point
│           │   ├── controller/
│           │   │   ├── TransactionController.java       # REST API endpoints
│           │   │   └── ValidationExceptionHandler.java  # Maps validation/parse errors to a uniform error body
│           │   ├── service/
│           │   │   └── TransactionService.java     # Business logic & CSV I/O
│           │   └── model/
│           │       ├── Transaction.java             # Transaction data model
│           │       ├── TransactionFilter.java        # Optional filter criteria for GET
│           │       ├── PagedResult.java              # Pagination envelope for GET
│           │       └── ErrorResponse.java            # Uniform error body {status, errors}
│           └── resources/
│               ├── application.properties      # App configuration
│               └── data/
│                   └── transactions.csv        # Data storage file
│
└── frontend/                       # React application
    ├── package.json                # Node.js build file (lists dependencies)
    ├── vite.config.js              # Vite dev server configuration
    ├── index.html                  # HTML entry point
    └── src/
        ├── main.jsx                # React entry point
        ├── App.jsx                 # Main application shell — Transactions table, modal, toolbar
        ├── App.css                 # Application styles
        ├── index.css               # Global styles
        ├── exportUtils.js          # Client-side CSV / .xlsx export (no backend endpoint)
        └── pages/
            ├── DashboardPage.jsx    # Stat cards, monthly volume chart, status donut, top customers
            ├── DashboardPage.css
            ├── CustomersPage.jsx    # Customers derived from transactions, search/sort, detail drawer
            └── CustomersPage.css
```

---

## 3. Configuration

### Backend configuration (`backend/src/main/resources/application.properties`)

```properties
# The port the backend server listens on
server.port=8080

# Path to the CSV file where transactions are stored
# This path is relative to the backend/ directory when you run Maven
tms.csv.file-path=src/main/resources/data/transactions.csv
```

You do not need to change these values to run the application locally. If port `8080` is already in use on your machine, change `server.port` to another value (e.g. `8081`) and update the proxy target in `frontend/vite.config.js` to match.

### CORS

The backend only allows cross-origin requests from `http://localhost:5173` (the default Vite dev
server port) — this is set via `@CrossOrigin(origins = "http://localhost:5173")` on
`TransactionController`. This does not affect requests made through the Vite proxy (see below),
but calling the API directly from a browser page served on a different origin/port will be
blocked. If you change the frontend's dev port, update this annotation to match.

### Frontend proxy (`frontend/vite.config.js`)

The frontend dev server is configured to forward any request starting with `/api` to the backend at `http://localhost:8080`. This means you do not need to configure CORS or API URLs separately during development — it is already handled.

```js
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  },
},
```

### Environment variables

This project does not require any `.env` files or environment variables to be set manually. All configuration is handled by `application.properties` (backend) and `vite.config.js` (frontend).

---

## 4. Running the Application

You need to run **two separate processes** — the backend and the frontend — each in its own terminal window.

### Step 1 – Start the Backend

1. Open a terminal.

2. Navigate to the `backend` folder:
   ```bash
   cd /path/to/transaction-system/backend
   ```
   > Replace `/path/to/transaction-system` with the actual path on your machine. For example: `cd ~/transaction-system/backend`

3. Build and run the Spring Boot application using Maven:
   ```bash
   mvn spring-boot:run
   ```
   > Maven will automatically download all required Java dependencies the first time. This may take a few minutes on the first run.

4. Wait until you see a line similar to the following in the terminal output:
   ```
   Started TmsApplication in 2.345 seconds (process running for 2.678)
   ```
   This means the backend is running and listening on `http://localhost:8080`.

5. **Keep this terminal window open.** Closing it will stop the backend.

---

### Step 2 – Start the Frontend

1. Open a **new** terminal window (leave the backend terminal running).

2. Navigate to the `frontend` folder:
   ```bash
   cd /path/to/transaction-system/frontend
   ```

3. Install the Node.js dependencies (only required the first time, or after pulling new changes):
   ```bash
   npm install
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```

5. You should see output similar to:
   ```
   VITE v5.x.x  ready in 300 ms

   ➜  Local:   http://localhost:5173/
   ```

6. Open your browser and go to: **http://localhost:5173**

   The Transaction Management System UI will load.

7. **Keep this terminal window open.** Closing it will stop the frontend.

---

## 5. Using the Application

Once both the backend and frontend are running, open **http://localhost:5173**. The app has a
sidebar with three pages: **Dashboard**, **Transactions**, and **Customers**.

### Dashboard

Read-only overview computed client-side from the loaded transactions:
- Stat cards for total volume, settled volume, pending volume, and failed count.
- A monthly volume bar chart (last 6 months with data).
- A status breakdown donut chart (Settled / Pending / Failed).
- A "Top Customers" list ranked by total volume.
- A "Recent Transactions" table (last 8) with a link back to the Transactions page.

### Transactions

- **Viewing transactions** — The table loads automatically when the page opens. Columns are
  sortable by clicking their header (date, account holder, amount, status).
- **Searching / filtering** — Use the search box (matches account holder name, account number, or
  amount) and the status filter dropdown.
- **Adding a transaction** — Click **+ Add Transaction** and fill in all four fields:
  - **Transaction Date** — Select a date using the date picker.
  - **Account Number** — Enter exactly 12 digits, numbers only (e.g. `123456789012`). Non-digit
    characters are stripped automatically as you type.
  - **Account Holder Name** — Enter the full name of the account holder.
  - **Amount** — Enter a positive number (e.g. `150.00`).

  Click **Submit**. The backend randomly assigns a status of `Pending`, `Settled`, or `Failed` to
  the new transaction, and the new row appears immediately in the table.
- **Editing a transaction** — Open the row's kebab (**⋮**) menu and choose **Edit**. All fields
  except `id` and `status` can be changed; `status` is assigned once at creation and cannot be
  edited.
- **Deleting a transaction** — Open the row's kebab menu and choose **Delete**, or select multiple
  rows and use the bulk action bar's **Delete** button.
- **Exporting** — Use the **Export** button (all rows) or select rows and use the bulk action
  bar's **Export** button, to download a **CSV** or **Excel (.xlsx)** file. Export is generated
  entirely in the browser — there is no backend export endpoint.
- **Closing the add/edit form** — Click **Cancel**, click outside the form, or press `Escape`.

> **Note:** The Transactions page fetches transactions from the backend without passing `page` or
> `size`, so it only ever loads the API's default first page (up to 20 records — see
> [API Endpoint Reference](#6-api-endpoint-reference)). With more than 20 transactions in the CSV
> file, older/excess records will not appear in the UI even though they still exist in the file
> and remain reachable via the API directly (e.g. `curl "http://localhost:8080/api/transactions?page=1"`).

### Customers

A customer view derived client-side by grouping transactions by account number — there is no
separate `/api/customers` endpoint.
- Summary cards: total customers, total volume, average spend per customer, top customer by volume.
- A sortable, searchable table (search by name or account number).
- Clicking a row opens a detail drawer with per-customer stats and full transaction history.

---

## 6. API Endpoint Reference

The backend exposes a REST API at `http://localhost:8080`. All endpoints accept and return JSON.
Every `Transaction` object returned by the API includes a server-generated `id` (a UUID string);
you never supply it yourself.

---

### GET /api/transactions

Returns a **paginated, optionally filtered** page of transactions.

**Request**

```
GET http://localhost:8080/api/transactions
```

All query parameters are optional and combinable:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `0` | Zero-based page index |
| `size` | integer | `20` | Records per page — must be between 1 and 100 |
| `status` | string | — | Exact match: `Pending`, `Settled`, or `Failed` |
| `accountNumber` | string | — | Exact match, e.g. `123456789012` |
| `from` | date (`yyyy-MM-dd`) | — | Inclusive start of `transactionDate` range |
| `to` | date (`yyyy-MM-dd`) | — | Inclusive end of `transactionDate` range |

`totalItems`/`totalPages` in the response always reflect the *filtered* count, not the total file
size.

**Example using curl:**
```bash
curl "http://localhost:8080/api/transactions?status=Pending&from=2025-01-01&to=2025-06-30&page=0&size=10"
```

**Success Response — `200 OK`**

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

**Error Response — `400 Bad Request`** (invalid `page`/`size`/`status`, or `from` after `to`) —
see [Error Response Format](#error-response-format).

**Error Response — `500 Internal Server Error`** — CSV file could not be read; see
[Error Response Format](#error-response-format).

---

### POST /api/transactions

Creates a new transaction. The backend generates the `id`, randomly assigns a status
(`Pending`, `Settled`, or `Failed`), and appends the record to the CSV file.

**Request**

```
POST http://localhost:8080/api/transactions
Content-Type: application/json
```

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `transactionDate` | string | Yes | Date in `yyyy-MM-dd` format (e.g. `"2026-08-05"`) |
| `accountNumber` | string | Yes | Exactly 12 digits, numbers only (e.g. `"123456789012"`) |
| `accountHolderName` | string | Yes | Non-blank full name of the account holder |
| `amount` | number | Yes | Must be greater than 0 |

Do **not** send `id` or `status` — both are set by the server and any client-supplied value is
ignored/overwritten.

**Example using curl:**
```bash
curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"123456789012","accountHolderName":"Jane Doe","amount":250.00}'
```

**Success Response — `201 Created`**

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

> `status` will be one of `"Pending"`, `"Settled"`, or `"Failed"` — assigned randomly by the server.

**Error Response — `400 Bad Request`** (missing/invalid field, or malformed JSON) — see
[Error Response Format](#error-response-format).

**Error Response — `500 Internal Server Error`** — CSV file could not be written; see
[Error Response Format](#error-response-format).

---

### PUT /api/transactions/{id}

Updates the editable fields (`transactionDate`, `accountNumber`, `accountHolderName`, `amount`)
of an existing transaction. `id` and `status` are always preserved from the stored record — the
same request body validation as `POST` applies, but `status` cannot be changed through this
endpoint.

**Request**

```
PUT http://localhost:8080/api/transactions/{id}
Content-Type: application/json
```

**Example using curl:**
```bash
curl -X PUT http://localhost:8080/api/transactions/b6e2c1a0-4d3f-4a2b-9e1c-7f8a9b0c1d2e \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"123456789012","accountHolderName":"Jane A. Doe","amount":275.00}'
```

**Success Response — `200 OK`** — the updated transaction, with its original `id` and `status`.

**Error Response — `404 Not Found`** — no transaction exists with the given `id`; see
[Error Response Format](#error-response-format).

**Error Response — `400 Bad Request`** — same validation rules as `POST`.

---

### DELETE /api/transactions/{id}

Removes the transaction with the given `id`.

**Request**

```
DELETE http://localhost:8080/api/transactions/{id}
```

**Example using curl:**
```bash
curl -X DELETE http://localhost:8080/api/transactions/b6e2c1a0-4d3f-4a2b-9e1c-7f8a9b0c1d2e
```

**Success Response — `204 No Content`** — empty body.

**Error Response — `404 Not Found`** — no transaction exists with the given `id`; see
[Error Response Format](#error-response-format).

---

### Error Response Format

Every non-2xx response (from all four endpoints above) uses the same JSON shape:

```json
{
  "status": 400,
  "errors": ["<message>", "..."]
}
```

Single-message example (a bad query parameter):
```json
{ "status": 400, "errors": ["page must be >= 0"] }
```

Multi-message example (multiple Bean Validation failures on the request body):
```json
{
  "status": 400,
  "errors": [
    "accountHolderName: Account holder name is required",
    "amount: Amount must be greater than 0"
  ]
}
```

An `accountNumber` that isn't exactly 12 digits (e.g. contains dashes, letters, or is the wrong
length) fails validation the same way:
```json
{ "status": 400, "errors": ["accountNumber: Account number must be exactly 12 digits (numbers only)"] }
```

---

## 7. Data Storage

Transactions are stored in a plain CSV (comma-separated values) file located at:

```
backend/src/main/resources/data/transactions.csv
```

The file uses the following columns:

```
id,transactionDate,accountNumber,accountHolderName,amount,status
```

**Example file contents:**

```csv
id,transactionDate,accountNumber,accountHolderName,amount,status
a1b2c3d4-0001-0001-0001-000000000001,2025-03-01,728934451121,Maria Johnson,150.00,Settled
a1b2c3d4-0002-0002-0002-000000000002,2025-03-05,1023-4567-8901,James Williams,320.50,Pending
a1b2c3d4-0003-0003-0003-000000000003,2025-03-10,5544-3322-1100,Linda Brown,75.00,Failed
```

- This file is created automatically if it does not exist when the first transaction is added.
- The file is pre-populated with sample data for demonstration purposes.
- There is no database — all data lives in this single file. Deleting it will remove all transaction history.
- A read/write lock guards the file so concurrent requests don't interleave, but every write
  (`POST`/`PUT`/`DELETE`) rewrites or appends to the whole file — there is no transaction log or
  backup mechanism.

---

## 8. Testing

This project does not currently include an automated test suite — `backend/pom.xml` includes
`spring-boot-starter-test` but no test classes exist yet, and `frontend/package.json` has no test
runner configured. Until automated tests are added, verify functionality manually as follows.

### Backend — manual API checks with curl

With the backend running on `http://localhost:8080`:

```bash
# Happy path: list, create, update, delete
curl "http://localhost:8080/api/transactions?page=0&size=5"

curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"123456789012","accountHolderName":"Jane Doe","amount":250.00}'
# → copy the "id" from the response for the next two calls

curl -X PUT http://localhost:8080/api/transactions/<id> \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"123456789012","accountHolderName":"Jane A. Doe","amount":275.00}'

curl -X DELETE http://localhost:8080/api/transactions/<id>

# Error paths — each should return 400/404 with the {status, errors} shape
curl "http://localhost:8080/api/transactions?page=-1"                     # 400: page must be >= 0
curl "http://localhost:8080/api/transactions?size=0"                      # 400: size must be between 1 and 100
curl "http://localhost:8080/api/transactions?status=Bogus"                # 400: invalid status
curl "http://localhost:8080/api/transactions?from=2026-01-01&to=2025-01-01" # 400: from after to
curl -X POST http://localhost:8080/api/transactions -H "Content-Type: application/json" -d '{}'  # 400: missing required fields
curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-05","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":250.00}' # 400: accountNumber must be exactly 12 digits
curl -X PUT http://localhost:8080/api/transactions/not-a-real-id \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2026-08-06","accountNumber":"999999999999","accountHolderName":"X","amount":1}'   # 404
curl -X DELETE http://localhost:8080/api/transactions/not-a-real-id       # 404
```

### Frontend — manual UI checklist

With both servers running, open `http://localhost:5173` and verify:

- **Transactions page** — table loads on open; add, edit, and delete a transaction and confirm
  the row updates immediately; sort by each column; filter by status; search by name/account
  number/amount; export CSV and .xlsx and open the downloaded files.
- **Dashboard page** — stat cards, monthly chart, and status donut reflect the current data; the
  "View all transactions" link navigates to the Transactions page.
- **Customers page** — customers list matches the distinct account numbers in your data; search
  and column sorting work; clicking a row opens the drawer with correct per-customer totals and
  transaction history.
- **Error handling** — with the backend stopped, reload the frontend and confirm it shows a
  fetch-error state instead of crashing.

---

## 9. Troubleshooting

**`mvn` command not found**
Maven is not installed or not on your system PATH. Download it from https://maven.apache.org/download.cgi and follow the installation instructions for your operating system.

**`npm` command not found**
Node.js is not installed. Download it from https://nodejs.org and install it. npm is included automatically.

**Backend fails to start: "Port 8080 is already in use"**
Another application is using port 8080. Either stop that application or change `server.port` in `backend/src/main/resources/application.properties` to a free port (e.g. `8081`). If you change the port, also update `frontend/vite.config.js` — change the proxy target from `http://localhost:8080` to `http://localhost:8081`.

**Frontend shows "Unable to fetch transactions"**
The backend is not running or has not finished starting up. Make sure you completed Step 1 and saw the "Started TmsApplication" message before opening the browser.

**Browser shows a blank page or cannot reach http://localhost:5173**
The frontend dev server is not running. Make sure you completed Step 2 and saw the Vite "ready" message in the second terminal.

**Changes to `transactions.csv` don't appear in the UI**
Refresh the browser page. The table fetches data from the server when the page loads. Manual edits to the CSV file will be reflected after a page refresh.
