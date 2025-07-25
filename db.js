import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Render иногда отдаёт только PG* переменные без DATABASE_URL — поддержим оба варианта.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  // На Render почти всегда нужна SSL. Если у тебя не работает без этого — оставь так.
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
});

/**
 * Инициализация БД: создаём таблицу users, если её нет.
 */
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

/**
 * Получить пользователя по telegram_id
 */
export async function getUserByTelegramId(telegramId) {
  const res = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return res.rows[0] || null;
}

/**
 * Создать пользователя (если точно знаем, что его ещё нет)
 */
export async function createUser(telegramId, username, coins = 1000) {
  const res = await pool.query(
    `INSERT INTO users (telegram_id, username, coins)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [telegramId, username, coins]
  );
  return res.rows[0];
}

/**
 * Создать пользователя, если его нет. Если есть — вернуть существующего.
 */
export async function createOrGetUser(telegramId, username = 'Anon') {
  const existing = await getUserByTelegramId(telegramId);
  if (existing) return existing;
  return await createUser(telegramId, username, 1000);
}

/**
 * Обновить баланс пользователя на delta (может быть отрицательной).
 * Вернёт обновлённую строку пользователя.
 */
export async function updateUserCoins(telegramId, delta) {
  const res = await pool.query(
    'UPDATE users SET coins = coins + $1 WHERE telegram_id = $2 RETURNING *',
    [delta, telegramId]
  );
  return res.rows[0];
}

/**
 * Ежедневный бонус (раз в 24 часа).
 * Возвращает { awarded: boolean, user }
 */
export async function applyDailyBonus(telegramId, bonusAmount = 100) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resSelect = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
      [telegramId]
    );
    const user = resSelect.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return { awarded: false, user: null };
    }

    const lastBonus = user.last_bonus ? new Date(user.last_bonus) : null;
    const now = new Date();

    if (lastBonus && now - lastBonus < 24 * 60 * 60 * 1000) {
      await client.query('ROLLBACK');
      return { awarded: false, user };
    }

    const resUpdate = await client.query(
      `UPDATE users
       SET coins = coins + $1, last_bonus = NOW()
       WHERE telegram_id = $2
       RETURNING *`,
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
 * Топ игроков по количеству монет.
 */
export async function getLeaderboard(limit = 10) {
  const res = await pool.query(
    `SELECT username, coins
     FROM users
     ORDER BY coins DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

// Если где-то захочешь использовать pool напрямую:
export { pool };
