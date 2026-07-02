/**
 * Connessione WebSocket alla stanza (via worker realtime).
 * - chiede un token fresco a /api/rt-token a ogni (ri)connessione
 * - riconnessione automatica con backoff (mobile: rete che va e viene)
 * - heartbeat periodico SOLO con tab visibile (requisito anti-idle del
 *   guadagno passivo: tab in background ⇒ niente accredito)
 */
import {
  HEARTBEAT_INTERVAL_MS,
  type ClientMessage,
  type ServerMessage,
} from '@barlandia/shared';

export interface RoomConnectionHandlers {
  onMessage(msg: ServerMessage): void;
  onStatus(status: 'connecting' | 'open' | 'closed'): void;
}

export class RoomConnection {
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;

  constructor(private handlers: RoomConnectionHandlers) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearHeartbeat();
    this.ws?.close(1000, 'bye');
    this.ws = null;
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.handlers.onStatus('connecting');

    let token: string;
    let url: string;
    try {
      const res = await fetch('/api/rt-token');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error(`rt-token ${res.status}`);
      const data = (await res.json()) as { token: string; url: string };
      token = data.token;
      url = data.url;
    } catch {
      this.scheduleReconnect();
      return;
    }

    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus('open');
      this.startHeartbeat();
    };
    ws.onmessage = (ev) => {
      try {
        this.handlers.onMessage(JSON.parse(ev.data as string) as ServerMessage);
      } catch {
        // messaggio malformato dal server: ignora
      }
    };
    ws.onclose = (ev) => {
      this.clearHeartbeat();
      if (this.ws === ws) this.ws = null;
      this.handlers.onStatus('closed');
      // 4000 = sostituito da un'altra tab: non riconnettere in loop
      if (!this.stopped && ev.code !== 4000) this.scheduleReconnect();
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = Math.min(1000 * 2 ** this.attempts, 15000);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.send({ type: 'heartbeat' });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}
