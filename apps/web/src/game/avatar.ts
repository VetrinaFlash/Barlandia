/**
 * Avatar placeholder a 4 direzioni (N/S/E/O), disegnato proceduralmente.
 * Il movimento resta leggibile: il corpo è orientato, gli occhi compaiono
 * solo nelle direzioni frontali, E/O si ottengono per specchiatura.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { AVATAR_COLORS, PALETTE as P, SKIN_TONES } from './palette';

export type Direction = 'N' | 'S' | 'E' | 'O';

const NAME_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { color: 0x2b1d12, width: 3 },
});

const BUBBLE_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  fill: 0x2b1d12,
  wordWrap: true,
  wordWrapWidth: 140,
  align: 'center',
});

export class Avatar {
  readonly view = new Container();
  private body = new Graphics();
  private nameLabel: Text;
  private bubble = new Container();
  private bubbleTimer: ReturnType<typeof setTimeout> | null = null;
  private direction: Direction = 'S';
  private skin: number;
  private colors: { body: number; accent: number };
  private walkPhase = 0;
  walking = false;

  constructor(
    readonly userId: string,
    username: string,
    colorScheme: string,
    isSelf: boolean,
  ) {
    this.colors = AVATAR_COLORS[colorScheme] ?? AVATAR_COLORS.terracotta!;
    // tono pelle stabile per utente (hash banale dell'id)
    let h = 0;
    for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    this.skin = SKIN_TONES[h % SKIN_TONES.length] ?? SKIN_TONES[0]!;

    this.view.addChild(this.body);

    this.nameLabel = new Text({ text: username, style: NAME_STYLE });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = -56;
    if (isSelf) this.nameLabel.tint = 0xffd98a;
    this.view.addChild(this.nameLabel);

    this.bubble.visible = false;
    this.view.addChild(this.bubble);

    this.redraw();
  }

  setDirection(dir: Direction): void {
    if (dir !== this.direction) {
      this.direction = dir;
      this.redraw();
    }
  }

  /** Avanza l'animazione di camminata (bob + oscillazione). dt in secondi. */
  tick(dt: number): void {
    if (this.walking) {
      this.walkPhase += dt * 10;
      this.body.y = -Math.abs(Math.sin(this.walkPhase)) * 3;
      this.body.rotation = Math.sin(this.walkPhase) * 0.04;
    } else if (this.body.y !== 0) {
      this.body.y = 0;
      this.body.rotation = 0;
      this.walkPhase = 0;
    }
  }

  say(text: string): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubble.removeChildren();
    const label = new Text({ text, style: BUBBLE_STYLE });
    label.anchor.set(0.5, 1);
    const w = Math.min(150, label.width + 14);
    const hgt = label.height + 10;
    const bg = new Graphics();
    bg.roundRect(-w / 2, -hgt, w, hgt, 8).fill({ color: 0xfdf7ec, alpha: 0.96 });
    bg.roundRect(-w / 2, -hgt, w, hgt, 8).stroke({ width: 1, color: 0xd9c8ab });
    bg.poly([-4, 0, 4, 0, 0, 5]).fill({ color: 0xfdf7ec, alpha: 0.96 });
    label.y = -5;
    this.bubble.addChild(bg, label);
    this.bubble.y = -60;
    this.bubble.visible = true;
    this.bubbleTimer = setTimeout(() => {
      this.bubble.visible = false;
    }, 5000);
  }

  destroy(): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.view.destroy({ children: true });
  }

  private redraw(): void {
    const g = this.body;
    const { body, accent } = this.colors;
    const flip = this.direction === 'O' ? -1 : 1;
    const side = this.direction === 'E' || this.direction === 'O';
    const back = this.direction === 'N';

    g.clear();
    g.scale.x = flip;

    // ombra
    g.ellipse(0, 0, 12, 6).fill({ color: P.shadow, alpha: 0.25 });

    // gambe
    g.roundRect(-7, -14, 6, 14, 3).fill(P.espresso);
    g.roundRect(1, -14, 6, 14, 3).fill(P.espresso);

    // corpo (capsula)
    g.roundRect(-10, -34, 20, 22, 9).fill(body);
    // grembiule da avventore? no: dettaglio maglia
    if (!back) {
      g.roundRect(-10, -22, 20, 4, 2).fill(accent);
    }
    // braccia
    if (side) {
      g.roundRect(2, -32, 6, 16, 3).fill(accent);
    } else {
      g.roundRect(-13, -32, 5, 16, 3).fill(accent);
      g.roundRect(8, -32, 5, 16, 3).fill(accent);
    }

    // testa
    g.circle(0, -42, 9).fill(this.skin);
    // capelli
    if (back) {
      g.moveTo(-9, -44).arc(0, -42, 9, Math.PI, 0).fill(P.espresso);
      g.rect(-9, -44, 18, 6).fill(P.espresso);
    } else {
      g.moveTo(-9, -44).arc(0, -44, 9, Math.PI, 0).fill(P.espresso);
    }

    // viso (solo se non di spalle)
    if (!back) {
      if (side) {
        g.circle(4, -42, 1.6).fill(0x2b1d12);
        g.moveTo(7, -38).quadraticCurveTo(8.5, -37, 7.5, -36).stroke({ width: 1, color: 0x8a5a3a });
      } else {
        g.circle(-3.5, -42, 1.6).fill(0x2b1d12);
        g.circle(3.5, -42, 1.6).fill(0x2b1d12);
        g.moveTo(-2, -37).quadraticCurveTo(0, -35.5, 2, -37).stroke({ width: 1, color: 0x8a5a3a });
      }
    }
  }
}
