// Fills the RoLens showcases with current data served and cached by this site's own Worker: Rolimon's values for
// the example offer and the rare items on the home card, and trader names for the example trade list.
(() => {
  "use strict";

  const USD_PER_THOUSAND = 3;
  const DEMAND = ["Terrible", "Low", "Normal", "High", "Amazing"];
  const whole = new Intl.NumberFormat("en-US");
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const compact = (n) => {
    const fmt = (v, s) => `${Number(v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0))}${s}`;
    if (n >= 1e9) return fmt(n / 1e9, "B");
    if (n >= 1e6) return fmt(n / 1e6, "M");
    if (n >= 1e3) return fmt(n / 1e3, "K");
    return whole.format(n);
  };
  const estimate = (n) => `≈${usd.format((n / 1000) * USD_PER_THOUSAND)}`;
  const set = (root, field, text) => {
    const el = root.querySelector(`[data-f="${field}"]`);
    if (el) el.textContent = text;
  };

  // Thumbnails that fail to load keep their neutral placeholder rather than a broken image.
  const hideBroken = (img) => {
    const slot = document.createElement("span");
    slot.className = "thumb";
    img.replaceWith(slot);
  };
  document.querySelectorAll(".thumb").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) hideBroken(img);
    else img.addEventListener("error", () => hideBroken(img), { once: true });
  });

  // Rare items on the home card: large image and value, or the item is removed if Rolimon's has no such item.
  const showRare = (rare) => {
    for (const row of document.querySelectorAll("[data-rare]")) {
      const item = rare.find((r) => r.name === row.dataset.rare);
      if (!item) {
        row.remove();
        continue;
      }
      const worth = item.value || item.rap || 0;
      set(row, "value", worth ? compact(worth) : "");
      const slot = row.querySelector(".float-img");
      if (slot && slot.tagName !== "IMG") {
        const img = document.createElement("img");
        img.className = "float-img";
        img.alt = "";
        img.decoding = "async";
        img.src = `/api/item/${item.id}`;
        img.addEventListener("error", () => img.replaceWith(slot), { once: true });
        slot.replaceWith(img);
      }
    }
  };

  // Example trade list: current names from Roblox; avatars that fail keep a neutral circle.
  document.querySelectorAll(".tl-av").forEach((img) => {
    const blank = () => img.removeAttribute("src");
    if (img.complete && img.naturalWidth === 0) blank();
    else img.addEventListener("error", blank, { once: true });
  });
  if (document.querySelector("[data-trader]")) {
    fetch("/api/traders", { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        for (const t of (data && data.traders) || []) {
          const row = document.querySelector(`[data-trader="${t.id}"]`);
          if (!row) continue;
          set(row, "display", t.displayName);
          set(row, "user", `@${t.name}`);
        }
      })
      .catch(() => {});
  }

  fetch("/api/values", { headers: { accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      if (!data || !Array.isArray(data.items)) return;
      let total = 0;
      for (const item of data.items) {
        const worth = item.value || item.rap || 0;
        total += worth;
        for (const row of document.querySelectorAll(`[data-id="${item.id}"]`)) {
          set(row, "value", worth ? compact(worth) : "No value");
          set(row, "usd", worth ? estimate(worth) : "");
          set(row, "rap", item.rap ? `RAP ${whole.format(item.rap)}` : "No RAP");
          set(row, "demand", DEMAND[item.demand] ? `${DEMAND[item.demand]} demand` : "Demand unrated");
        }
      }
      showRare(Array.isArray(data.rare) ? data.rare : []);

      const totalValue = document.getElementById("total-value");
      const totalUsd = document.getElementById("total-usd");
      if (totalValue) totalValue.textContent = whole.format(total);
      if (totalUsd) totalUsd.textContent = estimate(total);

      const time = new Date(data.updated);
      const clock = Number.isNaN(time.getTime())
        ? ""
        : time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const status = document.getElementById("status");
      const statusText = document.getElementById("status-text");
      if (status) status.dataset.state = "live";
      if (statusText) statusText.textContent = clock ? `Live · ${clock}` : "Live";
    })
    .catch(() => {
      // The snapshot figures already in the page stay in place.
    });
})();
