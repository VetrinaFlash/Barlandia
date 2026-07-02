/**
 * Firma e verifica di token compatti HMAC-SHA256 (WebCrypto, edge-safe).
 * Formato: base64url(payloadJSON) + '.' + base64url(hmac)
 *
 * Usato per:
 *  - cookie di sessione (scope 'session', TTL lungo)
 *  - token realtime (scope 'rt', TTL 60s) che il client presenta al worker
 *    realtime per aprire il WebSocket. Il client NON parla mai col DO
 *    direttamente: il worker verifica il token prima dell'upgrade.
 *
 * Entrambe le app (web e realtime) condividono lo stesso SESSION_SECRET.
 */

export interface TokenPayload {
  /** user id */
  uid: string;
  /** username (comodo per il DO, evita una query) */
  usr: string;
  /** color scheme avatar */
  cs: string;
  /** scope: 'session' | 'rt' */
  scp: 'session' | 'rt';
  /** scadenza, epoch secondi */
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, body));
  return `${b64urlEncode(body)}.${b64urlEncode(sig)}`;
}

/**
 * Verifica firma, scadenza e scope. Ritorna il payload o null.
 * La verifica della firma usa crypto.subtle.verify (constant-time).
 */
export async function verifyToken(
  token: string,
  secret: string,
  expectedScope: TokenPayload['scp'],
): Promise<TokenPayload | null> {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = b64urlDecode(token.slice(0, dot));
  const sig = b64urlDecode(token.slice(dot + 1));
  if (!body || !sig) return null;

  const key = await hmacKey(secret);
  const bodyCopy = new Uint8Array(body); // BufferSource stabile
  const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, bodyCopy);
  if (!ok) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyCopy));
  } catch {
    return null;
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.uid !== 'string' ||
    typeof payload.usr !== 'string' ||
    typeof payload.cs !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  if (payload.scp !== expectedScope) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}
