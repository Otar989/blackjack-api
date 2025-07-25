import { Router } from 'express';
import {
  getUserByTelegramId,
  createUser,
  updateUserCoins,
  applyDailyBonus,
  getLeaderboard,
} from './db.js';

const router = Router();

// Register or fetch a user
router.post('/register', async (req, res) => {
  const { telegramId, username } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId is required' });
  }
  try {
    let user = await getUserByTelegramId(telegramId);
    if (!user) {
      user = await createUser(telegramId, username || `Player${telegramId}`);
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by telegram ID
router.get('/user/:telegramId', async (req, res) => {
  const telegramId = parseInt(req.params.telegramId, 10);
  if (!telegramId) {
    return res.status(400).json({ error: 'Invalid telegramId' });
  }
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user coins
router.post('/updateCoins', async (req, res) => {
  const { telegramId, delta } = req.body;
  if (!telegramId || typeof delta !== 'number') {
    return res.status(400).json({ error: 'telegramId and numeric delta are required' });
  }
  try {
    const user = await updateUserCoins(telegramId, delta);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim daily bonus
router.get('/dailyBonus/:telegramId', async (req, res) => {
  const telegramId = parseInt(req.params.telegramId, 10);
  if (!telegramId) {
    return res.status(400).json({ error: 'Invalid telegramId' });
  }
  try {
    const result = await applyDailyBonus(telegramId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leaderboard
router.get('/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  try {
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;