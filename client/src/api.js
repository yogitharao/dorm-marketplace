const USER_KEY = "dorm-marketplace-user-id";

export function getUserId() {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-User-Id": getUserId(),
    ...options.headers,
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || res.statusText || "Request failed");
    err.code = data.code;
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function fetchItems() {
  return request("/api/items");
}

export function createListing(body) {
  return request("/api/items", { method: "POST", body: JSON.stringify(body) });
}

export function claimItem(id) {
  return request(`/api/items/${id}/claim`, { method: "POST" });
}

export function confirmPickup(id) {
  return request(`/api/items/${id}/confirm-pickup`, { method: "POST" });
}

export function markSold(id) {
  return request(`/api/items/${id}/mark-sold`, { method: "POST" });
}

export function forceRemove(id) {
  return request(`/api/items/${id}/remove`, { method: "POST" });
}
