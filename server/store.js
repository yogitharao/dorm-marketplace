import { randomUUID } from "crypto";

/** @typedef {'available' | 'pending_pickup' | 'sold' | 'removed'} ItemStatus */

/**
 * Pickup window: buyer must confirm handoff within this many ms (Scenario 2 — Ghost buyer).
 * Kept short for demo visibility.
 */
export const CLAIM_TTL_MS = 90_000;

const items = new Map();

/**
 * Scenario 2 — Ghost buyer: releases expired claims so the item is available again.
 * Called on every read/write and from a 1s server timer so expiry does not depend on polling.
 */
export function expireStaleClaims() {
  const now = Date.now();
  for (const item of items.values()) {
    if (
      item.status === "pending_pickup" &&
      item.claimExpiresAt != null &&
      now > item.claimExpiresAt
    ) {
      item.status = "available";
      item.claimedBy = null;
      item.claimExpiresAt = null;
    }
  }
}

/**
 * Synchronous claim (Scenario 1 — concurrency collision).
 * No await between availability check and state write, so exactly one concurrent request
 * can transition from "available" to "pending_pickup"; others get CLAIM_LOST with a reason.
 */
export function claimItem(itemId, userId) {
  expireStaleClaims();
  const item = items.get(itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Listing not found." };
  if (item.status !== "available") {
    return claimRejected(item, userId);
  }
  item.status = "pending_pickup";
  item.claimedBy = userId;
  item.claimExpiresAt = Date.now() + CLAIM_TTL_MS;
  return {
    ok: true,
    outcome: "CLAIM_WON",
    concurrencyNote:
      "Server accepted this claim first; any other simultaneous claim receives CLAIM_LOST.",
    item: serializeItem(item),
  };
}

/** Explains why claim failed — drives clear UI for collisions vs ended listings. */
function claimRejected(item, userId) {
  if (item.status === "pending_pickup") {
    const other = item.claimedBy && item.claimedBy !== userId;
    return {
      ok: false,
      code: "CLAIM_LOST",
      reason: other ? "CLAIM_SLOT_TAKEN_BY_OTHER" : "CLAIM_SLOT_HELD_BY_YOU",
      message: other
        ? "Claim failed: another student already holds this item for pickup (only one claim at a time)."
        : "You already have the active claim on this item — confirm handoff or wait for the timer to expire.",
      item: serializeItem(item),
    };
  }
  if (item.status === "sold") {
    return {
      ok: false,
      code: "UNAVAILABLE",
      reason: "ALREADY_SOLD",
      message: "This listing is already marked sold.",
      item: serializeItem(item),
    };
  }
  if (item.status === "removed") {
    return {
      ok: false,
      code: "UNAVAILABLE",
      reason: "REMOVED",
      message: "This listing was removed by the seller.",
      item: serializeItem(item),
    };
  }
  return {
    ok: false,
    code: "UNAVAILABLE",
    reason: "UNKNOWN",
    message: "This item is not available to claim.",
    item: serializeItem(item),
  };
}

export function confirmPickup(itemId, userId) {
  expireStaleClaims();
  const item = items.get(itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Listing not found." };
  if (item.status !== "pending_pickup") {
    return { ok: false, code: "INVALID_STATE", message: "Nothing to confirm for this listing." };
  }
  if (item.claimedBy !== userId) {
    return { ok: false, code: "FORBIDDEN", message: "Only the student who claimed this item can confirm pickup." };
  }
  item.status = "sold";
  item.claimExpiresAt = null;
  item.soldAt = Date.now();
  return { ok: true, item: serializeItem(item) };
}

/** Scenario 3 — Hallway sale: seller ends listing immediately. */
export function markSoldBySeller(itemId, sellerId) {
  expireStaleClaims();
  const item = items.get(itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Listing not found." };
  if (item.sellerId !== sellerId) {
    return { ok: false, code: "FORBIDDEN", message: "Only the seller can mark this listing." };
  }
  if (item.status === "removed") {
    return { ok: false, code: "INVALID_STATE", message: "Listing already removed." };
  }
  item.status = "sold";
  item.claimExpiresAt = null;
  item.claimedBy = null;
  item.soldAt = Date.now();
  return { ok: true, item: serializeItem(item) };
}

export function forceRemove(itemId, sellerId) {
  expireStaleClaims();
  const item = items.get(itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Listing not found." };
  if (item.sellerId !== sellerId) {
    return { ok: false, code: "FORBIDDEN", message: "Only the seller can remove this listing." };
  }
  item.status = "removed";
  item.claimExpiresAt = null;
  item.claimedBy = null;
  return { ok: true, item: serializeItem(item) };
}

export function createItem({ title, description, priceLabel, sellerId }) {
  const id = randomUUID();
  const item = {
    id,
    title: String(title).trim(),
    description: String(description ?? "").trim(),
    priceLabel: priceLabel != null ? String(priceLabel).trim() : "",
    sellerId,
    status: "available",
    claimedBy: null,
    claimExpiresAt: null,
    soldAt: null,
    createdAt: Date.now(),
  };
  if (!item.title) {
    return { ok: false, code: "VALIDATION", message: "Title is required." };
  }
  items.set(id, item);
  return { ok: true, item: serializeItem(item) };
}

export function listItems() {
  expireStaleClaims();
  return [...items.values()].map(serializeItem).sort((a, b) => b.createdAt - a.createdAt);
}

function serializeItem(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    priceLabel: item.priceLabel,
    sellerId: item.sellerId,
    status: item.status,
    claimedBy: item.claimedBy,
    claimExpiresAt: item.claimExpiresAt,
    soldAt: item.soldAt,
    createdAt: item.createdAt,
    claimTtlMs: CLAIM_TTL_MS,
  };
}

/** Seed data for demos */
export function seedIfEmpty() {
  if (items.size > 0) return;
  const seller = "demo-seller-1";
  createItem({
    title: "Calculus: Early Transcendentals (8th ed.)",
    description: "Some highlighting. Good for MATH 101.",
    priceLabel: "$40 or best offer",
    sellerId: seller,
  });
}
