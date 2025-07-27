import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host    : process.env.PGHOST,
  port    : process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user    : process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl     : process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      username  TEXT    NOT NULL UNIQUE,
      coins     INTEGER NOT NULL DEFAULT 1000,
      last_bonus TIMESTAMP
    )
  `);
  console.log('DB ready');
}

export async function getUser(username) {
  const r = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return r.rows[0] || null;
}

export async function createUser(username) {
  const r = await pool.query(
    'INSERT INTO users (username) VALUES ($1) RETURNING *',
    [username]
  );
  return r.rows[0];
}

export async function createOrGetUser(username) {
  const u = await getUser(username);
  return u ?? createUser(username);
}

export async function updateUserCoins(username, delta) {
  const r = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE username = $2 RETURNING *',
    [delta, username]
  );
  return r.rows[0];
}

export async function applyDailyBonus(username, amount = 100) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const sel = await c.query('SELECT * FROM users WHERE username = $1 FOR UPDATE', [username]);
    const user = sel.rows[0];
    if (!user) { await c.query('ROLLBACK'); return { awarded: false, user: null }; }

    const last = user.last_bonus ? new Date(user.last_bonus) : null;
    const now  = new Date();
    if (last && now - last < 86_400_000) { await c.query('ROLLBACK'); return { awarded: false, user }; }

    const upd = await c.query(
      'UPDATE users SET coins = coins + $1, last_bonus = NOW() WHERE username = $2 RETURNING *',
      [amount, username]
    );
    await c.query('COMMIT');
    return { awarded: true, user: upd.rows[0] };
  } catch (e) {
    await c.query('ROLLBACK'); throw e;
  } finally { c.release(); }
}

export async function getLeaderboard(limit = 10) {
  const r = await pool.query(
    'SELECT username, coins FROM users ORDER BY coins DESC LIMIT $1',
    [limit]
  );
  return r.rows;
}

export { pool };
