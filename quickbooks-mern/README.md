# QuickBooks OAuth MERN practical

This project connects a React client and Express API to **QuickBooks Online** using **OAuth 2.0 over REST** (no Intuit SDK). Access and refresh tokens plus realm id (`companyId`) are stored in MongoDB. Customers and invoices can be fully or incrementally synchronized; incremental runs use an **`If-Modified-Since`** header on QuickBooks query requests and a **`Metadata.LastUpdatedTime`** filter so only changed entities are processed.

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- An [Intuit Developer](https://developer.intuit.com/) app with:
  - **Client ID** and **Client Secret** from the **Development** section of **Keys & OAuth** while you test against **Sandbox** companies (not the Production keys unless you connect a live QBO company).
  - **Redirect URI** exactly matching `QUICKBOOKS_REDIRECT_URI` (same string as in the Intuit app: scheme, host, port, path — no trailing slash mismatch).
  - **Accounting** scope enabled (`com.intuit.quickbooks.accounting`)
  - A **QuickBooks Sandbox company** linked to your developer account (see [Troubleshooting](#troubleshooting-intuit-uh-oh--connection-problem) below).

## Environment variables

Copy `server/.env.example` to `server/.env` and fill in values:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | Mongo connection string |
| `FRONTEND_URL` | React dev server origin (e.g. `http://localhost:5173`) |
| `QUICKBOOKS_CLIENT_ID` | Intuit app Client ID |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit app secret |
| `QUICKBOOKS_REDIRECT_URI` | Backend callback URL (must match Intuit dashboard) |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` (controls API base URL) |
| `QUICKBOOKS_OAUTH_SCOPES` | Optional. Space-separated scopes (default: `com.intuit.quickbooks.accounting`). Only add `openid profile email` if you enable them on the app in Intuit. |

## Database script

Optional indexes and collection names are defined in `database/schema.mongodb.js`. To apply:

```bash
mongosh "mongodb://127.0.0.1:27017/quickbooks_mern" database/schema.mongodb.js
```

Mongoose will also create collections on first write; the script adds uniqueness on `customerId` / `invoiceId` / `companyId` where applicable.

### Token document shape

The assignment refers to `expiresIn` as a date field; this codebase stores the computed expiry instant as **`expiresAt`** (a `Date`) alongside `accessToken`, `refreshToken`, and `companyId`.

## Install and run

**Terminal 1 — API**

```bash
cd server
npm install
cp .env.example .env
# edit .env
npm run dev
```

**Terminal 2 — Client**

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Use **Login with Quickbooks** (calls `GET /api/auth/connect`). After Intuit redirects to `/api/auth/callback`, tokens are saved and the browser is sent to `/home`.

The Vite dev server proxies `/api` to the API port in `client/vite.config.js` (must match `PORT` in `server/.env`, often `5001` if macOS uses port `5000` for AirPlay). OAuth and XHR then share one origin during development.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/connect` | Redirect to Intuit authorization |
| GET | `/api/auth/callback` | OAuth callback (code → tokens, save `realmId` as `companyId`) |
| GET | `/api/auth/diagnostics` | Safe checks that `.env` loaded (no secrets; useful before OAuth) |
| GET | `/api/status` | `{ connected, companyId }` |
| GET | `/api/quickbooks/contacts` | Live Customer query from QuickBooks (for the Contacts table) |
| POST | `/api/sync/customers/full` | Full customer sync into MongoDB |
| POST | `/api/sync/customers/delta` | Delta customer sync (full sync if collection empty) |
| POST | `/api/sync/invoices/full` | Full invoice sync |
| POST | `/api/sync/invoices/delta` | Delta invoice sync (full if empty) |
| GET | `/api/data/customers` | Customers stored in MongoDB |
| GET | `/api/data/invoices` | Invoices stored in MongoDB |

The service refreshes the access token automatically when it is near expiry (see `services/tokenService.js`).

## Project layout

- `server/models/` — Mongoose schemas (`QuickbooksTokens`, `customers`, `invoices`)
- `server/services/` — Token exchange/refresh, QuickBooks HTTP calls and sync
- `server/routes/` — Auth and REST routes
- `client/src/` — Login and Home UI with tables for contacts and invoices

## Troubleshooting: Intuit “Uh oh… connection problem” / “Test App didn’t connect”

That screen is shown **on Intuit’s site** before your app receives `code` and `realmId`. Your Node callback is not involved yet, so this is almost always **Intuit account / app settings**, not a bug in the redirect URL your code builds.

Do these in order:

1. **Sandbox company**  
   In [developer.intuit.com](https://developer.intuit.com/) open your app → use the **Sandbox** / test-company tools and ensure you have at least **one QuickBooks Online sandbox company** for the same Intuit login you use when you click **Connect**. If developer forums mention *“no sandbox companies found for the user”*, this is the fix.

2. **Redirect URI (exact match)**  
   Under **Keys & OAuth**, the redirect URI must be **character-for-character** the same as `QUICKBOOKS_REDIRECT_URI` (e.g. `http://localhost:5001/api/auth/callback` if your API runs on `5001`). Update either Intuit or `.env` so they match.

3. **Development vs Production keys**  
   For sandbox testing, copy **Development** Client ID and **Development** Client Secret into `.env`. Production keys are for live companies after Intuit’s production onboarding.

4. **Browser**  
   Try the OAuth flow in a **private/incognito** window or pause **ad blockers** for `appcenter.intuit.com` / `intuit.com`. Console errors like `ERR_BLOCKED_BY_CLIENT` for `cdn.decibelinsight.net` are analytics scripts blocked by the browser; they usually do **not** break OAuth, but they clutter the console.

5. **Details from Intuit**  
   On the error page, expand **“View error details (for Developers)”** and search that message in [Intuit Developer Support](https://help.developer.intuit.com/) — it names the precise rule that failed (sandbox, subscription, etc.).

6. **Verify your app loaded `.env`**  
   Open `GET /api/auth/diagnostics` (e.g. `http://localhost:5001/api/auth/diagnostics` or via the Vite proxy `http://localhost:5173/api/auth/diagnostics`). You should see `envOk: true`, `redirectEndsWithCallbackPath: true`, and non-zero lengths. If `envOk` is false, fix path loading or restart the API from the `server` directory.

### What “permanent” actually means here

Intuit’s **subscription / pre-auth** UI (`developer-apps-subscription-ui-*` in the browser console) runs **only on Intuit’s servers**. No change in this repo can force that step to succeed if your **developer account has no QuickBooks Online sandbox company**, your app uses the **wrong Development vs Production keys**, or the **redirect URI** in the portal does not match **exactly**. The durable fix is correct **Intuit Developer + Sandbox** setup; the code changes here only make our OAuth request **consistent** (trimmed secrets, stable authorize URL, optional scopes, safer callback parsing) and give you **diagnostics** to confirm environment loading.

## Production notes

- Serve the built React app over HTTPS and use HTTPS redirect URIs in Intuit.
- Keep secrets only in environment variables, never in the repo.
- Review Intuit rate limits and pagination (`MAXRESULTS` / `STARTPOSITION` in `quickbooksService.js`).

## License

Provided as sample code for a practical assessment.
