const Diff = require("diff");

/**
 * Generate a compact unified diff patch between oldContent and newContent.
 * Falls back to a simple summary if diff is too large.
 */
function generateDiff(oldContent = "", newContent = "") {
  try {
    const patch = Diff.createPatch("content", oldContent, newContent, "", "");
    // Keep patch under 2KB to avoid bloating the revision_history entries
    if (patch.length > 2048) {
      const added = (newContent.match(/\n/g) || []).length;
      const removed = (oldContent.match(/\n/g) || []).length;
      return `[Diff truncated] ~${removed} lines before, ~${added} lines after`;
    }
    return patch;
  } catch {
    return "Content updated";
  }
}

module.exports = { generateDiff };
