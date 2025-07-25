import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes.js';
import { initDB } from './db.js'; // <-- импорт здесь

// Load environment variables from .env file (на Render это не обязательно, но не мешает)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Blackjack API is running' });
});

// Register API routes
app.use('/api', routes);

// Стартуем сервер только после инициализации БД
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB init error', err);
    process.exit(1);
  });
