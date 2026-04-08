import { randomUUID } from "crypto";

/** @typedef {'available' | 'pending_pickup' | 'sold' | 'removed'} ItemStatus */

/**
 * Pickup window: buyer must confirm handoff within this many ms (Scenario 2 — Ghost buyer).
 * Kept short for demo visibility.
 */
export const CLAIM_TTL_MS = 90_000;

const items = new Map();

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
 * Synchronous claim (Scenario 1 — no await between check and update; one winner per item).
 */
export function claimItem(itemId, userId) {
  expireStaleClaims();
  const item = items.get(itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Listing not found." };
  if (item.status !== "available") {
    return { ok: false, code: "UNAVAILABLE", message: "This item is no longer available to claim." };
  }
  item.status = "pending_pickup";
  item.claimedBy = userId;
  item.claimExpiresAt = Date.now() + CLAIM_TTL_MS;
  return { ok: true, item: serializeItem(item) };
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
