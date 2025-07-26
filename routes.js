// backend/routes.js
import { Router } from 'express';
import jwt          from 'jsonwebtoken';
import {
  createOrGetUser, getUserByTelegramId,
  applyDailyBonus, getLeaderboard, updateUserCoins,
} from './db.js';
import { verifyInitData, parseUserFromInitData } from './telegram.js';

const router      = Router();
const JWT_SECRET  = process.env.JWT_SECRET || 'supersecret';

/* helpers */
const sign = (p) => jwt.sign(p, JWT_SECRET, { expiresIn: '30d' });
const auth = (req, res, next) => {
  const hdr   = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token)           return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
};

/* --------------------  /api/auth  -------------------- */
router.post('/auth', async (req, res) => {
  try {
    const { init_data = '', telegram_id, username } = req.body;

    /* ►► режим Telegram */
    if (init_data) {
      if (!verifyInitData(init_data))
        return res.status(400).json({ error: 'Bad init_data signature' });

      const u = parseUserFromInitData(init_data);
      const user  = await createOrGetUser(u.telegram_id, u.username);
      const token = sign({ telegram_id: u.telegram_id });
      return res.json({ token, user });
    }

    /* ►► dev-режим в обычном браузере */
    if (telegram_id) {
      const user  = await createOrGetUser(telegram_id, username || 'WebUser');
      const token = sign({ telegram_id });
      return res.json({ token, user });
    }

    return res.status(400).json({ error: 'init_data or telegram_id required' });
  } catch (err) {
    console.error('POST /auth', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* остальные эндпоинты без изменений */
router.get ('/me',               auth, async (req,res)=>{ res.json(await getUserByTelegramId(req.user.telegram_id)); });
router.post('/bonus',            auth, async (req,res)=>{ res.json(await applyDailyBonus(req.user.telegram_id,100)); });
router.post('/updateCoins',      auth, async (req,res)=>{ res.json({ user: await updateUserCoins(req.user.telegram_id, req.body.delta|0) }); });
router.get ('/leaderboard',            async (req,res)=>{ res.json(await getLeaderboard(req.query.limit|0 || 10)); });

export default router;
