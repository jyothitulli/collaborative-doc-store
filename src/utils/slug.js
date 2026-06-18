const slugify = require("slugify");
const { getDb } = require("../db");

/**
 * Generate a unique slug from a title.
 * Appends a numeric suffix if the slug already exists.
 */
async function generateUniqueSlug(title) {
  const base = slugify(title, { lower: true, strict: true });
  const db = getDb();
  const col = db.collection("documents");

  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await col.findOne({ slug }, { projection: { _id: 1 } });
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
}

module.exports = { generateUniqueSlug };
