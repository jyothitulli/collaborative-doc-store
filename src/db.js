const { MongoClient } = require("mongodb");

let client;
let db;

async function connect() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "collab_wiki";

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(dbName);
  console.log(`[DB] Connected to MongoDB: ${dbName}`);
  return db;
}

function getDb() {
  if (!db) throw new Error("Database not initialized. Call connect() first.");
  return db;
}

async function disconnect() {
  if (client) {
    await client.close();
    console.log("[DB] Disconnected from MongoDB");
  }
}

module.exports = { connect, getDb, disconnect };
