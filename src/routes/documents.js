const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const { generateUniqueSlug } = require("../utils/slug");
const { transformAuthorSchema } = require("../utils/schemaTransform");
const { generateDiff } = require("../utils/diff");

// ──────────────────────────────────────────────
// POST /api/documents  – Create a new document
// ──────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { title, content, tags = [], authorName = "Anonymous", authorEmail = null, authorId = null } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const slug = await generateUniqueSlug(title);
    const now = new Date();

    const doc = {
      slug,
      title,
      content,
      version: 1,
      tags: Array.isArray(tags) ? tags : [],
      metadata: {
        author: {
          id: authorId,
          name: authorName,
          email: authorEmail,
        },
        createdAt: now,
        updatedAt: now,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      },
      revision_history: [
        {
          version: 1,
          updatedAt: now,
          authorId: authorId,
          contentDiff: "[Initial version]",
        },
      ],
    };

    const db = getDb();
    const result = await db.collection("documents").insertOne(doc);

    return res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    console.error("[POST /documents]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────
// GET /api/documents/:slug  – Fetch a document
// ──────────────────────────────────────────────
router.get("/:slug", async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("documents").findOne({ slug: req.params.slug });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Phase 6: Lazy on-read schema migration
    const transformed = transformAuthorSchema(doc);

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("[GET /documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────
// PUT /api/documents/:slug  – Update with OCC
// ──────────────────────────────────────────────
router.put("/:slug", async (req, res) => {
  try {
    const { title, content, tags, version: expectedVersion } = req.body;

    if (expectedVersion === undefined || expectedVersion === null) {
      return res.status(400).json({ error: "version is required for updates" });
    }

    const db = getDb();
    const col = db.collection("documents");

    // Fetch current doc to build diff
    const current = await col.findOne({ slug: req.params.slug });
    if (!current) {
      return res.status(404).json({ error: "Document not found" });
    }

    const now = new Date();
    const newVersion = Number(expectedVersion) + 1;
    const contentDiff = generateDiff(current.content || "", content || current.content);

    const revisionEntry = {
      version: newVersion,
      updatedAt: now,
      authorId: current.metadata?.author?.id || null,
      contentDiff,
    };

    const updateFields = {
      "metadata.updatedAt": now,
    };
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) {
      updateFields.content = content;
      updateFields["metadata.wordCount"] = content.split(/\s+/).filter(Boolean).length;
    }
    if (tags !== undefined) updateFields.tags = tags;

    const updated = await col.findOneAndUpdate(
      { slug: req.params.slug, version: Number(expectedVersion) },
      {
        $set: updateFields,
        $inc: { version: 1 },
        $push: {
          revision_history: {
            $each: [revisionEntry],
            $slice: -20,
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      // Version mismatch – return latest doc with 409
      const latest = await col.findOne({ slug: req.params.slug });
      return res.status(409).json({
        error: "Version conflict. The document has been modified by another user.",
        latestDocument: transformAuthorSchema(latest),
      });
    }

    return res.status(200).json(transformAuthorSchema(updated));
  } catch (err) {
    console.error("[PUT /documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/documents/:slug
// ──────────────────────────────────────────────
router.delete("/:slug", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("documents").deleteOne({ slug: req.params.slug });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.status(200).json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("[DELETE /documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
