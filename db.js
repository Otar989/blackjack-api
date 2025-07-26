import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      coins INTEGER NOT NULL DEFAULT 1000,
      last_bonus TIMESTAMP
    )
  `);
  console.log('DB ready');
}

export async function getUserByTelegramId(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function createUser(id, username, coins = 1000) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, coins)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO NOTHING
     RETURNING *`,
    [id, username, coins]
  );
  return rows[0] || (await getUserByTelegramId(id));
}

export async function createOrGetUser(id, username = 'Anon') {
  const existing = await getUserByTelegramId(id);
  if (existing) return existing.coins === 0 ? await updateUserCoins(id, 1000) : existing;
  return createUser(id, username, 1000);
}

export async function updateUserCoins(id, delta) {
  const { rows } = await pool.query(
    'UPDATE users SET coins = GREATEST(coins + $1, 0) WHERE telegram_id = $2 RETURNING *',
    [delta, id]
  );
  return rows[0];
}

export async function applyDailyBonus(id, bonus = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
      [id]
    );
    const user = rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return { awarded: false, user: null };
    }
    const last = user.last_bonus ? new Date(user.last_bonus) : null;
    const now = new Date();
    if (last && now - last < 24 * 60 * 60 * 1000) {
      await client.query('ROLLBACK');
      return { awarded: false, user };
    }
    const { rows: updated } = await client.query(
      `UPDATE users
       SET coins = coins + $1, last_bonus = NOW()
       WHERE telegram_id = $2
       RETURNING *`,
      [bonus, id]
    );
    await client.query('COMMIT');
    return { awarded: true, user: updated[0] };
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

export { pool };
