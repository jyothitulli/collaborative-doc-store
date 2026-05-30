# Collaborative Document Store

A production-ready collaborative wiki backend using MongoDB, featuring:
- **Optimistic Concurrency Control (OCC)** for conflict-free collaborative editing
- **Full-Text Search** with relevance scoring and tag filtering
- **Analytics Aggregation Pipelines** (most-edited docs, tag co-occurrence)
- **Lazy + Background Schema Migration** strategy
- **Docker Compose** for one-command startup with 10,000+ seeded documents

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start all services (MongoDB + API)
docker-compose up --build

# API is now available at http://localhost:3000
```

## Environment Variables

See `.env.example` for all required variables:

| Variable        | Default                    | Description              |
|-----------------|----------------------------|--------------------------|
| `MONGO_URI`     | `mongodb://mongo:27017`    | MongoDB connection URI   |
| `DATABASE_NAME` | `collab_wiki`              | Database name            |
| `PORT`          | `3000`                     | API server port          |
| `NODE_ENV`      | `development`              | Node environment         |

## API Endpoints

### Documents

| Method | Endpoint                    | Description                      |
|--------|-----------------------------|----------------------------------|
| POST   | `/api/documents`            | Create a new document            |
| GET    | `/api/documents/:slug`      | Get a document by slug           |
| PUT    | `/api/documents/:slug`      | Update with Optimistic Concurrency Control |
| DELETE | `/api/documents/:slug`      | Delete a document                |

### Search

| Method | Endpoint       | Parameters              | Description                     |
|--------|----------------|-------------------------|---------------------------------|
| GET    | `/api/search`  | `q`, `tags` (optional)  | Full-text search with tag filter|

### Analytics

| Method | Endpoint                          | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/analytics/most-edited`      | Top 10 most-edited documents         |
| GET    | `/api/analytics/tag-cooccurrence` | Tag pair co-occurrence counts        |

## Example Requests

### Create a document
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with MongoDB",
    "content": "# MongoDB Guide\nMongoDB is a NoSQL database...",
    "tags": ["mongodb", "guide"],
    "authorName": "Jane Doe",
    "authorEmail": "jane@example.com"
  }'
```

### Update (OCC)
```bash
curl -X PUT http://localhost:3000/api/documents/getting-started-with-mongodb-0 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with MongoDB (Updated)",
    "content": "Updated content here...",
    "version": 1
  }'
```

### Search
```bash
curl "http://localhost:3000/api/search?q=mongodb&tags=guide"
```

### OCC Conflict (send stale version)
A `409 Conflict` response includes the latest document so the client can merge.

## Schema Migration

### Lazy On-Read
When `GET /api/documents/:slug` is called, any document with `metadata.author` as a plain string is automatically transformed to the new object schema in the response (without modifying the DB).

### Background Migration Script
Run the migration to update all old-schema documents in the database:
```bash
# Against local MongoDB
node scripts/migrate_author_schema.js

# Inside Docker
docker-compose exec api node scripts/migrate_author_schema.js
```

The script processes documents in batches of 1,000 using `bulkWrite` for efficiency.

## Data Model

```json
{
  "_id": "ObjectId",
  "slug": "my-document-slug",
  "title": "My Document Title",
  "content": "# Markdown content...",
  "version": 5,
  "tags": ["mongodb", "guide"],
  "metadata": {
    "author": {
      "id": "user-123",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "wordCount": 450
  },
  "revision_history": [
    {
      "version": 5,
      "updatedAt": "2024-01-15T00:00:00.000Z",
      "authorId": "user-123",
      "contentDiff": "..."
    }
  ]
}
```

> `revision_history` is capped at the last 20 entries using MongoDB's `$push + $slice`.
