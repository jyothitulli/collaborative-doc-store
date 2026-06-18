require("dotenv").config();
const express = require("express");
const { connect } = require("./db");
const { runSeeder } = require("../seed/seeder");

const documentsRouter = require("./routes/documents");
const searchRouter = require("./routes/search");
const analyticsRouter = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

// ── Health check ──────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

// ── API routes ────────────────────────────────
app.use("/api/documents", documentsRouter);
app.use("/api/search", searchRouter);
app.use("/api/analytics", analyticsRouter);

// ── 404 handler ───────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Route not found" }));

// ── Global error handler ──────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Startup ───────────────────────────────────
async function start() {
  try {
    await connect();
    await runSeeder();
    app.listen(PORT, () => {
      console.log(`[API] Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("[Startup] Fatal error:", err);
    process.exit(1);
  }
}

start();
