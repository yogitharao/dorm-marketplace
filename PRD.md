# Dorm Marketplace — Product Requirements (MVP)

## 1. Scope Cut

We are intentionally **not** building the following in the MVP:

1. **In-app payments or escrow** — Real money adds compliance, refunds, and dispute handling that are unnecessary for a campus handoff prototype focused on availability and pickup coordination.

2. **User accounts, passwords, and email verification** — Authentication infrastructure would dominate the timeline and is not required to prove listing, claiming, and state transitions work under messy usage.

3. **Live chat, notifications, and delivery tracking** — Async messaging and push notifications are scope creep for Day 1; buyers and sellers coordinate pickup time and place outside the app, which matches the in-person handoff model.

## 2. MVP Features

1. **Create listings** — A student can post a used item (title, short description, optional price as display-only) so it appears in the marketplace for others to browse.

2. **Browse and claim** — Anyone can see available items and **claim** one; the item moves to a **pending pickup** state with a visible countdown until handoff must be confirmed.

3. **Resolve pickup or release the item** — The buyer confirms handoff (sold), the claim **expires** if they never confirm (item returns to available), or the **seller** can mark the item sold elsewhere or remove the listing immediately.

## 3. Acceptance Criteria — Claim Item Flow

**AC1 — Successful claim**

- **Given** an item is in the **available** state  
- **When** a student clicks **Claim** and the server accepts the claim  
- **Then** the item is shown as **pending pickup** for that student, a pickup deadline timer is visible, and other students can no longer claim it.

**AC2 — Claim rejected when not available**

- **Given** an item is **not** in the available state (already claimed, sold, or removed)  
- **When** a student attempts to **Claim** that item  
- **Then** the claim does not succeed, the UI shows that the item is unavailable, and the listing state does not change incorrectly.

**AC3 — Claim expires without handoff**

- **Given** a student has successfully claimed an item and the pickup deadline has not passed  
- **When** the deadline passes without the buyer confirming handoff  
- **Then** the claim is released, the item returns to **available**, and another student can claim it.
