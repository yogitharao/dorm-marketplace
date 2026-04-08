import { useCallback, useEffect, useState } from "react";
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

export default function App() {
  const userId = getUserId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({ title: "", description: "", priceLabel: "" });

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
      await claimItem(id);
      setBanner({ type: "ok", text: "You claimed this item — confirm pickup before the timer ends." });
      await load();
    } catch (err) {
      setBanner({
        type: "err",
        text:
          err.status === 409
            ? "This item is no longer available (another student may have claimed it)."
            : err.message,
      });
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
          <ul className="grid">
            {items.map((item) => {
              const isSeller = item.sellerId === userId;
              const isClaimant = item.claimedBy === userId;
              const remaining =
                item.status === "pending_pickup" && item.claimExpiresAt
                  ? item.claimExpiresAt - Date.now()
                  : 0;
              void tick;

              return (
                <li key={item.id} className="card">
                  <div className="card-top">
                    <span className={`badge status-${item.status}`}>{statusLabel(item.status)}</span>
                    {item.priceLabel ? <span className="price">{item.priceLabel}</span> : null}
                  </div>
                  <h3>{item.title}</h3>
                  {item.description ? <p className="desc">{item.description}</p> : null}

                  {item.status === "pending_pickup" && item.claimExpiresAt && (
                    <p className="timer">
                      Pickup deadline: <strong>{formatRemaining(remaining)}</strong> left
                      {isClaimant ? " — confirm when you meet" : ""}
                    </p>
                  )}

                  <div className="actions">
                    {item.status === "available" && (
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
