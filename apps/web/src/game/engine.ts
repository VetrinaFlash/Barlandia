/**
 * BarEngine — vista PixiJS della stanza: pavimento isometrico, bancone,
 * avatar, arredi, tap-to-move con pathfinding condiviso.
 *
 * L'engine è SOLO vista+input: non parla con la rete. La pagina /bar
 * collega gli eventi dell'engine alla RoomConnection.
 */
import { Application, Container, Graphics, Ticker } from 'pixi.js';
import {
  ROOM_H,
  ROOM_W,
  findPath,
  isLayoutBlocked,
  isWalkable,
  layoutCharAt,
  tileKey,
  type Placement,
  type RoomUser,
  type TilePos,
} from '@barlandia/shared';
import { Avatar, type Direction } from './avatar';
import { TILE_H, TILE_W, depthOf, tileToWorld, worldToTile } from './iso';
import { PALETTE as P } from './palette';
import { drawBottleShelf, drawEspressoMachine, drawFurniture, drawWallFrame } from './sprites';

interface UserSprite {
  avatar: Avatar;
  tile: TilePos; // tile logica corrente (fine percorso raggiunta finora)
  path: TilePos[]; // tappe rimanenti (path[0] = prossima)
  progress: number; // 0..1 nel segmento corrente
  renderPos: { x: number; y: number }; // posizione tile frazionaria
}

const WALK_SPEED = 3.2; // tile al secondo

export interface EngineEvents {
  /** Tap su una tile percorribile (in modalità normale = richiesta move). */
  onTileTap(x: number, y: number): void;
  /** Tap su un arredo di categoria 'seduta' (tile non percorribile). */
  onSeatTap(inventoryId: string): void;
}

export class BarEngine {
  private app: Application | null = null;
  private world = new Container();
  private objects = new Container(); // layer ordinato per profondità
  private tapMarker = new Graphics();
  private users = new Map<string, UserSprite>();
  private placements = new Map<string, { container: Container; placement: Placement }>();
  private selfId = '';
  private events: EngineEvents;
  private dragging = false;
  private destroyed = false;

  constructor(events: EngineEvents) {
    this.events = events;
  }

  async init(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: 0x2b1d12,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) {
      // destroy() chiamato durante l'await (StrictMode double-mount)
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);

    this.world.addChild(this.buildRoom());
    this.objects.sortableChildren = true;
    this.world.addChild(this.objects);
    this.tapMarker.visible = false;
    this.world.addChild(this.tapMarker);
    app.stage.addChild(this.world);

    this.layoutCamera();
    app.renderer.on('resize', () => this.layoutCamera());

    this.setupInput();
    app.ticker.add((t) => this.tick(t));
  }

  destroy(): void {
    this.destroyed = true;
    for (const u of this.users.values()) u.avatar.destroy();
    this.users.clear();
    this.placements.clear();
    this.app?.destroy(true, { children: true });
    this.app = null;
  }

  // -------------------------------------------------------------------------
  // Stato dal server

  setSelf(uid: string): void {
    this.selfId = uid;
  }

  upsertUser(user: RoomUser): void {
    const existing = this.users.get(user.id);
    if (existing) {
      existing.tile = { x: user.x, y: user.y };
      existing.path = [];
      existing.renderPos = { x: user.x, y: user.y };
      existing.avatar.setSeated(!!user.seatedOn);
      return;
    }
    const avatar = new Avatar(user.id, user.username, user.colorScheme, user.id === this.selfId);
    avatar.setSeated(!!user.seatedOn);
    const sprite: UserSprite = {
      avatar,
      tile: { x: user.x, y: user.y },
      path: [],
      progress: 0,
      renderPos: { x: user.x, y: user.y },
    };
    this.users.set(user.id, sprite);
    this.objects.addChild(avatar.view);
    this.placeAvatar(sprite);
  }

  /** L'utente si è seduto/alzato (evento dedicato dal server). */
  setUserSeated(uid: string, seated: boolean, tile?: TilePos): void {
    const u = this.users.get(uid);
    if (!u) return;
    u.avatar.setSeated(seated);
    if (seated && tile) {
      u.tile = tile;
      u.path = [];
      u.renderPos = { x: tile.x, y: tile.y };
    }
  }

  showEmote(uid: string, emoji: string): void {
    this.users.get(uid)?.avatar.emote(emoji);
  }

  removeUser(uid: string): void {
    const u = this.users.get(uid);
    if (!u) return;
    u.avatar.destroy();
    this.users.delete(uid);
  }

  /** Riconciliazione periodica (state_sync): teletrasporta solo chi è fermo e fuori posto. */
  syncUsers(list: RoomUser[]): void {
    const seen = new Set<string>();
    for (const user of list) {
      seen.add(user.id);
      const u = this.users.get(user.id);
      if (!u) {
        this.upsertUser(user);
        continue;
      }
      const idle = u.path.length === 0;
      if (idle && (u.tile.x !== user.x || u.tile.y !== user.y)) {
        u.tile = { x: user.x, y: user.y };
        u.renderPos = { x: user.x, y: user.y };
      }
      u.avatar.setSeated(!!user.seatedOn);
    }
    for (const uid of [...this.users.keys()]) {
      if (!seen.has(uid)) this.removeUser(uid);
    }
  }

  /** Avvia la camminata di un utente verso la destinazione (validata dal server). */
  walkUserTo(uid: string, target: TilePos): void {
    const u = this.users.get(uid);
    if (!u) return;
    const from = u.path.length > 0 ? u.path[0]! : u.tile;
    const path = findPath(from, target, this.blockedTiles());
    if (!path || path.length <= 1) {
      // non raggiungibile lato client (deriva): teletrasporto morbido
      u.tile = target;
      u.path = [];
      u.renderPos = { x: target.x, y: target.y };
      return;
    }
    u.tile = path[0]!;
    u.path = path.slice(1);
    u.progress = 0;
  }

  setPlacements(list: Placement[]): void {
    for (const id of [...this.placements.keys()]) this.removePlacement(id);
    for (const p of list) this.addPlacement(p);
  }

  addPlacement(p: Placement): void {
    if (this.placements.has(p.inventoryId)) this.removePlacement(p.inventoryId);
    const c = new Container();
    const g = new Graphics();
    drawFurniture(g, p.spriteKey);
    c.addChild(g);
    const pos = tileToWorld(p.x, p.y);
    c.position.set(pos.x, pos.y + TILE_H / 2); // origine = centro base tile
    c.zIndex = depthOf(p.x, p.y) * 10 + 5;
    this.objects.addChild(c);
    this.placements.set(p.inventoryId, { container: c, placement: p });
  }

  removePlacement(inventoryId: string): void {
    const entry = this.placements.get(inventoryId);
    if (!entry) return;
    entry.container.destroy({ children: true });
    this.placements.delete(inventoryId);
  }

  showBubble(uid: string, text: string): void {
    this.users.get(uid)?.avatar.say(text);
  }

  /** Tile bloccate dagli arredi piazzati (il layout fisso è già in isWalkable). */
  blockedTiles(): Set<string> {
    const s = new Set<string>();
    for (const { placement } of this.placements.values()) {
      s.add(tileKey(placement.x, placement.y));
    }
    return s;
  }

  private seatAt(x: number, y: number): Placement | null {
    for (const { placement } of this.placements.values()) {
      if (placement.category === 'seduta' && placement.x === x && placement.y === y) {
        return placement;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Costruzione stanza statica

  private buildRoom(): Container {
    const room = new Container();

    // muri di fondo, appoggiati esattamente ai bordi del pavimento.
    // Vertici esterni del pavimento (vedi proiezione in iso.ts):
    //   N = angolo alto di (0,0), E = angolo destro di (ROOM_W-1, 0),
    //   O = angolo sinistro di (0, ROOM_H-1)
    const walls = new Graphics();
    const wallH = 92;
    const N = { x: 0, y: -TILE_H / 2 };
    const E = { x: (ROOM_W * TILE_W) / 2, y: (ROOM_W * TILE_H) / 2 - TILE_H / 2 };
    const O = { x: -(ROOM_H * TILE_W) / 2, y: (ROOM_H * TILE_H) / 2 - TILE_H / 2 };
    const band = (a: { x: number; y: number }, b: { x: number; y: number }, h: number, color: number, alpha = 1) =>
      walls.poly([a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h]).fill({ color, alpha });
    // muro nord-est (lungo y=0) e nord-ovest (lungo x=0)
    band(N, E, wallH, P.wallTop);
    band(O, N, wallH, P.wallLeft);
    // boiserie (fascia legno in basso ai muri)
    band(N, E, 26, P.wainscot);
    band(O, N, 26, P.wainscot, 0.85);
    room.addChild(walls);

    // pavimento a scacchi
    const floor = new Graphics();
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const { x: wx, y: wy } = tileToWorld(x, y);
        const color =
          layoutCharAt(x, y) === 'X'
            ? P.woodDark // pedana dietro il bancone
            : (x + y) % 2 === 0
              ? P.floorLight
              : P.floorDark;
        floor
          .poly([wx, wy - TILE_H / 2, wx + TILE_W / 2, wy, wx, wy + TILE_H / 2, wx - TILE_W / 2, wy])
          .fill(color);
        floor
          .poly([wx, wy - TILE_H / 2, wx + TILE_W / 2, wy, wx, wy + TILE_H / 2, wx - TILE_W / 2, wy])
          .stroke({ width: 1, color: P.floorEdge, alpha: 0.5 });
      }
    }
    room.addChild(floor);

    // bancone + macchina espresso (layout fisso)
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const ch = layoutCharAt(x, y);
        if (ch !== 'B' && ch !== 'M') continue;
        const g = new Graphics();
        const { x: wx, y: wy } = tileToWorld(x, y);
        // blocco bancone: prisma legno con top più chiaro e filo ottone
        const ex = TILE_W / 2;
        const ey = TILE_H / 2;
        const h = 34;
        g.poly([wx, wy + ey, wx - ex, wy, wx - ex, wy - h, wx, wy + ey - h]).fill(P.woodDark);
        g.poly([wx + ex, wy, wx, wy + ey, wx, wy + ey - h, wx + ex, wy - h]).fill(P.woodFront);
        g.poly([wx, wy - ey - h, wx + ex, wy - h, wx, wy + ey - h, wx - ex, wy - h]).fill(P.woodTop);
        g.poly([wx, wy - ey - h, wx + ex, wy - h, wx, wy + ey - h, wx - ex, wy - h]).stroke({
          width: 1.5,
          color: P.brass,
          alpha: 0.7,
        });
        room.addChild(g);
        if (ch === 'M') {
          const m = new Graphics();
          drawEspressoMachine(m);
          m.position.set(wx, wy - h + 6);
          room.addChild(m);
        }
      }
    }

    // mensola con bottiglie appesa al muro sopra il bancone (decoro
    // fisso, sempre presente — rompe il vuoto anche a locale spoglio)
    for (const sx of [3, 6]) {
      const { x: wx, y: wy } = tileToWorld(sx, 0);
      const g = new Graphics();
      drawBottleShelf(g, sx);
      g.position.set(wx, wy - 74);
      room.addChild(g);
    }

    // quadro/lavagna sul muro opposto
    {
      const { x: wx, y: wy } = tileToWorld(0, 4);
      const g = new Graphics();
      drawWallFrame(g);
      g.position.set(wx - 16, wy - 58);
      room.addChild(g);
    }

    return room;
  }

  // -------------------------------------------------------------------------
  // Input: tap-to-move + pan

  private setupInput(): void {
    const app = this.app!;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    let startX = 0;
    let startY = 0;
    let panning = false;

    app.stage.on('pointerdown', (e) => {
      startX = e.globalX;
      startY = e.globalY;
      panning = true;
      this.dragging = false;
    });
    app.stage.on('pointermove', (e) => {
      if (!panning) return;
      const dx = e.globalX - startX;
      const dy = e.globalY - startY;
      if (!this.dragging && Math.hypot(dx, dy) > 10) this.dragging = true;
      if (this.dragging) {
        this.world.x += e.movement.x;
        this.world.y += e.movement.y;
      }
    });
    const end = (e: { globalX: number; globalY: number }) => {
      if (!panning) return;
      panning = false;
      if (this.dragging) return; // era un pan, non un tap
      const local = this.world.toLocal({ x: e.globalX, y: e.globalY });
      const tile = worldToTile(local.x, local.y);
      if (isWalkable(tile.x, tile.y, this.blockedTiles())) {
        this.flashMarker(tile.x, tile.y);
        this.events.onTileTap(tile.x, tile.y);
        return;
      }
      const seat = this.seatAt(tile.x, tile.y);
      if (seat) this.events.onSeatTap(seat.inventoryId);
    };
    app.stage.on('pointerup', end);
    app.stage.on('pointerupoutside', () => {
      panning = false;
    });
  }

  private flashMarker(x: number, y: number): void {
    const { x: wx, y: wy } = tileToWorld(x, y);
    const g = this.tapMarker;
    g.clear();
    g.poly([wx, wy - TILE_H / 2, wx + TILE_W / 2, wy, wx, wy + TILE_H / 2, wx - TILE_W / 2, wy])
      .stroke({ width: 2.5, color: P.terracottaViva });
    g.visible = true;
    g.alpha = 1;
  }

  // -------------------------------------------------------------------------
  // Camera e ticker

  private layoutCamera(): void {
    const app = this.app;
    if (!app) return;
    // bounding box della stanza in coordinate mondo
    const left = -ROOM_H * (TILE_W / 2) - TILE_W / 2;
    const right = ROOM_W * (TILE_W / 2) + TILE_W / 2;
    const top = -110; // muri
    const bottom = ((ROOM_W + ROOM_H) * TILE_H) / 2 + TILE_H;
    const w = right - left;
    const h = bottom - top;
    const fit = Math.min(app.screen.width / w, app.screen.height / h);
    // preferiamo mostrare tutta la stanza (tap-to-move più comodo);
    // sotto 0.4 si perde leggibilità e resta il pan (drag)
    const scale = Math.max(Math.min(fit * 0.98, 1.4), 0.4);
    this.world.scale.set(scale);
    this.world.x = app.screen.width / 2 - ((left + right) / 2) * scale;
    this.world.y = app.screen.height / 2 - ((top + bottom) / 2) * scale;
  }

  private tick(t: Ticker): void {
    const dt = t.deltaMS / 1000;

    for (const u of this.users.values()) {
      if (u.path.length > 0) {
        const from = u.tile;
        const to = u.path[0]!;
        u.progress += (dt * WALK_SPEED) / 1; // segmenti lunghi 1 tile
        u.avatar.walking = true;
        u.avatar.setDirection(directionOf(from, to));
        if (u.progress >= 1) {
          u.tile = to;
          u.path.shift();
          u.progress = 0;
          u.renderPos = { x: to.x, y: to.y };
        } else {
          u.renderPos = {
            x: from.x + (to.x - from.x) * u.progress,
            y: from.y + (to.y - from.y) * u.progress,
          };
        }
      } else {
        u.avatar.walking = false;
      }
      u.avatar.tick(dt);
      this.placeAvatar(u);
    }

    if (this.tapMarker.visible) {
      this.tapMarker.alpha -= dt * 1.8;
      if (this.tapMarker.alpha <= 0) this.tapMarker.visible = false;
    }
  }

  private placeAvatar(u: UserSprite): void {
    const pos = tileToWorld(u.renderPos.x, u.renderPos.y);
    u.avatar.view.position.set(pos.x, pos.y + TILE_H / 2 - 2);
    u.avatar.view.zIndex = depthOf(u.renderPos.x, u.renderPos.y) * 10 + 6;
  }
}

function directionOf(from: TilePos, to: TilePos): Direction {
  if (to.x > from.x) return 'E';
  if (to.x < from.x) return 'O';
  if (to.y > from.y) return 'S';
  return 'N';
}
