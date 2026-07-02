/**
 * Hashing password con PBKDF2-SHA256 via WebCrypto (edge-safe: niente
 * bcrypt/argon2, non compatibili con l'edge runtime di Cloudflare).
 *
 * Formato stored: pbkdf2$<iterazioni>$<salt b64url>$<hash b64url>
 *
 * COMPROMESSO (vedi README): 100k iterazioni è lo standard minimo OWASP,
 * ma sul piano free di Workers (10ms CPU/richiesta) può sforare il budget.
 * Se il deploy è su piano free e login/registrazione falliscono per CPU
 * limit, abbassare PBKDF2_ITERATIONS (i vecchi hash restano verificabili
 * perché le iterazioni sono codificate nell'hash stesso).
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
  const salt = b64urlDecode(parts[2] ?? '');
  const expected = b64urlDecode(parts[3] ?? '');
  if (!salt || !expected || expected.length !== HASH_BYTES) return false;
  const actual = await derive(password, salt, iterations);
  // confronto constant-time
  let diff = 0;
  for (let i = 0; i < HASH_BYTES; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}
