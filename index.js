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

/* --- защита и базовые middlewares --- */
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(cors());
app.use(express.json());

/* --- healthcheck --- */
app.get('/', (_, res) => res.json({ ok: true }));

/* --- API --- */
app.use('/api', routes);

/* --- старт после инициализации БД --- */
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API on ${PORT}`));
  })
  .catch((e) => {
    console.error('DB INIT FAIL', e);
    process.exit(1);
  });
