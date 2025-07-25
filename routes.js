import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createOrGetUser,      // если у тебя нет этой функции в db.js — напиши, пришлю код
  getUserByTelegramId,  // то же самое
  applyDailyBonus,
  getLeaderboard
} from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/**
 * Генерация JWT
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Middleware проверки JWT
 */
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * POST /auth
 * Тело: { telegram_id, username }
 * Создаёт пользователя с 1000 монет, если его нет, и отдаёт JWT.
 */
router.post('/auth', async (req, res) => {
  try {
    const { telegram_id, username } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const user = await createOrGetUser(telegram_id, username || 'Anon');
    const token = signToken({ telegram_id: user.telegram_id });

    res.json({
      token,
      user: {
        telegram_id: user.telegram_id,
        username: user.username,
        coins: user.coins,
        last_bonus: user.last_bonus
      }
    });
  } catch (err) {
    console.error('POST /auth error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /me
 * Заголовок: Authorization: Bearer <token>
 */
router.get('/me', auth, async (req, res) => {
  try {
    const { telegram_id } = req.user;
    const user = await getUserByTelegramId(telegram_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      telegram_id: user.telegram_id,
      username: user.username,
      coins: user.coins,
      last_bonus: user.last_bonus
    });
  } catch (err) {
    console.error('GET /me error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /bonus
 * Выдаёт ежедневный бонус (если прошло 24 часа).
 */
router.post('/bonus', auth, async (req, res) => {
  try {
    const { telegram_id } = req.user;
    const result = await applyDailyBonus(telegram_id, 100); // 100 монет бонуса
    res.json(result);
  } catch (err) {
    console.error('POST /bonus error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const rows = await getLeaderboard(limit);
    res.json(rows);
  } catch (err) {
    console.error('GET /leaderboard error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
