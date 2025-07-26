import TelegramBot from 'node-telegram-bot-api';
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN, { polling: false }) : null;

export function verifyInitData(data = '') {
  if (!BOT_TOKEN) return false;

  const params = new URLSearchParams(data);
  const hash = params.get('hash');
  params.delete('hash');

  const checkString = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  return hmac === hash;
}
