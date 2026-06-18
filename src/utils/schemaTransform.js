/**
 * Lazy schema migration for author field.
 * If metadata.author is a string (old schema), transform to object (new schema).
 */
function transformAuthorSchema(doc) {
  if (!doc || !doc.metadata) return doc;

  if (typeof doc.metadata.author === "string") {
    doc.metadata.author = {
      id: null,
      name: doc.metadata.author,
      email: null,
    };
  }

  return doc;
}

module.exports = { transformAuthorSchema };
