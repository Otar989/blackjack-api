// backend/db.js
import pkg   from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

/** ────────────────  соединение ──────────────── */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host    : process.env.PGHOST,
  port    : process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user    : process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl     : process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized:false },
});

/** ────────────────  модели ──────────────── */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      coins    INTEGER      NOT NULL DEFAULT 1000,
      last_bonus TIMESTAMP
    )
  `);
  console.log('DB ready');
}

export async function getUser(username) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

export async function createUser(username, coins = 1000) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, coins)
     VALUES ($1, $2) RETURNING *`,
    [username, coins]
  );
  return rows[0];
}

export async function createOrGetUser(username) {
  return (await getUser(username)) || (await createUser(username));
}

export async function updateUserCoins(username, delta) {
  const { rows } = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE username = $2 RETURNING *',
    [delta, username]
  );
  return rows[0];
}

/** daily bonus ― not more often than once per 24 h */
export async function applyDailyBonus(username, bonus = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM users WHERE username = $1 FOR UPDATE',
      [username]
    );
    const user = rows[0];
    if (!user) { await client.query('ROLLBACK'); return { awarded:false, user:null }; }

    const last = user.last_bonus ? new Date(user.last_bonus) : null;
    if (last && Date.now() - last.getTime() < 86_400_000) {
      await client.query('ROLLBACK');
      return { awarded:false, user };
    }

    const { rows: up } = await client.query(
      `UPDATE users
       SET coins = coins + $1, last_bonus = NOW()
       WHERE username = $2 RETURNING *`,
      [bonus, username]
    );
    await client.query('COMMIT');
    return { awarded:true, user: up[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getLeaderboard(limit = 10) {
  const { rows } = await pool.query(
    `SELECT username, coins
     FROM users
     ORDER BY coins DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
