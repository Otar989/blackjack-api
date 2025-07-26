// backend/telegram.js
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'crypto';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export const bot = BOT_TOKEN
  ? new TelegramBot(BOT_TOKEN, { polling: false })
  : null;

/** валидация initData из Telegram.WebApp.initData */
export function verifyInitData(data = '') {
  if (!BOT_TOKEN || !data) return false;

  const params = new URLSearchParams(data);
  const hash = params.get('hash') || '';
  params.delete('hash');

  const dataCheckString = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac   = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return hmac === hash;
}

/** вытаскиваем id и username из initData (предполагаем, что verifyInitData уже true) */
export function parseUserFromInitData(data) {
  const params = new URLSearchParams(data);
  const raw    = JSON.parse(params.get('user') || '{}');

  return {
    telegram_id : raw.id,
    username    : raw.username || raw.first_name || `Player${raw.id}`,
  };
}
