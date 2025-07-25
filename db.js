import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Create a connection pool.  When DATABASE_URL is set (e.g. on Render), use that.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/**
 * Fetch a user by Telegram ID.  If the user does not exist, return null.
 * @param {number} telegramId
 */
export async function getUserByTelegramId(telegramId) {
  const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return res.rows[0] || null;
}

/**
 * Create a new user with the given Telegram ID, username and initial coins.
 * Returns the created user row.
 * @param {number} telegramId
 * @param {string} username
 * @param {number} coins
 */
export async function createUser(telegramId, username, coins = 1000) {
  const res = await pool.query(
    'INSERT INTO users (telegram_id, username, coins) VALUES ($1, $2, $3) RETURNING *',
    [telegramId, username, coins]
  );
  return res.rows[0];
}

/**
 * Update a user's coin balance by adding delta.  Negative values decrease coins.  Returns the updated row.
 * @param {number} telegramId
 * @param {number} delta
 */
export async function updateUserCoins(telegramId, delta) {
  const res = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE telegram_id = $2 RETURNING *',
    [delta, telegramId]
  );
  return res.rows[0];
}

/**
 * Set the last_bonus timestamp to now and add the bonus to the user's coins.
 * Prevent multiple bonuses within 24 hours by checking the stored timestamp.
 * Returns an object { awarded: boolean, user: userRow }.
 * @param {number} telegramId
 * @param {number} bonusAmount
 */
export async function applyDailyBonus(telegramId, bonusAmount = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resSelect = await client.query('SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE', [telegramId]);
    const user = resSelect.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return { awarded: false, user: null };
    }
    const lastBonus = user.last_bonus;
    const now = new Date();
    // If last bonus exists and less than 24 hours ago, do not award.
    if (lastBonus && now - lastBonus < 24 * 60 * 60 * 1000) {
      await client.query('ROLLBACK');
      return { awarded: false, user };
    }
    const resUpdate = await client.query(
      'UPDATE users SET coins = coins + $1, last_bonus = NOW() WHERE telegram_id = $2 RETURNING *',
      [bonusAmount, telegramId]
    );
    await client.query('COMMIT');
    return { awarded: true, user: resUpdate.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get the top N users by coin balance.
 * @param {number} limit
 */
export async function getLeaderboard(limit = 10) {
  const res = await pool.query(
    'SELECT username, coins FROM users ORDER BY coins DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}

// ← Обязательно перенести на новую строку!

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL UNIQUE,
      username TEXT,
      coins INTEGER NOT NULL DEFAULT 1000,
      last_bonus TIMESTAMP
    )
  `);
  console.log('DB ready');
}
