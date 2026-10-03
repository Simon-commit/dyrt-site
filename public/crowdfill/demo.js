// The tendency example on the Crowdfill page. It uses the calculation the extension uses for an
// ordered scale: a bell around the chosen answer that narrows as the strength goes up.
(() => {
  "use strict";

  const root = document.querySelector("[data-lean]");
  if (!root) return;
  const cols = [...root.querySelectorAll(".lean-col")];
  const target = root.querySelector("[data-lean-target]");
  const strength = root.querySelector("[data-lean-strength]");
  const set = (field, text) => {
    const el = root.querySelector(`[data-f="${field}"]`);
    if (el) el.textContent = text;
  };

  const weights = (n, centre, percent) => {
    const s = percent / 100;
    if (s === 0) return Array(n).fill(1 / n);
    const sigma = 0.25 + n * 0.9 * (1 - s) ** 1.6;
    const raw = Array.from({ length: n }, (_, i) => Math.exp(-((i - centre) ** 2) / (2 * sigma * sigma)));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map((w) => w / total);
  };

  // Whole percentages that still add up to 100.
  const percentages = (shares) => {
    const exact = shares.map((p) => p * 100);
    const out = exact.map(Math.floor);
    const order = exact.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0, left = 100 - out.reduce((a, b) => a + b, 0); k < left; k++) out[order[k][1]]++;
    return out;
  };

  const draw = () => {
    const pick = Number(target.value);
    const shares = weights(cols.length, pick - 1, Number(strength.value));
    const tallest = Math.max(...shares);
    const whole = percentages(shares);
    cols.forEach((col, i) => {
      col.style.setProperty("--h", (shares[i] / tallest).toFixed(4));
      col.classList.toggle("is-target", i === pick - 1);
      col.querySelector('[data-f="share"]').textContent = `${whole[i]}%`;
    });
    const average = shares.reduce((sum, p, i) => sum + p * (i + 1), 0);
    set("average", `Average ${average.toFixed(1)}`);
    set("target", String(pick));
    set("strength", `${strength.value}%`);
  };

  target.addEventListener("input", draw);
  strength.addEventListener("input", draw);
  draw();
  root.classList.add("is-ready");
})();
