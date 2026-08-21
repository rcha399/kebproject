const express = require("express");
const { WebSocketServer } = require("ws");
const app = express();
app.use(express.json());
app.use(express.static("kebproject-main")); // serves the website too

let seats = {
  A1: { id: "A1", name: "Seat A1", status: "free", updatedAt: Date.now() },
  A2: { id: "A2", name: "Seat A2", status: "free", updatedAt: Date.now() },
  B1: { id: "B1", name: "Seat B1", status: "free", updatedAt: Date.now() },
  B2: { id: "B2", name: "Seat B2", status: "free", updatedAt: Date.now() },
};

app.get("/api/seats", (req, res) => res.json(Object.values(seats)));

app.post("/api/seats/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!seats[id]) return res.status(404).end();
  seats[id] = { ...seats[id], status, updatedAt: Date.now() };
  broadcast(seats[id]);
  res.json(seats[id]);
});

const server = app.listen(3000, () => console.log("Running on :3000"));
const wss = new WebSocketServer({ server, path: "/ws" });
function broadcast(update) {
  wss.clients.forEach((c) => c.readyState === 1 && c.send(JSON.stringify(update)));
}