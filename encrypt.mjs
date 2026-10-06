// Шифрует data/trip.json паролем из TRIP_PASS → data/trip.enc.json (PBKDF2-SHA256 + AES-256-GCM, как в WebCrypto).
import { readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes, createCipheriv, createHash } from 'node:crypto';

const pass = process.env.TRIP_PASS;
if (!pass) { console.error('TRIP_PASS is not set'); process.exit(1); }
const ITER = 310000;
const plain = readFileSync(new URL('./data/trip.json', import.meta.url));
// соль постоянная для пароля: ключ на телефоне остаётся рабочим после обновления данных
const salt = createHash('sha256').update('kr-trip|' + pass).digest().subarray(0, 16);
const iv = randomBytes(12);
const key = pbkdf2Sync(pass, salt, ITER, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
writeFileSync(new URL('./data/trip.enc.json', import.meta.url), JSON.stringify({
  v: 1, iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64'),
}));
console.log('encrypted', plain.length, '->', ct.length);
