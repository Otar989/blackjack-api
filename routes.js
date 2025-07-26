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

/* ===== JWT ===== */
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const t = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'NO_TOKEN' });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }
}

/* ===== API ===== */
/* POST /api/auth { init_data } */
router.post('/auth', async (req, res) => {
  const { init_data = '' } = req.body || {};
  if (!verifyInitData(init_data)) {
    return res.status(400).json({ error: 'BAD_SIGNATURE' });
  }

  const url = new URLSearchParams(init_data);
  const rawUser = JSON.parse(url.get('user'));
  const telegram_id = rawUser.id;
  const username =
    rawUser.username || rawUser.first_name || `Player${telegram_id}`;

  const user = await createOrGetUser(telegram_id, username);
  const token = sign({ telegram_id });

  res.json({ token, user });
});

/* GET /api/me */
router.get('/me', auth, async (req, res) => {
  const user = await getUserByTelegramId(req.user.telegram_id);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(user);
});

/* POST /api/bonus */
router.post('/bonus', auth, async (req, res) => {
  const result = await applyDailyBonus(req.user.telegram_id, 100);
  res.json(result);
});

/* POST /api/updateCoins { delta } */
router.post('/updateCoins', auth, async (req, res) => {
  const { delta } = req.body || {};
  if (typeof delta !== 'number')
    return res.status(400).json({ error: 'DELTA_REQUIRED' });

  const user = await updateUserCoins(req.user.telegram_id, delta);
  res.json({ user });
});

/* GET /api/leaderboard */
router.get('/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const rows = await getLeaderboard(limit);
  res.json({ leaderboard: rows });
});

export default router;
