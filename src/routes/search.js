const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const { transformAuthorSchema } = require("../utils/schemaTransform");

// ──────────────────────────────────────────────
// GET /api/search?q=<term>&tags=<t1>,<t2>
// ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { q, tags } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const db = getDb();

    // Build filter
    const filter = { $text: { $search: q.trim() } };

    if (tags) {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        filter.tags = { $all: tagList };
      }
    }

    const projection = { score: { $meta: "textScore" } };

    const results = await db
      .collection("documents")
      .find(filter, { projection })
      .sort({ score: { $meta: "textScore" } })
      .limit(50)
      .toArray();

    const transformed = results.map(transformAuthorSchema);

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("[GET /search]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
