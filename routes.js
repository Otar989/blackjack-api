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
import { verifyInitData } from './telegram.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/* ---------- helpers ---------- */
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ----------  POST /api/auth  ----------  
   Body:
     — init_data (от Telegram)       ► нормальный сценарий
     — telegram_id + username       ► dev-режим в браузере
*/
router.post('/auth', async (req, res) => {
  try {
    const { init_data = '', telegram_id, username = 'Anon' } = req.body;

    let tid = telegram_id;
    /* 1) Telegram WebApp */
    if (init_data) {
      if (!verifyInitData(init_data))
        return res.status(400).json({ error: 'bad init_data' });
      const url = new URLSearchParams(init_data);
      tid = Number(JSON.parse(url.get('user')).id);
    }
    /* 2) dev-браузер, telegram_id передан напрямую */
    if (!tid) return res.status(400).json({ error: 'telegram_id required' });

    const user = await createOrGetUser(tid, username);
    res.json({ token: sign({ telegram_id: tid }), user });
  } catch (e) {
    console.error('POST /auth', e);
    res.status(500).json({ error: 'internal' });
  }
});

/* остальное без изменений … */
router.get('/me', auth, async (req, res) => {
  const u = await getUserByTelegramId(req.user.telegram_id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});
router.post('/bonus', auth, async (req, res) => {
  res.json(await applyDailyBonus(req.user.telegram_id, 100));
});
router.post('/updateCoins', auth, async (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== 'number')
    return res.status(400).json({ error: 'delta must be number' });
  const user = await updateUserCoins(req.user.telegram_id, delta);
  res.json({ user });
});
router.get('/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  res.json({ leaderboard: await getLeaderboard(limit) });
});

export default router;
