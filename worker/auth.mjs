const encoder = new TextEncoder();
export const SESSION_COOKIE = '__Host-weather-admin';
export const SESSION_SECONDS = 8 * 60 * 60;
export async function digest(value) {
  return Buffer.from(await crypto.subtle.digest('SHA-256', encoder.encode(value))).toString('hex');
}
export async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(32))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2-sha256:100000:${Buffer.from(salt).toString('hex')}:${Buffer.from(hash).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || !/^pbkdf2-sha256:100000:[a-f0-9]{64}:[a-f0-9]{64}$/.test(stored || '')) return false;
  const calculated = await passwordHash(password, Buffer.from(stored.split(':')[2], 'hex'));
  let different = 0;
  for (let i = 0; i < stored.length; i++) different |= stored.charCodeAt(i) ^ calculated.charCodeAt(i);
  return different === 0;
}
export function cookie(token, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}
export async function sessionHash(request, secret) {
  const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.split('=')[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return digest(token + secret);
}
