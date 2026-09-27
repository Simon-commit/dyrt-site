// Serves the static site and two small read-only endpoints for the live offer card:
//   GET /api/values       current Rolimon's value, RAP and demand for the showcased items
//   GET /api/thumb/:id    the item's Roblox thumbnail, proxied so visitors never contact Roblox
// Only the item ids below are ever requested. Responses are cached at the edge, so
// Rolimon's sees at most one request per cache period, whatever the traffic.

const ITEMS = [1365767, 11748356, 1285307];

const ROLIMONS_URL = "https://api.rolimons.com/items/v2/itemdetails";
const VALUES_TTL = 600; // seconds
const THUMB_TTL = 86400;
const USER_AGENT = "dyrt.io (+https://dyrt.io)";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    if (url.pathname === "/api/values") {
      return cached(request, ctx, VALUES_TTL, fetchValues);
    }
    const thumb = url.pathname.match(/^\/api\/thumb\/(\d+)$/);
    if (thumb) {
      const id = Number(thumb[1]);
      if (!ITEMS.includes(id)) return new Response("Not found", { status: 404 });
      return cached(request, ctx, THUMB_TTL, () => fetchThumb(id));
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

async function cached(request, ctx, ttl, produce) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + new URL(request.url).pathname);
  const hit = await cache.match(key);
  if (hit) return hit;

  let response;
  try {
    response = await produce();
  } catch {
    response = json({ error: "unavailable" }, 503);
  }
  if (response.ok) {
    response = new Response(response.body, response);
    response.headers.set("cache-control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, response.clone()));
  } else {
    response.headers.set("cache-control", "no-store");
  }
  return response;
}

async function fetchValues() {
  const res = await fetch(ROLIMONS_URL, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) return json({ error: "unavailable" }, 502);
  const data = await res.json();
  if (!data || !data.items) return json({ error: "unavailable" }, 502);

  const items = ITEMS.map((id) => {
    const row = data.items[id];
    if (!Array.isArray(row)) return null;
    const [name, , rap, value, , demand] = row;
    return {
      id,
      name: String(name),
      rap: rap > 0 ? rap : null,
      value: value > 0 ? value : null,
      demand: Number.isInteger(demand) ? demand : -1,
    };
  }).filter(Boolean);

  if (items.length !== ITEMS.length) return json({ error: "unavailable" }, 502);
  return json({ source: "Rolimon's", updated: new Date().toISOString(), items }, 200);
}

async function fetchThumb(id) {
  const meta = await fetch(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=110x110&format=Webp&isCircular=false`,
    { headers: { "user-agent": USER_AGENT } },
  );
  if (!meta.ok) return new Response("Unavailable", { status: 502 });
  const body = await meta.json();
  const src = body && body.data && body.data[0] && body.data[0].imageUrl;
  if (!src || !/^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//.test(src)) {
    return new Response("Unavailable", { status: 502 });
  }
  const image = await fetch(src);
  const type = image.headers.get("content-type") || "";
  if (!image.ok || !type.startsWith("image/")) return new Response("Unavailable", { status: 502 });
  return new Response(image.body, {
    headers: { "content-type": type, "x-content-type-options": "nosniff" },
  });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
