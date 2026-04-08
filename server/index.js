import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  listItems,
  createItem,
  claimItem,
  confirmPickup,
  markSoldBySeller,
  forceRemove,
  seedIfEmpty,
  expireStaleClaims,
  CLAIM_TTL_MS,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

/** Ghost buyer: expire claims on a timer so listings reopen even if nobody refreshes. */
setInterval(() => expireStaleClaims(), 1000);

app.use(cors());
app.use(express.json());

function userId(req) {
  return req.header("x-user-id") || "anonymous";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, claimTtlMs: CLAIM_TTL_MS });
});

app.get("/api/items", (_req, res) => {
  seedIfEmpty();
  res.json({ items: listItems() });
});

app.post("/api/items", (req, res) => {
  seedIfEmpty();
  const { title, description, priceLabel } = req.body || {};
  const result = createItem({ title, description, priceLabel, sellerId: userId(req) });
  if (!result.ok) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

app.post("/api/items/:id/claim", (req, res) => {
  const result = claimItem(req.params.id, userId(req));
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.post("/api/items/:id/confirm-pickup", (req, res) => {
  const result = confirmPickup(req.params.id, userId(req));
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.post("/api/items/:id/mark-sold", (req, res) => {
  const result = markSoldBySeller(req.params.id, userId(req));
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.post("/api/items/:id/remove", (req, res) => {
  const result = forceRemove(req.params.id, userId(req));
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

const dist = path.join(__dirname, "..", "client", "dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Dorm Marketplace API http://localhost:${PORT}`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other process or set PORT to a free port in your environment.`
    );
  }
  throw err;
});
