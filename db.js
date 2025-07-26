// backend/db.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

/* ---------- соединение с Postgres ---------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host    : process.env.PGHOST,
  port    : process.env.PGPORT ? +process.env.PGPORT : undefined,
  user    : process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
});

/* ---------- инициализация ---------- */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      telegram_id  BIGINT  NOT NULL UNIQUE,
      username     TEXT,
      coins        INTEGER NOT NULL DEFAULT 1000,
      last_bonus   TIMESTAMP
    )
  `);
  console.log('DB ready');
}

/* ---------- CRUD-помощники ---------- */
export async function getUserByTelegramId(id) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE telegram_id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUser(id, username, coins = 1000) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, coins)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, username, coins]
  );
  return rows[0];
}

/* обновить username, если он изменился */
export async function updateUsername(id, username) {
  const { rows } = await pool.query(
    `UPDATE users
       SET username = $1
     WHERE telegram_id = $2
       AND username <> $1
     RETURNING *`,
    [username, id]
  );
  return rows[0] || null;
}

/* создать либо вернуть пользователя (и при необходимости обновить имя) */
export async function createOrGetUser(id, username = 'Anon') {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, coins)
         VALUES ($1, $2, 1000)
     ON CONFLICT (telegram_id) DO UPDATE
         SET username = EXCLUDED.username
     RETURNING *`,
    [id, username]
  );
  return rows[0];
}

/* изменение баланса (delta может быть отрицательной) */
export async function updateUserCoins(id, delta) {
  const { rows } = await pool.query(
    `UPDATE users
       SET coins = coins + $1
     WHERE telegram_id = $2
     RETURNING *`,
    [delta, id]
  );
  return rows[0];
}

/* ежедневный бонус */
export async function applyDailyBonus(id, bonus = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
      [id]
    );
    const user = rows[0];
    if (!user) { await client.query('ROLLBACK'); return { awarded: false, user: null }; }

    const last = user.last_bonus ? new Date(user.last_bonus) : null;
    if (last && Date.now() - last.getTime() < 864e5) {
      await client.query('ROLLBACK');
      return { awarded: false, user };
    }

    const { rows: upd } = await client.query(
      `UPDATE users
         SET coins = coins + $1,
             last_bonus = NOW()
       WHERE telegram_id = $2
       RETURNING *`,
      [bonus, id]
    );

    await client.query('COMMIT');
    return { awarded: true, user: upd[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* топ-лист по монетам */
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

/* при необходимости — прямой доступ к pool */
export { pool };
