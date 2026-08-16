function colorForPct(pct) {
  if (pct < 40) return "var(--go)";
  if (pct < 75) return "var(--wait)";
  return "var(--stop)";
}

function timeAgoZ(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function renderZones(state) {
  const grid = document.getElementById("zone-grid");
  grid.innerHTML = state.zones
    .map((z) => {
      const pct = Math.round(z.pct);
      const color = colorForPct(pct);
      return `
      <div class="zone">
        <div class="zone-top">
          <div class="zone-name">${z.name}</div>
          <div class="zone-pct">${pct}%</div>
        </div>
        <div class="zone-bar"><div class="zone-bar-fill" style="width:${pct}%; background:${color};"></div></div>
        <div class="zone-caption">${pct < 40 ? "Plenty of seats" : pct < 75 ? "Filling up" : "Nearly full"}</div>
      </div>`;
    })
    .join("");

  document.getElementById("last-sync").textContent = `synced ${timeAgoZ(Date.now())}`;
}

onUpdate(renderZones);
renderZones(state);
startFeed();
setInterval(() => renderZones(state), 1000);
