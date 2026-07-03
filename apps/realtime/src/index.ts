/**
 * Worker realtime di Barlandia.
 *
 * GET /connect?token=<rt-token>  → upgrade WebSocket verso il RoomDO.
 *
 * Il token è firmato (HMAC, scope 'rt', TTL 60s) dall'app web con lo
 * stesso SESSION_SECRET. Qui viene verificato PRIMA di toccare il DO:
 * il client non parla mai col Durable Object senza autenticazione.
 */

import { ROOM_NAME, verifyToken } from '@barlandia/shared';
import { RoomDO } from './room-do';

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace;
  DB: D1Database;
  SESSION_SECRET: string;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok');
    }

    if (url.pathname !== '/connect') {
      return new Response('Not found', { status: 404 });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Controllo Origin: i browser lo mandano sempre nell'handshake WS.
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (origin && !allowed.includes(origin)) {
      return new Response('Origin non ammessa', { status: 403 });
    }

    const token = url.searchParams.get('token') ?? '';
    const payload = await verifyToken(token, env.SESSION_SECRET, 'rt');
    if (!payload) {
      return new Response('Token non valido o scaduto', { status: 401 });
    }

    // Una sola stanza in Fase 1: id fisso `room:barlandia`.
    const id = env.ROOM.idFromName(`room:${ROOM_NAME}`);
    const stub = env.ROOM.get(id);

    // Inoltra al DO con l'identità verificata in header interni.
    const doUrl = new URL(request.url);
    doUrl.pathname = '/ws';
    const doReq = new Request(doUrl, request);
    doReq.headers.set('X-Barlandia-User-Id', payload.uid);
    doReq.headers.set('X-Barlandia-Username', payload.usr);
    doReq.headers.set('X-Barlandia-Color-Scheme', payload.cs);
    doReq.headers.set('X-Barlandia-Outfit', payload.top ?? 'maglia');
    return stub.fetch(doReq);
  },
} satisfies ExportedHandler<Env>;
