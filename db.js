import dotenv from 'dotenv';
import pkg from 'pg';
dotenv.config();

const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

/* ---------- schema ---------- */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      coins        INTEGER NOT NULL DEFAULT 1000,
      last_bonus   TIMESTAMP
    );
  `);
  console.log('DB ready');
}

/* ---------- helpers ---------- */
export async function getUser(id) {
  const q = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return q.rows[0] || null;
}

export async function getUserByName(username) {
  const q = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return q.rows[0] || null;
}

export async function createUser(username) {
  const q = await pool.query(
    'INSERT INTO users (username) VALUES ($1) RETURNING *',
    [username]
  );
  return q.rows[0];
}

export async function createOrGetUser(username) {
  return (await getUserByName(username)) || (await createUser(username));
}

export async function updateUserCoins(id, delta) {
  const q = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING *',
    [delta, id]
  );
  return q.rows[0];
}

export async function applyDailyBonus(id, bonus = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    const u = q.rows[0];
    if (!u) { await client.query('ROLLBACK'); return { awarded: false, user: null }; }

    const now = Date.now();
    const last = u.last_bonus ? new Date(u.last_bonus).getTime() : 0;
    if (now - last < 86_400_000) { await client.query('ROLLBACK'); return { awarded: false, user: u }; }

    const upd = await client.query(
      'UPDATE users SET coins = coins + $1, last_bonus = NOW() WHERE id = $2 RETURNING *',
      [bonus, id]
    );
    await client.query('COMMIT');
    return { awarded: true, user: upd.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function getLeaderboard(limit = 10) {
  const q = await pool.query(
    'SELECT username, coins FROM users ORDER BY coins DESC LIMIT $1',
    [limit]
  );
  return q.rows;
}
