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
- **API:** [http://localhost:3002](http://localhost:3002) (override with `PORT`)

Each browser profile gets a random `X-User-Id` (stored in `localStorage`). Use a second window or incognito to simulate another student.

### Production build (optional)

```bash
npm run build
$env:NODE_ENV='production'; node server/index.js
```

Then open [http://localhost:3002](http://localhost:3002) (or whatever `PORT` you set).

## MVP summary (for Pull Request description)

**What’s included:** post listings, browse items, **per-card availability** (open / claim held by you / claim held by another / closed), claim with pickup timer, confirm handoff, seller **Mark as sold (elsewhere)** and **Remove listing**, server-side state.

**What we cut:** in-app payments/escrow, accounts and email verification, chat/notifications/delivery tracking (see PRD).

**How the three scenarios are handled:**

1. **Concurrency** — `claimItem` updates state in one synchronous turn (no `await` between check and write). The losing request gets HTTP **409** with `code: "CLAIM_LOST"` and `reason: "CLAIM_SLOT_TAKEN_BY_OTHER"`. The UI explains that another student holds the slot.
2. **Ghost buyer** — Each claim sets `claimExpiresAt`. **Expiry runs on a 1s server timer** and on every API read, so the listing reopens even without polling. The UI shows an urgent timer and a banner if **your** claim expires without confirmation.
3. **Hallway sale** — The seller (`X-User-Id` matches listing) can **Mark as sold (elsewhere)** or **Remove listing** immediately; pending claims are cleared.

## Demo video (suggested talking points)

Use this so reviewers hear **scope** and **messy scenarios** clearly:

1. **MVP in one sentence:** “Students post items, one buyer at a time gets a timed pickup slot, confirm in person or the listing reopens — no money in the app.”
2. **What we cut:** “No payments, no accounts, no chat — coordination is face-to-face.”
3. **Concurrency:** Open two profiles, both click Claim on the same item — “Only one succeeds; the API returns claim lost for the other, and the card shows *claim in progress* for everyone else.”
4. **Ghost buyer:** As the winner, wait without confirming — “When the timer hits zero, the card returns to *open to claim*; if I was the buyer, the app tells me my window expired.”
5. **Hallway sale:** As seller, “Mark as sold elsewhere” — “The listing closes immediately even if someone had claimed.”

## Demo video (recording checklist)

- Create a listing on profile A; show the green **Open to claim** strip.
- On profile B, claim it; show profile A now sees **Not available — claim in progress**.
- On profile A, try Claim — show **409 / claim lost** message or locked strip.
- Let the timer expire on B without confirming; show **Open to claim** again.
- Seller uses **Mark as sold** or **Remove** from profile A on a fresh listing.
