// Serves the static site and a few small read-only endpoints for the RoLens showcases:
//   GET /api/values        current Rolimon's value, RAP and demand for the showcased items,
//                          plus the rare items shown as floating images (resolved by name)
//   GET /api/thumb/:id     an item's Roblox thumbnail (showcased and rare items only)
//   GET /api/item/:id      a rare item's large transparent image
//   GET /api/traders       name and display name of the traders in the example trade list
//   GET /api/avatar/:id    a trader's Roblox headshot (listed traders only)
// Images are proxied so visitors never contact Roblox. Only the items and players below are
// ever requested, and responses are cached at the edge, so Rolimon's and Roblox see at most
// one request per cache period, whatever the traffic.

const ITEMS = [1365767, 11748356, 1285307];
const RARE_NAMES = ["Red Sparkle Time Fedora", "Rainbow Shaggy", "Domino Crown", "The Classic ROBLOX Fedora"];
// Well-known traders: community favourites and players from Rolimon's top 100.
const TRADERS = [
  52040320, 291377849, 2207291, 5866753, // pmkopp, highlyswanted, Linkmon99, Simoon68
  3095250, 87353706, 73072929, 5649499, // rip_indra, zlib, CV10K, kenami
  3308733, 241063740, 37152862, 7733466, // davidweiss2, Bourgist, GodzGalaxy, InceptionTime
  14000877, 3343561540, 85222202, 680792218, // PolarisxProject, Commissioner_Bane, NirkZarek, Kilo16820
];

const ROLIMONS_URL = "https://api.rolimons.com/items/v2/itemdetails";
const VALUES_TTL = 600; // seconds
const THUMB_TTL = 86400;
const PROFILE_TTL = 86400;
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
      if (!ITEMS.includes(id) && !(await rareIds(request, ctx)).includes(id)) {
        return new Response("Not found", { status: 404 });
      }
      return cached(request, ctx, THUMB_TTL, () =>
        fetchImage(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=150x150&format=Webp&isCircular=false`),
      );
    }
    const large = url.pathname.match(/^\/api\/item\/(\d+)$/);
    if (large) {
      const id = Number(large[1]);
      if (!(await rareIds(request, ctx)).includes(id)) return new Response("Not found", { status: 404 });
      return cached(request, ctx, THUMB_TTL, () =>
        fetchImage(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`),
      );
    }
    if (url.pathname === "/api/traders") {
      // Keyed by the list itself, so a changed list is fetched afresh rather than served from the cache.
      return cached(request, ctx, PROFILE_TTL, fetchTraders, `?ids=${TRADERS.join(",")}`);
    }
    const avatar = url.pathname.match(/^\/api\/avatar\/(\d+)$/);
    if (avatar) {
      const id = Number(avatar[1]);
      if (!TRADERS.includes(id)) return new Response("Not found", { status: 404 });
      return cached(request, ctx, PROFILE_TTL, () =>
        fetchImage(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Webp&isCircular=false`),
      );
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

async function cached(request, ctx, ttl, produce, variant = "") {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + new URL(request.url).pathname + variant);
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

  const rare = [];
  for (const wanted of RARE_NAMES) {
    for (const [id, row] of Object.entries(data.items)) {
      if (!Array.isArray(row) || row[0] !== wanted) continue;
      const [name, , rap, value] = row;
      rare.push({ id: Number(id), name: String(name), rap: rap > 0 ? rap : null, value: value > 0 ? value : null });
      break;
    }
  }
  return json({ source: "Rolimon's", updated: new Date().toISOString(), items, rare }, 200);
}

// Ids of the rare items, read from the cached /api/values response.
async function rareIds(request, ctx) {
  const valuesUrl = new URL("/api/values", request.url);
  const res = await cached(new Request(valuesUrl), ctx, VALUES_TTL, fetchValues);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return data && Array.isArray(data.rare) ? data.rare.map((item) => item.id) : [];
}

async function fetchTraders() {
  const res = await fetch("https://users.roblox.com/v1/users", {
    method: "POST",
    headers: { "user-agent": USER_AGENT, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userIds: TRADERS, excludeBannedUsers: true }),
  });
  if (!res.ok) return json({ error: "unavailable" }, 502);
  const body = await res.json();
  const traders = (body && Array.isArray(body.data) ? body.data : [])
    .filter((user) => TRADERS.includes(user.id) && typeof user.name === "string")
    .map((user) => ({ id: user.id, name: user.name, displayName: String(user.displayName || user.name) }));
  if (!traders.length) return json({ error: "unavailable" }, 502);
  return json({ traders }, 200);
}

async function fetchImage(metaUrl) {
  const meta = await fetch(metaUrl, { headers: { "user-agent": USER_AGENT } });
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
