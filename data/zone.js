function timeAgoZone(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

const params = new URLSearchParams(window.location.search);
const zoneId = params.get("id");
const zone = getZoneById(zoneId);

let zoneSeats = [];

function renderZone() {
  if (!zone) {
    document.getElementById("headline").textContent = "Zone not found";
    document.getElementById("zone-desc").textContent = "That zone doesn't exist. Go back and pick one from the busyness page.";
    return;
  }

  const free = zoneSeats.filter((s) => s.status === "free").length;
  const finishing = zoneSeats.filter((s) => s.status === "finishing").length;
  const taken = zoneSeats.filter((s) => s.status === "taken").length;
  const total = zoneSeats.length;

  document.getElementById("count-free").textContent = free;
  document.getElementById("count-finishing").textContent = finishing;
  document.getElementById("count-taken").textContent = taken;
  document.getElementById("zone-desc").textContent = `${zone.name} — ${total} tracked seats.`;

  const lampGo = document.getElementById("lamp-go");
  const lampWait = document.getElementById("lamp-wait");
  const lampStop = document.getElementById("lamp-stop");
  const headline = document.getElementById("headline");

  [lampGo, lampWait, lampStop].forEach((l) => l.classList.remove("lit"));

  const goThreshold = Math.max(1, Math.ceil(total * 0.15)); // >=15% free reads as "open"
  const waitThreshold = Math.max(1, Math.ceil(total * 0.05)); // <15% but some free/wrapping-up = "almost full"

  if (free >= goThreshold) {
    lampGo.classList.add("lit");
    headline.textContent = "Seats are open";
  } else if (free >= 1 || finishing >= waitThreshold) {
    lampWait.classList.add("lit");
    headline.textContent = "Almost full — a few may open soon";
  } else {
    lampStop.classList.add("lit");
    headline.textContent = "Full right now";
  }

  const grid = document.getElementById("seat-grid");
  grid.innerHTML = zoneSeats
    .map(
      (seat) => `
    <div class="seat" data-status="${seat.status}">
      <div class="seat-id">${seat.id}</div>
      <div class="seat-icon">${ICONS[seat.status]}</div>
      <div class="seat-status">${seat.status === "finishing" ? "Wrapping up" : seat.status}</div>
      <div class="seat-meta">${timeAgoZone(seat.updatedAt)}</div>
    </div>`
    )
    .join("");

  document.getElementById("last-sync").textContent = `synced ${timeAgoZone(Date.now())}`;
}

if (zone) {
  zoneSeats = generateZoneSeats(zone);
  renderZone();

  // lightweight simulated churn so the page doesn't look static
  setInterval(() => {
    const seat = zoneSeats[Math.floor(Math.random() * zoneSeats.length)];
    const order = ["free", "taken", "finishing"];
    seat.status = order[(order.indexOf(seat.status) + 1) % order.length];
    seat.updatedAt = Date.now();
    renderZone();
  }, 1500);
} else {
  renderZone();
}
