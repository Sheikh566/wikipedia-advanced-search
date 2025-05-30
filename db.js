const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool
  .connect()
  .then(client => {
    console.log('Connected to database');
    client.release();
  })
  .catch(err => console.error('Database connection error', err.stack));

/**
 * Search the wikipedia table for matching text using LIKE and pagination
 * @param {string} q - search query
 * @param {number} limit - number of records to return
 * @param {number} offset - offset for pagination
 * @returns {{ rows: Array, totalCount: number }}
 */
async function searchWikipedia(q, limit, offset) {
  const likePattern = `%${q}%`;
  const dataPromise = pool.query(
    `SELECT id, url, title, 'ABC' as text
     FROM public."wikipedia"
     WHERE "title" LIKE $1 LIMIT $2 OFFSET $3
    ;`,
    [likePattern, limit, offset]
  );
  const countPromise = pool.query(
    'SELECT COUNT(*) FROM public."wikipedia" WHERE "title" LIKE $1',
    [likePattern]
  );
  const [dataRes, countRes] = await Promise.all([dataPromise, countPromise]);
  return {
    rows: dataRes.rows,
    totalCount: parseInt(countRes.rows[0].count, 10)
  };
}

module.exports = { searchWikipedia };
