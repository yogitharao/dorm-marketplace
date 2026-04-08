# Dorm Marketplace (MVP)

Campus marketplace for listing used items and coordinating in-person handoffs. **No real-money payments** — price is display-only.

## Product doc

See [PRD.md](./PRD.md) for scope cuts, MVP features, and acceptance criteria for the claim flow.

## Run locally

```bash
npm install
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173) (proxies `/api` to the server)
- **API:** [http://localhost:3001](http://localhost:3001)

Each browser profile gets a random `X-User-Id` (stored in `localStorage`). Use a second window or incognito to simulate two students.

### Production build (optional)

```bash
npm run build
set NODE_ENV=production
node server/index.js
```

On PowerShell: `$env:NODE_ENV='production'; node server/index.js` — then open [http://localhost:3001](http://localhost:3001).

## MVP summary (for Pull Request description)

**What’s included:** post listings, browse items, claim with a pickup timer, confirm handoff, seller **Mark as sold (elsewhere)** and **Remove listing**, server-side state so the UI stays consistent.

**What we cut:** in-app payments/escrow, accounts and email verification, chat/notifications/delivery tracking (see PRD).

**How the three scenarios are handled:**

1. **Concurrency** — Claim is an atomic check-and-set on the in-memory store (no interleaved await). The second request gets HTTP 409 and the UI refreshes to show the item unavailable.
2. **Ghost buyer** — After a claim, `claimExpiresAt` is set (90s in code for demo). If the buyer never confirms, the next API read expires the claim and the item returns to **available**.
3. **Hallway sale** — The seller (same `X-User-Id` as when the item was created) can **Mark as sold (elsewhere)** or **Remove listing** immediately.

## Demo video

Record a short walkthrough: create a listing, claim from another profile, show a failed second claim, optional expiry, seller override.
