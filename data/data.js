/* ===========================================================
   data.js — shared seat data source
   ---------------------------------------------------------
   This is the single place the hardware team's feed plugs in.
   Right now SOURCE_MODE is "mock" and generates fake button
   presses so the UI can be built/demoed without hardware.

   To go live once the ESP32 + backend are ready, swap
   SOURCE_MODE to "live" and set LIVE_ENDPOINT — see the
   fetchLiveSeats()/openLiveSocket() stubs below for the two
   options (polling vs websocket) and fill in whichever the
   backend actually exposes.
   =========================================================== */

const SOURCE_MODE = "mock"; // "mock" | "live"
const LIVE_ENDPOINT = "/api/seats";      // GET -> [{id,name,status,updatedAt}]
const LIVE_SOCKET   = "ws://localhost:8080/seats"; // optional, if backend pushes updates

// Seat catalogue — 1 button = 1 seat, 4 seats for this demo.
// Add more entries here (or fetch them from the backend) to scale up later.
const SEATS = [
  { id: "A1", name: "Seat A1" },
  { id: "A2", name: "Seat A2" },
  { id: "B1", name: "Seat B1" },
  { id: "B2", name: "Seat B2" },
];

// Library zones for the heatmap/busyness view.
// seatCount drives how many seats the zone-detail page simulates when clicked into.
const ZONES = [
  { id: "kate", name: "Kate Edgar Level 4", seatCount: 150 },
  { id: "gsl", name: "General Library", seatCount: 200 },
  { id: "eng", name: "Engineering", seatCount: 120 },
  { id: "law", name: "OGGB", seatCount: 180 },
];

const ICONS = {
  free: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 19v-7a6 6 0 0 1 12 0v7"/><path d="M4 19h16"/><path d="M6 19v2M18 19v2"/></svg>`,
  taken: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 19v-7a6 6 0 0 1 12 0v7"/><path d="M4 19h16"/><path d="M6 19v2M18 19v2"/><circle cx="12" cy="6" r="2.4" fill="currentColor" stroke="none"/></svg>`,
  finishing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 19v-7a6 6 0 0 1 12 0v7"/><path d="M4 19h16"/><path d="M6 19v2M18 19v2"/><path d="M12 9v3l2 1"/></svg>`,
  na: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 19v-7a6 6 0 0 1 12 0v7"/><path d="M4 19h16"/><path d="M6 19v2M18 19v2"/><path d="M4 4l16 16"/></svg>`,
};

// ---------- state ----------

const state = {
  seats: SEATS.map((s) => ({ ...s, status: "free", updatedAt: Date.now() })),
  zones: ZONES.map((z) => ({ ...z, pct: Math.floor(Math.random() * 40) })),
};

const listeners = [];
function onUpdate(fn) { listeners.push(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

// ---------- mock feed (stand-in for real button presses) ----------

function startMockFeed() {
  setInterval(() => {
    const seat = state.seats[Math.floor(Math.random() * state.seats.length)];
    const order = ["free", "taken", "finishing"];
    const next = order[(order.indexOf(seat.status) + 1) % order.length];
    seat.status = next;
    seat.updatedAt = Date.now();
    emit();
  }, 3200);

  setInterval(() => {
    state.zones.forEach((z) => {
      z.pct = Math.max(4, Math.min(96, z.pct + (Math.random() * 16 - 8)));
    });
    emit();
  }, 4000);
}

// ---------- live feed stubs (fill in when backend exists) ----------

async function fetchLiveSeats() {
  const res = await fetch(LIVE_ENDPOINT);
  const data = await res.json();
  state.seats = data;
  emit();
}

function openLiveSocket() {
  const ws = new WebSocket(LIVE_SOCKET);
  ws.onmessage = (evt) => {
    const update = JSON.parse(evt.data); // expect {id, status, updatedAt}
    const seat = state.seats.find((s) => s.id === update.id);
    if (seat) Object.assign(seat, update);
    emit();
  };
}

function startFeed() {
  if (SOURCE_MODE === "mock") {
    startMockFeed();
  } else {
    fetchLiveSeats();
    setInterval(fetchLiveSeats, 5000); // fallback polling
    try { openLiveSocket(); } catch (e) { /* socket optional */ }
  }
}

// ---------- zone-detail seat simulation ----------
// The 4 physical demo seats above are the real hardware. A full zone
// (e.g. 150 seats on Kate Edgar Level 4) isn't wired up seat-by-seat —
// this generates a plausible-looking seat map for that many seats so
// the zone-detail page can show the same traffic light + grid pattern
// at scale. Swap this out for real per-seat data if the zone ever gets
// fully instrumented.

function generateZoneSeats(zone) {
  const statuses = ["free", "taken", "taken", "finishing", "free", "taken"];
  const seats = [];
  for (let i = 1; i <= zone.seatCount; i++) {
    seats.push({
      id: `${zone.id.toUpperCase()}-${i}`,
      name: `Seat ${i}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      updatedAt: Date.now() - Math.floor(Math.random() * 120000),
    });
  }
  return seats;
}

function getZoneById(id) {
  return ZONES.find((z) => z.id === id);
}
