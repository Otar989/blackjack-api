// routes.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createOrGetUser,
  getUserByTelegramId,
  applyDailyBonus,
  getLeaderboard,
  updateUserCoins,
} from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/* ------------------------------------------------------------------ */
/* JWT flow                                                           */
/* ------------------------------------------------------------------ */

/**
 * POST /api/auth
 * Body: { telegram_id, username }
 * Создаёт пользователя (если нет) и возвращает JWT + профиль.
 */
router.post('/auth', async (req, res) => {
  try {
    const { telegram_id, username } = req.body || {};
    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const user = await createOrGetUser(telegram_id, username || 'Anon');
    const token = signToken({ telegram_id: user.telegram_id });

    return res.json({
      token,
      user: {
        telegram_id: user.telegram_id,
        username: user.username,
        coins: user.coins,
        last_bonus: user.last_bonus,
      },
    });
  } catch (err) {
    console.error('POST /auth error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/me
 * Header: Authorization: Bearer <token>
 */
router.get('/me', auth, async (req, res) => {
  try {
    const { telegram_id } = req.user;
    const user = await getUserByTelegramId(telegram_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      telegram_id: user.telegram_id,
      username: user.username,
      coins: user.coins,
      last_bonus: user.last_bonus,
    });
  } catch (err) {
    console.error('GET /me error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/bonus
 * Header: Authorization: Bearer <token>
 * Начисляет ежедневный бонус, если прошло 24 часа.
 */
router.post('/bonus', auth, async (req, res) => {
  try {
    const { telegram_id } = req.user;
    const result = await applyDailyBonus(telegram_id, 100);
    return res.json(result);
  } catch (err) {
    console.error('POST /bonus error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/updateCoins
 * Header: Authorization: Bearer <token>
 * Body: { delta: number }
 */
router.post('/updateCoins', auth, async (req, res) => {
  try {
    const { delta } = req.body || {};
    if (!isNumber(delta)) {
      return res.status(400).json({ error: 'delta must be a number' });
    }

    const { telegram_id } = req.user;
    const user = await updateUserCoins(telegram_id, delta);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user });
  } catch (err) {
    console.error('POST /updateCoins error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/leaderboard?limit=10
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit || '10', 10);
    const rows = await getLeaderboard(Number.isFinite(limit) ? limit : 10);
    return res.json({ leaderboard: rows });
  } catch (err) {
    console.error('GET /leaderboard error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/* ------------------------------------------------------------------ */
/* LEGACY (старые маршруты под фронт без JWT) — можно удалить позже   */
/* ------------------------------------------------------------------ */

router.post('/register', async (req, res) => {
  try {
    const { telegramId, username } = req.body || {};
    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }
    const user = await createOrGetUser(telegramId, username || 'Anon');
    return res.json({ user });
  } catch (err) {
    console.error('POST /register error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/dailyBonus/:telegramId', async (req, res) => {
  try {
    const telegramId = Number.parseInt(req.params.telegramId, 10);
    const result = await applyDailyBonus(telegramId, 100);
    return res.json(result);
  } catch (err) {
    console.error('GET /dailyBonus/:telegramId error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/updateCoinsLegacy', async (req, res) => {
  try {
    const { telegramId, delta } = req.body || {};
    if (!telegramId || !isNumber(delta)) {
      return res
        .status(400)
        .json({ error: 'telegramId and numeric delta are required' });
    }
    const user = await updateUserCoins(telegramId, delta);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user });
  } catch (err) {
    console.error('POST /updateCoinsLegacy error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
