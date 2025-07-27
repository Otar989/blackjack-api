import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createOrGetUser, getUser, updateUserCoins,
  applyDailyBonus, getLeaderboard
} from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/* ---------- middleware ---------- */
function signToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' }); }

function auth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const t   = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!t)  return next(new Error('no token'));
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { next(new Error('bad token')); }
}

/* ---------- routes ---------- */
router.post('/api/auth', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const user = await createOrGetUser(username.trim());
  const token = signToken({ id: user.id });
  res.json({ token, user });
});

router.get('/api/me', auth, async (req, res) => {
  const user = await getUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

router.post('/api/bonus', auth, async (req, res) => {
  res.json(await applyDailyBonus(req.user.id, 100));
});

router.post('/api/updateCoins', auth, async (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== 'number') return res.status(400).json({ error: 'delta numeric' });
  res.json({ user: await updateUserCoins(req.user.id, delta) });
});

router.get('/api/leaderboard', async (req, res) => {
  const lim = parseInt(req.query.limit || '10', 10);
  res.json(await getLeaderboard(lim));
});

export default router;
