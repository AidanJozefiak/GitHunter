/**
 * GitHunter Backend - Express app
 * Routes: /api/user/:username, /api/analyze, /api/matchmaker
 * Requires: GITHUB_TOKEN (optional), REDIS_URL (optional, for cache)
 */

const express = require("express");
const cors = require("cors");
const { mountRoutes } = require("./routes");

const app = express();

app.use(express.json());
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:5500")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // no origin = curl, Postman, same-origin requests
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
}));

app.get("/api/health", (req, res) => {
  const { isRedisAvailable } = require("./utils/cache");
  const { isSlidesConfigured } = require("./config/env");
  res.json({ ok: true, redis: isRedisAvailable(), slides: isSlidesConfigured() });
});

app.set("trust proxy", 1);
mountRoutes(app);

module.exports = app;
