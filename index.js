// index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import routes from './routes.js';
import { initDB } from './db.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.FRONT_ORIGIN || 'https://black-jack-otario.vercel.app';

// ───────── middlewares ─────────
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, limit: 150 }));   // 150 req / минута с IP
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

// ping
app.get('/', (_, res) => res.json({ ok : true }));

// API
app.use('/api', routes);

// ───────── start ─────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`API ⟵ ${PORT}`)))
  .catch((e) => { console.error(e); process.exit(1); });
