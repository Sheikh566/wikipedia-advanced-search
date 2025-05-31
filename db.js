const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool
  .connect()
  .then((client) => {
    console.log("Connected to database");
    client.release();
  })
  .catch((err) => console.error("Database connection error", err.stack));

/**
 * Search the wikipedia table for matching text using full-text search.
 * @param {string} q - search query
 * @param {number} limit - number of records to return
 * @param {number} offset - offset for pagination
 * @param {string} words - must include these words (ANDed)
 * @param {string} exact - must include this exact phrase (using <-> operator)
 * @param {string} exclude - words to exclude (NOTed)
 * @param {string} oneof - one of these words (ORed)
 * @returns {Promise<{ rows: Array, totalCount: number }>}
 */
async function searchWikipedia(
  q,
  limit,
  offset,
  words = "",
  exact = "",
  exclude = "",
  oneof = ""
) {
  // Return no results if all inputs are empty
  if (![q, words, exact, oneof].some((s) => s.trim())) {
    return { rows: [], totalCount: 0 };
  }

  const parts = [];
  // Main query terms (ANDed)
  if (q.trim()) {
    const terms = q.trim().split(/\s+/).join(' & ');
    parts.push(`(${terms})`);
  }
  // 'words' list (comma-separated, ANDed)
  if (words.trim()) {
    const list = words.split(',').map((w) => w.trim()).filter(Boolean);
    if (list.length) parts.push(`(${list.join(' & ')})`);
  }
  // Exact phrase matching using <-> operator
  if (exact.trim()) {
    const phraseTerms = exact.trim().split(/\s+/);
    if (phraseTerms.length) {
      parts.push(`(${phraseTerms.join(' <-> ')})`);
    }
  }
  // 'oneof' list (comma-separated, ORed)
  if (oneof.trim()) {
    const list = oneof.split(',').map((w) => w.trim()).filter(Boolean);
    if (list.length) parts.push(`(${list.join(' | ')})`);
  }
  // Exclusions (comma-separated, each prefixed with NOT)
  if (exclude.trim()) {
    const list = exclude.split(',').map((w) => w.trim()).filter(Boolean);
    list.forEach((w) => parts.push(`(!${w})`));
  }

  // Combine all parts with AND
  const tsQuery = parts.join(' & ');

  // Uncomment to see the structure of query
  // console.log("Generated tsquery:", tsQuery);

  const dataPromise = pool.query(
    `SELECT id, url, title,
       ts_headline('english', text, to_tsquery('english', $1)) AS text,
       ts_rank(vector, to_tsquery('english', $1)) AS rank
     FROM wikipedia
     WHERE vector @@ to_tsquery('english', $1)
     ORDER BY rank DESC
     LIMIT $2 OFFSET $3;`,
    [tsQuery, limit, offset]
  );
  
  const countPromise = pool.query(
    `SELECT COUNT(*) FROM wikipedia
     WHERE vector @@ to_tsquery('english', $1);`,
    [tsQuery]
  );
  const [dataRes, countRes] = await Promise.all([dataPromise, countPromise]);
  return {
    rows: dataRes.rows,
    totalCount: +countRes.rows[0].count,
  };
}

module.exports = { searchWikipedia };
