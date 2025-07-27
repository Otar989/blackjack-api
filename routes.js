import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createOrGetUser,
  getUser,
  applyDailyBonus,
  updateUserCoins,
  getLeaderboard
} from './db.js';

const router     = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function signToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' }); }

function auth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const tok = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!tok) return next({ status: 401, message: 'No token' });
  try { req.user = jwt.verify(tok, JWT_SECRET); next(); }
  catch { next({ status: 401, message: 'Invalid token' }); }
}

/* ---------- API ---------- */

router.post('/auth', async (req, res, next) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    const user  = await createOrGetUser(username.trim());
    const token = signToken({ username: user.username });
    res.json({ token, user });
  } catch (e) { next(e); }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await getUser(req.user.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { next(e); }
});

router.post('/bonus', auth, async (req, res, next) => {
  try {
    const r = await applyDailyBonus(req.user.username);
    res.json(r);
  } catch (e) { next(e); }
});

router.post('/updateCoins', auth, async (req, res, next) => {
  try {
    const { delta } = req.body || {};
    if (typeof delta !== 'number') return res.status(400).json({ error: 'numeric delta required' });
    const user = await updateUserCoins(req.user.username, delta);
    res.json({ user });
  } catch (e) { next(e); }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const rows = await getLeaderboard(parseInt(req.query.limit || '10', 10));
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- error ---------- */
router.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal' });
});

export default router;
