require("dotenv").config();
const { getDb } = require("../src/db");

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAGS_POOL = [
  "mongodb", "api-design", "backend", "nodejs", "python", "docker",
  "kubernetes", "database", "performance", "security", "caching",
  "microservices", "rest", "graphql", "authentication", "authorization",
  "testing", "devops", "ci-cd", "cloud", "aws", "gcp", "azure",
  "schema-design", "indexing", "aggregation", "replication", "sharding",
];

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "mongodb", "database",
  "query", "index", "aggregation", "document", "collection", "schema", "data",
  "api", "backend", "server", "client", "request", "response", "endpoint",
  "guide", "tutorial", "example", "implementation", "performance", "scale",
  "distributed", "cluster", "replica", "shard", "atlas", "compass", "driver",
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function generateWords(count) {
  return Array.from({ length: count }, () => LOREM_WORDS[rand(0, LOREM_WORDS.length - 1)]);
}

function generateContent(paragraphs = 5) {
  let md = "";
  for (let i = 0; i < paragraphs; i++) {
    const sentences = rand(3, 7);
    const para = Array.from({ length: sentences }, () => {
      const words = generateWords(rand(8, 20));
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      return words.join(" ") + ".";
    }).join(" ");
    md += `\n\n${para}`;
  }
  return md.trim();
}

function generateSlug(title, index) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) + `-${index}`
  );
}

function buildDocument(index, useOldSchema = false) {
  const titleWords = generateWords(rand(3, 8));
  titleWords[0] = titleWords[0].charAt(0).toUpperCase() + titleWords[0].slice(1);
  const title = titleWords.join(" ");
  const slug = generateSlug(title, index);
  const content = generateContent(rand(3, 8));
  const tags = pickRandom(TAGS_POOL, rand(2, 6));
  const version = rand(1, 20);
  const now = new Date(Date.now() - rand(0, 365 * 24 * 60 * 60 * 1000));
  const authorId = `user-${rand(1, 50)}`;
  const authorName = pickRandom(["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Hank"], 1)[0];
  const authorEmail = `${authorName.toLowerCase()}@example.com`;

  // Build revision history (up to min(version, 20) entries)
  const historyCount = Math.min(version, 20);
  const revision_history = Array.from({ length: historyCount }, (_, i) => ({
    version: version - historyCount + i + 1,
    updatedAt: new Date(now.getTime() + i * 60000),
    authorId: `user-${rand(1, 50)}`,
    contentDiff: `[Edit ${i + 1}] Updated content for version ${version - historyCount + i + 1}`,
  }));

  const author = useOldSchema
    ? authorName // OLD schema: plain string
    : { id: authorId, name: authorName, email: authorEmail }; // NEW schema: object

  return {
    slug,
    title,
    content,
    version,
    tags,
    metadata: {
      author,
      createdAt: now,
      updatedAt: now,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    },
    revision_history,
  };
}

// ── Main seeder ───────────────────────────────────────────────────────────────

async function runSeeder() {
  const db = getDb();
  const col = db.collection("documents");

  const count = await col.countDocuments();
  if (count >= 1000) {
    console.log(`[Seeder] Collection already has ${count} documents. Skipping seed.`);
    return;
  }

  console.log("[Seeder] Starting data seed...");

  // Create indexes
  await col.createIndex({ slug: 1 }, { unique: true });
  await col.createIndex({ title: "text", content: "text" });
  console.log("[Seeder] Indexes created.");

  const TOTAL = 10000;
  const BATCH_SIZE = 500;
  const OLD_SCHEMA_RATIO = 0.1; // ~10% use old string author

  let inserted = 0;

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL; j++) {
      const useOld = Math.random() < OLD_SCHEMA_RATIO;
      batch.push(buildDocument(i + j, useOld));
    }

    try {
      const result = await col.insertMany(batch, { ordered: false });
      inserted += result.insertedCount;
    } catch (err) {
      // Duplicate key errors on slug – count successful inserts
      inserted += err.result?.nInserted || 0;
    }

    process.stdout.write(`\r[Seeder] Inserted ${inserted}/${TOTAL} documents...`);
  }

  console.log(`\n[Seeder] Done. Total documents inserted: ${inserted}`);
}

module.exports = { runSeeder };

// Allow running directly: node seed/seeder.js
if (require.main === module) {
  const { connect } = require("../src/db");
  connect()
    .then(() => runSeeder())
    .then(() => {
      console.log("[Seeder] Standalone run complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seeder] Error:", err);
      process.exit(1);
    });
}
