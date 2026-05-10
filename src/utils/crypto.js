const SALT = 16, IV = 12, ITER = 100000;

async function deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptStr(plain, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const key = await deriveKey(pin, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const r = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  r.set(salt, 0); r.set(iv, salt.length); r.set(new Uint8Array(cipher), salt.length + iv.length);
  return btoa(String.fromCharCode(...r));
}

export async function decryptStr(b64, pin) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt = raw.slice(0, SALT), iv = raw.slice(SALT, SALT + IV), cipher = raw.slice(SALT + IV);
  const key = await deriveKey(pin, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, 256);
  return btoa(String.fromCharCode(...salt)) + '.' + btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function verifyPin(pin, stored) {
  const [saltB64, hashB64] = stored.split('.');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits))) === hashB64;
}