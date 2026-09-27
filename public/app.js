// Replaces the snapshot figures in the example offer with current Rolimon's values
// from /api/values, served and cached by this site's own Worker.
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

  fetch("/api/values", { headers: { accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      if (!data || !Array.isArray(data.items)) return;
      let total = 0;
      for (const item of data.items) {
        const row = document.querySelector(`.offer-row[data-id="${item.id}"]`);
        if (!row) continue;
        const worth = item.value || item.rap || 0;
        total += worth;
        set(row, "value", worth ? compact(worth) : "No value");
        set(row, "usd", worth ? estimate(worth) : "");
        set(row, "rap", item.rap ? `RAP ${whole.format(item.rap)}` : "No RAP");
        set(row, "demand", DEMAND[item.demand] ? `${DEMAND[item.demand]} demand` : "Demand unrated");
      }
      document.getElementById("total-value").textContent = whole.format(total);
      document.getElementById("total-usd").textContent = estimate(total);

      const time = new Date(data.updated);
      const clock = Number.isNaN(time.getTime())
        ? ""
        : time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      document.getElementById("status").dataset.state = "live";
      document.getElementById("status-text").textContent = clock ? `Live · ${clock}` : "Live";
    })
    .catch(() => {
      // The snapshot figures already in the page stay in place.
    });
})();
