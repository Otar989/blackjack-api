-- PostgreSQL initialisation script for the Blackjack mini app.
-- Creates the users table to store Telegram user IDs, usernames, coin balances and the last daily bonus timestamp.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  coins INTEGER NOT NULL DEFAULT 1000,
  last_bonus TIMESTAMP
);