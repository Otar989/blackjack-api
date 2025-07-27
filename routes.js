// backend/routes.js
import { Router } from 'express';
import {
  createOrGetUser,
  getUserByTelegramId,
  updateUserCoins,
  applyDailyBonus,
  getLeaderboard,
} from './db.js';

const router = Router();

/* ---------- /api/auth ---------- */
router.post('/auth', async (req, res) => {
  try {
    // В браузерной версии ждём { username } в теле
    const { username = 'Anon', telegram_id = null } = req.body;
    const user = await createOrGetUser(telegram_id, username);
    res.json({ user });          // без JWT
  } catch (e) {
    console.error('/auth', e);
    res.status(500).json({ error: 'internal' });
  }
});

/* ---------- /api/me ---------- */
router.get('/me/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = await getUserByTelegramId(id) || null;
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

/* ---------- /api/bonus ---------- */
router.post('/bonus/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await applyDailyBonus(id, 100, true);
  res.json(result);
});

/* ---------- /api/updateCoins ---------- */
router.post('/updateCoins/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { delta = 0 } = req.body;
  const user = await updateUserCoins(id, delta, true);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ user });
});

/* ---------- /api/leaderboard ---------- */
router.get('/leaderboard', async (_, res) => {
  res.json(await getLeaderboard(10));
});

export default router;
