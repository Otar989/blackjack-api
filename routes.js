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

/* ───────── helpers ───────── */
const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error : 'Нет JWT' });

  try        { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_)  { return res.status(401).json({ error : 'Неверный JWT' }); }
};

/* ───────── 1. Проверка initData из Telegram ─────────
   Фронт отсылает запрос POST /api/verify { initData }
   Бэк сверяет подпись и отдаёт JWT + профиль
*/
router.post('/verify', async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData || !verifyInitData(initData))
      return res.status(400).json({ error : 'initData неверен' });

    // user приходит JSON-строкой внутри initData
    const tgUser = JSON.parse(
      decodeURIComponent(new URLSearchParams(initData).get('user'))
    );
    const telegram_id = tgUser.id;
    const username    = tgUser.username || tgUser.first_name || `Player${telegram_id}`;

    const user  = await createOrGetUser(telegram_id, username);
    const token = sign({ telegram_id });

    res.json({ token, user });
  } catch (e) {
    console.error('/verify', e);
    res.status(500).json({ error : 'Ошибка сервера' });
  }
});

/* ───────── 2. Профиль ───────── */
router.get('/me', auth, async (req, res) => {
  const user = await getUserByTelegramId(req.user.telegram_id);
  if (!user) return res.status(404).json({ error : 'Нет пользователя' });
  res.json(user);
});

/* ───────── 3. Бонус ───────── */
router.post('/bonus', auth, async (req, res) => {
  const result = await applyDailyBonus(req.user.telegram_id, 100);
  res.json(result);
});

/* ───────── 4. Изменить баланс ───────── */
router.post('/updateCoins', auth, async (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== 'number')
    return res.status(400).json({ error : 'delta должно быть числом' });

  const user = await updateUserCoins(req.user.telegram_id, delta);
  res.json({ user });
});

/* ───────── 5. Лидерборд ───────── */
router.get('/leaderboard', async (req, res) => {
  const rows = await getLeaderboard(
    parseInt(req.query.limit || '10', 10)
  );
  res.json({ leaderboard : rows });
});

export default router;
