import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import routes  from './routes.js';
import { initDB } from './db.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(routes);                 // префикс /api уже заложен в routes.js

initDB().then(() => {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log('API on', PORT));
});
