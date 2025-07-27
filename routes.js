// backend/routes.js
import express  from 'express';
import jwt      from 'jsonwebtoken';
import dotenv   from 'dotenv';
import {
  initDB, createOrGetUser, getUser,
  updateUserCoins, applyDailyBonus, getLeaderboard
} from './db.js';

dotenv.config();
await initDB();

const router      = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET || 'super-secret';

/** helper ─ проверяем и достаём username из bearer-token */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error:'no token' });

  try {
    const { username } = jwt.verify(token, JWT_SECRET);
    req.username = username;
    next();
  } catch {
    res.status(401).json({ error:'bad token' });
  }
}

/** POST /api/auth  { username }  →  { token , user } */
router.post('/api/auth', async (req, res) => {
  const { username = '' } = req.body || {};
  if (!username.trim()) return res.status(400).json({ error:'username required' });

  const user  = await createOrGetUser(username.trim());
  const token = jwt.sign({ username:user.username }, JWT_SECRET);
  res.json({ token, user });
});

/** GET /api/me  ( bearer ) */
router.get('/api/me', authMiddleware, async (req, res) => {
  const user = await getUser(req.username);
  res.json(user || { error:'not found' });
});

/** POST /api/bonus  ( bearer ) */
router.post('/api/bonus', authMiddleware, async (req, res) => {
  const result = await applyDailyBonus(req.username);
  res.json(result);
});

/** POST /api/updateCoins { delta }  ( bearer ) */
router.post('/api/updateCoins', authMiddleware, async (req, res) => {
  const { delta = 0 } = req.body || {};
  const user = await updateUserCoins(req.username, Number(delta));
  res.json({ user });
});

/** GET /api/leaderboard?limit=10 */
router.get('/api/leaderboard', async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  res.json(await getLeaderboard(limit));
});

export default router;
