// backend/db.js
import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host     : process.env.PGHOST,
  port     : process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user     : process.env.PGUSER,
  password : process.env.PGPASSWORD,
  database : process.env.PGDATABASE,
  ssl      : process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

/* ---------- schema init ---------- */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,           -- теперь может быть NULL
      username TEXT NOT NULL,
      coins    INTEGER NOT NULL DEFAULT 1000,
      last_bonus TIMESTAMP
    );
  `);
  console.log('DB ready');
}

/* ---------- helpers ---------- */
export async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/* >>>  ВОССТАНАВЛИВАЕМ <<< */
export async function getUserByTelegramId(tid) {
  if (!tid) return null;
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [tid]);
  return rows[0] || null;
}

export async function createUser({ telegram_id = null, username, coins = 1000 }) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, coins)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [telegram_id, username, coins]
  );
  return rows[0];
}

export async function createOrGetUser(telegram_id, username = 'Anon') {
  if (telegram_id) {
    const existed = await getUserByTelegramId(telegram_id);
    if (existed) return existed;
  }
  return await createUser({ telegram_id, username });
}

export async function updateUserCoins(idOrTid, delta, byTelegram = false) {
  const field = byTelegram ? 'telegram_id' : 'id';
  const { rows } = await pool.query(
    `UPDATE users SET coins = coins + $1 WHERE ${field} = $2 RETURNING *`,
    [delta, idOrTid]
  );
  return rows[0];
}

export async function applyDailyBonus(idOrTid, bonus = 100, byTelegram = false) {
  const client = await pool.connect();
  const field = byTelegram ? 'telegram_id' : 'id';

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM users WHERE ${field} = $1 FOR UPDATE`, [idOrTid]
    );
    const user = rows[0];
    if (!user) { await client.query('ROLLBACK'); return { awarded:false,user:null }; }

    const now = Date.now();
    if (user.last_bonus && now - new Date(user.last_bonus).getTime() < 86_400_000) {
      await client.query('ROLLBACK');
      return { awarded:false,user };
    }

    const { rows: up } = await client.query(
      `UPDATE users SET coins = coins + $1, last_bonus = NOW()
       WHERE ${field} = $2 RETURNING *`,
      [bonus, idOrTid]
    );
    await client.query('COMMIT');
    return { awarded:true,user:up[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getLeaderboard(limit = 10) {
  const { rows } = await pool.query(
    `SELECT username, coins FROM users ORDER BY coins DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
