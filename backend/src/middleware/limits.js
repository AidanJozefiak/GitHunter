const rateLimit = require("express-rate-limit");
const { getClient, isRedisAvailable } = require("../utils/cache");

/** Max 3 analyses per IP per hour. */
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Rate limit reached — 3 analyses per hour. Browse the pre-analyzed profiles instead.",
  },
});

const DAILY_MAX = parseInt(process.env.DAILY_ANALYSIS_CAP || "40", 10);

/** Global daily cap on new analyses. Bounds worst-case cost regardless of traffic source. */
async function dailyCap(req, res, next) {
  if (!isRedisAvailable()) return next();
  try {
    const key = `analyses:${new Date().toISOString().slice(0, 10)}`;
    const count = await getClient().incr(key);
    if (count === 1) await getClient().expire(key, 172800); // 48h
    if (count > DAILY_MAX) {
      return res.status(429).json({
        error: "Daily analysis limit reached. Browse the pre-analyzed profiles instead.",
      });
    }
  } catch (err) {
    console.error("[Limits] dailyCap error:", err?.message);
  }
  return next();
}

module.exports = { analyzeLimiter, dailyCap };
