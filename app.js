function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function render(state) {
  const free = state.seats.filter((s) => s.status === "free").length;
  const finishing = state.seats.filter((s) => s.status === "finishing").length;
  const taken = state.seats.filter((s) => s.status === "taken").length;

  document.getElementById("count-free").textContent = free;
  document.getElementById("count-finishing").textContent = finishing;
  document.getElementById("count-taken").textContent = taken;

  const lampGo = document.getElementById("lamp-go");
  const lampWait = document.getElementById("lamp-wait");
  const lampStop = document.getElementById("lamp-stop");
  const headline = document.getElementById("headline");

  [lampGo, lampWait, lampStop].forEach((l) => l.classList.remove("lit"));

  const total = state.seats.length;

  if (free >= 1 && free === total) {
    // every seat free
    lampGo.classList.add("lit");
    headline.textContent = "Seats are open";
  } else if (free >= 1 || finishing >= 1) {
    lampWait.classList.add("lit");
    headline.textContent = total === 1 ? "Taken, but may open soon" : "Almost full — one may open soon";
  } else {
    lampStop.classList.add("lit");
    headline.textContent = "Full right now";
  }

  const grid = document.getElementById("seat-grid");
  grid.innerHTML = state.seats
    .map(
      (seat) => `
    <div class="seat" data-status="${seat.status}">
      <div class="seat-id">${seat.id}</div>
      <div class="seat-icon">${ICONS[seat.status]}</div>
      <div class="seat-status">${seat.status === "finishing" ? "Wrapping up" : seat.status}</div>
      <div class="seat-meta">${timeAgo(seat.updatedAt)}</div>
    </div>`
    )
    .join("");

  document.getElementById("last-sync").textContent = `synced ${timeAgo(Date.now())}`;
}

onUpdate(render);
render(state);
startFeed();
setInterval(() => render(state), 1000); // keep "time ago" labels fresh
