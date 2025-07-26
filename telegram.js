// telegram.js  – проверка initData сигнатуры
import crypto from 'crypto';

const { BOT_TOKEN } = process.env;
const secretKey = crypto
  .createHash('sha256')
  .update(BOT_TOKEN)
  .digest();

export function verifyInitData(initData) {
  // initData приходит строкой вида 'query_id=AA...&user=...&hash=XYZ'
  const url = new URLSearchParams(initData);
  const hash = url.get('hash');           // подпись
  url.delete('hash');

  // параметры должны быть отсортированы как в docs
  const dataCheckString = Array
    .from(url.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return hmac === hash;
}
