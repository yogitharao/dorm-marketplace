import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUserId,
  fetchItems,
  createListing,
  claimItem,
  confirmPickup,
  markSold,
  forceRemove,
} from "./api.js";

function formatRemaining(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function statusLabel(status) {
  switch (status) {
    case "available":
      return "Available";
    case "pending_pickup":
      return "Pending pickup";
    case "sold":
      return "Sold";
    case "removed":
      return "Removed";
    default:
      return status;
  }
}

/** Clear, testable UI mapping for “can I claim?” and why not. */
function describeAvailability(item, viewerId) {
  switch (item.status) {
    case "available":
      return {
        stripClass: "avail-open",
        headline: "Open to claim",
        detail:
          "First successful server claim wins; if two people try at once, only one gets the pickup slot.",
        showClaim: true,
      };
    case "pending_pickup": {
      if (item.claimedBy === viewerId) {
        return {
          stripClass: "avail-yours",
          headline: "You hold the only claim",
          detail:
            "Confirm handoff after you meet in person. If you do not confirm before the timer ends, this listing becomes open again (ghost buyer protection).",
          showClaim: false,
        };
      }
      return {
        stripClass: "avail-locked",
        headline: "Not available — claim in progress",
        detail:
          "Another student holds the pickup slot. You cannot claim until the timer expires without confirmation or they complete handoff.",
        showClaim: false,
      };
    }
    case "sold":
      return {
        stripClass: "avail-ended",
        headline: "Closed — sold",
        detail: "This item is no longer on the market.",
        showClaim: false,
      };
    case "removed":
      return {
        stripClass: "avail-ended",
        headline: "Closed — removed",
        detail: "The seller removed this listing.",
        showClaim: false,
      };
    default:
      return {
        stripClass: "avail-ended",
        headline: "Unknown state",
        detail: "",
        showClaim: false,
      };
  }
}

function claimErrorMessage(err) {
  if (err.code === "CLAIM_LOST" && err.body?.reason === "CLAIM_SLOT_TAKEN_BY_OTHER") {
    return "Claim lost: another student already got the pickup slot (concurrency). The listing stays locked until they finish or the timer expires.";
  }
  if (err.code === "CLAIM_LOST" && err.body?.reason === "CLAIM_SLOT_HELD_BY_YOU") {
    return "You already have the active claim — use Confirm handoff or wait for the timer.";
  }
  if (err.body?.message) return err.body.message;
  if (err.status === 409) {
    return "This item is not available to claim right now.";
  }
  return err.message;
}

export default function App() {
  const userId = getUserId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({ title: "", description: "", priceLabel: "" });
  const prevSnapshotRef = useRef(new Map());
  const ghostWarnedRef = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const data = await fetchItems();
      setItems(data.items || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /** Detect ghost-buyer expiry: pending → available while you were the claimant. */
  useEffect(() => {
    for (const item of items) {
      const prev = prevSnapshotRef.current.get(item.id);
      if (
        prev &&
        prev.status === "pending_pickup" &&
        item.status === "available" &&
        prev.claimedBy === userId &&
        !ghostWarnedRef.current.has(item.id)
      ) {
        ghostWarnedRef.current.add(item.id);
        setBanner({
          type: "err",
          text: "Pickup window expired — you did not confirm in time. The item is open to claim again.",
        });
      }
      prevSnapshotRef.current.set(item.id, {
        status: item.status,
        claimedBy: item.claimedBy,
      });
    }
    for (const item of items) {
      if (item.status === "pending_pickup" && item.claimedBy === userId) {
        ghostWarnedRef.current.delete(item.id);
      }
    }
  }, [items, userId]);

  async function handleCreate(e) {
    e.preventDefault();
    setBanner(null);
    try {
      await createListing({
        title: form.title,
        description: form.description,
        priceLabel: form.priceLabel || undefined,
      });
      setForm({ title: "", description: "", priceLabel: "" });
      setBanner({ type: "ok", text: "Listing created." });
      await load();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  }

  async function handleClaim(id) {
    setBanner(null);
    try {
      const data = await claimItem(id);
      const note = data.concurrencyNote
        ? " Only one student can hold the claim; simultaneous clicks are resolved on the server."
        : "";
      setBanner({
        type: "ok",
        text: `Claim accepted — you have the pickup slot.${note} Confirm handoff before the timer ends.`,
      });
      await load();
    } catch (err) {
      setBanner({ type: "err", text: claimErrorMessage(err) });
      await load();
    }
  }

  async function handleConfirm(id) {
    setBanner(null);
    try {
      await confirmPickup(id);
      setBanner({ type: "ok", text: "Pickup confirmed. Item marked sold." });
      await load();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  }

  async function handleMarkSold(id) {
    setBanner(null);
    try {
      await markSold(id);
      setBanner({ type: "ok", text: "Marked as sold outside the app." });
      await load();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  }

  async function handleRemove(id) {
    setBanner(null);
    try {
      await forceRemove(id);
      setBanner({ type: "ok", text: "Listing removed." });
      await load();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Campus handoff</p>
          <h1>Dorm Marketplace</h1>
          <p className="lede">
            List used textbooks, furniture, and gear. One buyer at a time — claim, meet in person, confirm
            pickup. No payments in the app.
          </p>
        </div>
      </header>

      <main className="main">
        <section className="panel rules">
          <h2>How this MVP behaves</h2>
          <ul>
            <li>
              <strong>Same book, two clicks (concurrency):</strong> the server accepts only one claim; the other
              student sees the item as unavailable.
            </li>
            <li>
              <strong>Ghost buyer:</strong> after you claim, confirm pickup within the timer or the listing goes
              back to available.
            </li>
            <li>
              <strong>Hallway sale:</strong> if you sold it in real life first, use <em>Mark as sold</em> or{" "}
              <em>Remove listing</em> on your post.
            </li>
          </ul>
          <p className="hint">
            Your session ID (stored locally): <code>{userId.slice(0, 8)}…</code> — open a second browser or
            incognito to simulate another student.
          </p>
        </section>

        {banner && (
          <div className={`banner ${banner.type}`} role="status">
            {banner.text}
          </div>
        )}
        {error && (
          <div className="banner err" role="alert">
            {error}
          </div>
        )}

        <section className="panel">
          <h2>List an item</h2>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. TI-84 calculator"
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Condition, dorm pickup, etc."
              />
            </label>
            <label>
              Price (display only)
              <input
                value={form.priceLabel}
                onChange={(e) => setForm((f) => ({ ...f, priceLabel: e.target.value }))}
                placeholder="e.g. $25"
              />
            </label>
            <button type="submit" className="btn primary">
              Post listing
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Marketplace</h2>
          {loading && <p className="muted">Loading…</p>}
          {!loading && items.length === 0 && <p className="muted">No listings yet. Be the first to post.</p>}
          <ul className="grid" aria-live="polite">
            {items.map((item) => {
              const isSeller = item.sellerId === userId;
              const isClaimant = item.claimedBy === userId;
              const remaining =
                item.status === "pending_pickup" && item.claimExpiresAt
                  ? item.claimExpiresAt - Date.now()
                  : 0;
              void tick;
              const avail = describeAvailability(item, userId);
              const urgent = item.status === "pending_pickup" && isClaimant && remaining > 0 && remaining <= 30_000;

              return (
                <li key={item.id} className="card">
                  <div className="card-top">
                    <span className={`badge status-${item.status}`}>{statusLabel(item.status)}</span>
                    {item.priceLabel ? <span className="price">{item.priceLabel}</span> : null}
                  </div>

                  <div className={`avail-strip ${avail.stripClass}`}>
                    <strong>{avail.headline}</strong>
                    <span className="avail-detail">{avail.detail}</span>
                  </div>

                  <h3>{item.title}</h3>
                  {item.description ? <p className="desc">{item.description}</p> : null}

                  {item.status === "pending_pickup" && isSeller && !isClaimant && (
                    <p className="seller-hint" role="status">
                      A buyer has claimed this listing. If you already sold it in person, use Mark as sold or Remove.
                    </p>
                  )}

                  {item.status === "pending_pickup" && item.claimExpiresAt && (
                    <p className={`timer${urgent ? " timer-urgent" : ""}`}>
                      <span className="timer-label">Pickup timer</span>
                      <strong>{formatRemaining(remaining)}</strong> remaining
                      {isClaimant
                        ? " — confirm after you meet, or this listing will reopen automatically."
                        : null}
                    </p>
                  )}

                  <div className="actions">
                    {avail.showClaim && (
                      <button type="button" className="btn primary" onClick={() => handleClaim(item.id)}>
                        Claim item
                      </button>
                    )}
                    {item.status === "pending_pickup" && isClaimant && (
                      <button type="button" className="btn primary" onClick={() => handleConfirm(item.id)}>
                        Confirm handoff
                      </button>
                    )}
                    {isSeller && item.status !== "sold" && item.status !== "removed" && (
                      <>
                        <button type="button" className="btn ghost" onClick={() => handleMarkSold(item.id)}>
                          Mark as sold (elsewhere)
                        </button>
                        <button type="button" className="btn danger" onClick={() => handleRemove(item.id)}>
                          Remove listing
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Dorm Marketplace MVP — in-memory server state, no real payments.</p>
      </footer>
    </div>
  );
}
