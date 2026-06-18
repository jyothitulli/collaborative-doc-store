const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

// ──────────────────────────────────────────────
// GET /api/analytics/most-edited
// ──────────────────────────────────────────────
router.get("/most-edited", async (req, res) => {
  try {
    const db = getDb();

    const pipeline = [
      {
        $project: {
          title: 1,
          slug: 1,
          version: 1,
          editCount: { $size: "$revision_history" },
        },
      },
      { $sort: { editCount: -1 } },
      { $limit: 10 },
    ];

    const results = await db.collection("documents").aggregate(pipeline).toArray();
    return res.status(200).json(results);
  } catch (err) {
    console.error("[GET /analytics/most-edited]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────
// GET /api/analytics/tag-cooccurrence
// ──────────────────────────────────────────────
router.get("/tag-cooccurrence", async (req, res) => {
  try {
    const db = getDb();

    const pipeline = [
      // Only consider documents with at least 2 tags
      { $match: { "tags.1": { $exists: true } } },

      // Project just the tags array
      { $project: { tags: 1 } },

      // Unwind to get one doc per tag
      { $unwind: "$tags" },

      // Group tags back per document as an array
      {
        $group: {
          _id: "$_id",
          tags: { $push: "$tags" },
        },
      },

      // Unwind first element of each pair
      { $unwind: { path: "$tags", includeArrayIndex: "idx1" } },

      // Unwind second element of each pair
      { $unwind: { path: "$tags", includeArrayIndex: "idx2" } },

      // Keep only pairs where idx1 < idx2 to avoid duplicates and self-pairs
      {
        $match: {
          $expr: { $lt: ["$idx1", "$idx2"] },
        },
      },

      // Group by the sorted tag pair and count
      {
        $group: {
          _id: ["$tags"],
          count: { $sum: 1 },
        },
      },

      { $sort: { count: -1 } },
      { $limit: 100 },

      // Shape the output
      {
        $project: {
          _id: 0,
          tags: "$_id",
          count: 1,
        },
      },
    ];

    // The pipeline above has a subtle issue with the unwind-pair approach.
    // Use a cleaner $reduce + $concatArrays approach instead:
    const betterPipeline = [
      { $match: { "tags.1": { $exists: true } } },
      { $project: { tags: 1 } },
      // Create all unique pairs using two $unwinds with indices
      {
        $project: {
          pairs: {
            $reduce: {
              input: { $range: [0, { $size: "$tags" }] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: { $range: [{ $add: ["$$this", 1] }, { $size: "$tags" }] },
                      as: "j",
                      in: {
                        $cond: {
                          if: { $lt: [{ $arrayElemAt: ["$tags", "$$this"] }, { $arrayElemAt: ["$tags", "$$j"] }] },
                          then: [
                            { $arrayElemAt: ["$tags", "$$this"] },
                            { $arrayElemAt: ["$tags", "$$j"] },
                          ],
                          else: [
                            { $arrayElemAt: ["$tags", "$$j"] },
                            { $arrayElemAt: ["$tags", "$$this"] },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unwind: "$pairs" },
      {
        $group: {
          _id: "$pairs",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          tags: "$_id",
          count: 1,
        },
      },
    ];

    const results = await db.collection("documents").aggregate(betterPipeline).toArray();
    return res.status(200).json(results);
  } catch (err) {
    console.error("[GET /analytics/tag-cooccurrence]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
