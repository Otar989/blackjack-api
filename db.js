// backend/db.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host:     process.env.PGHOST,
  port:     process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      telegram_id  BIGINT  NOT NULL UNIQUE,
      username     TEXT,
      coins        INTEGER NOT NULL DEFAULT 1000,
      last_bonus   TIMESTAMP
    );
  `);
  console.log('DB ready');
}

export async function getUserByTelegramId(id) {
  const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
  return res.rows[0] || null;
}

export async function createOrGetUser(id, username = 'Anon') {
  const res = await pool.query(
    `INSERT INTO users (telegram_id, username)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = EXCLUDED.username
     RETURNING *`,
    [id, username],
  );
  return res.rows[0];
}

export async function updateUserCoins(id, delta) {
  const res = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE telegram_id = $2 RETURNING *',
    [delta, id],
  );
  return res.rows[0];
}

export async function applyDailyBonus(id, bonus = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
      [id],
    );
    const user = rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return { awarded: false, user: null };
    }

    const last = user.last_bonus ? new Date(user.last_bonus) : null;
    if (last && Date.now() - last.getTime() < 24 * 60 * 60 * 1000) {
      await client.query('ROLLBACK');
      return { awarded: false, user };
    }

    const res = await client.query(
      `UPDATE users
         SET coins = coins + $1,
             last_bonus = NOW()
       WHERE telegram_id = $2
       RETURNING *`,
      [bonus, id],
    );
    await client.query('COMMIT');
    return { awarded: true, user: res.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getLeaderboard(limit = 10) {
  const res = await pool.query(
    `SELECT username, coins
       FROM users
   ORDER BY coins DESC
      LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export { pool };
