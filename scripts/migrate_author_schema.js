/**
 * Background Schema Migration Script
 * Converts documents where metadata.author is a plain string (old schema)
 * to the new object schema: { id, name, email }.
 *
 * Usage:
 *   node scripts/migrate_author_schema.js
 *
 * The script processes documents in batches using bulkWrite for efficiency.
 * It is safe to run multiple times (idempotent).
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DATABASE_NAME = process.env.DATABASE_NAME || "collab_wiki";
const BATCH_SIZE = 1000;

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  const col = db.collection("documents");

  console.log("[Migration] Connected to MongoDB.");
  console.log("[Migration] Scanning for documents with old author schema (string)...");

  // Count documents to migrate
  const totalToMigrate = await col.countDocuments({
    "metadata.author": { $type: "string" },
  });

  if (totalToMigrate === 0) {
    console.log("[Migration] No documents require migration. All done!");
    await client.close();
    return;
  }

  console.log(`[Migration] Found ${totalToMigrate} documents to migrate.`);

  let processed = 0;
  let cursor = col.find({ "metadata.author": { $type: "string" } }).batchSize(BATCH_SIZE);

  let batch = [];
  let batchNum = 0;

  for await (const doc of cursor) {
    const authorString = doc.metadata.author;

    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            "metadata.author": {
              id: null,
              name: authorString,
              email: null,
            },
          },
        },
      },
    });

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      const result = await col.bulkWrite(batch, { ordered: false });
      processed += result.modifiedCount;
      console.log(
        `[Migration] Batch ${batchNum}: modified ${result.modifiedCount} documents. Total: ${processed}/${totalToMigrate}`
      );
      batch = [];
    }
  }

  // Process remaining documents in the last partial batch
  if (batch.length > 0) {
    batchNum++;
    const result = await col.bulkWrite(batch, { ordered: false });
    processed += result.modifiedCount;
    console.log(
      `[Migration] Batch ${batchNum} (final): modified ${result.modifiedCount} documents. Total: ${processed}/${totalToMigrate}`
    );
  }

  console.log(`[Migration] Complete! ${processed} documents migrated successfully.`);
  await client.close();
}

migrate().catch((err) => {
  console.error("[Migration] Fatal error:", err);
  process.exit(1);
});
