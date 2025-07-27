// backend/routes.js
import { Router } from 'express';
import {
  createOrGetUser,
  getUser,
  updateUserCoins,
  applyDailyBonus,
  getLeaderboard,
} from './db.js';

const router = Router();

// -------- авторизация ----------
router.post('/auth', async (req, res) => {
  const { username } = req.body;          // теперь присылаем username из браузера
  if (!username) return res.status(400).json({ error:'Username required' });

  const user = await createOrGetUser(username);
  res.json({ user, token: username /* простейший “jwt” */ });
});

// -------- REST остальных энд-пойнтов ----------
router.get('/me', async (req, res) => {
  const token = req.get('authorization')?.replace('Bearer ','');
  const user  = token ? await getUser(token) : null;
  if (!user) return res.status(401).json({ error:'Auth' });
  res.json(user);
});

router.post('/updateCoins', async (req, res) => {
  const token = req.get('authorization')?.replace('Bearer ','');
  const { delta } = req.body || {};
  const user = token ? await updateUserCoins(token, Number(delta)||0) : null;
  if (!user) return res.status(401).json({ error:'Auth' });
  res.json({ user });
});

router.post('/bonus', async (req, res) => {
  const token = req.get('authorization')?.replace('Bearer ','');
  if (!token) return res.status(401).json({ error:'Auth' });
  const result = await applyDailyBonus(token);
  res.json(result);
});

router.get('/leaderboard', async (req,res) => {
  const limit = Number(req.query.limit)||10;
  res.json(await getLeaderboard(limit));
});

export default router;
