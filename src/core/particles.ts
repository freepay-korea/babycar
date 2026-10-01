import { Container, Graphics, Ticker } from 'pixi.js';
import confetti from 'canvas-confetti';

export type ParticleKind = 'star' | 'drop' | 'bubble' | 'dirt' | 'smoke' | 'confetti';

interface PixiParticle {
  gfx: Graphics;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  kind: ParticleKind;
  rotationSpeed: number;
  scaleDecay: number;
}

export class ParticleEngine {
  private container: Container | null = null;
  private ticker: Ticker | null = null;
  private particles: PixiParticle[] = [];
  private isListening = false;

  public setContainer(container: Container, ticker?: Ticker) {
    this.container = container;
    this.ticker = ticker || Ticker.shared;
    if (!this.isListening && this.ticker) {
      this.ticker.add(this.update, this);
      this.isListening = true;
    }
  }

  public clear() {
    this.particles.forEach((p) => {
      if (p.gfx.parent) p.gfx.parent.removeChild(p.gfx);
      p.gfx.destroy();
    });
    this.particles = [];
  }

  public destroy() {
    if (this.isListening && this.ticker) {
      this.ticker.remove(this.update, this);
      this.isListening = false;
    }
    this.clear();
    this.container = null;
    this.ticker = null;
  }

  private update(ticker: Ticker) {
    const delta = ticker.deltaTime || 1;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      p.gfx.x += p.vx * delta;
      p.gfx.y += p.vy * delta;

      // 종류별 물리 움직임
      if (p.kind === 'drop') {
        p.vy += 0.3 * delta; // 중력
      } else if (p.kind === 'bubble') {
        p.vy -= 0.15 * delta; // 부력으로 위로 상승
        p.gfx.x += Math.sin(p.life * 0.1) * 0.8 * delta;
      } else if (p.kind === 'smoke') {
        p.vy -= 0.2 * delta; // 연기 상승
        p.vx += 0.05 * delta;
      } else if (p.kind === 'dirt') {
        p.vy += 0.35 * delta; // 무거운 흙
      } else if (p.kind === 'confetti') {
        p.vy += 0.12 * delta;
      }

      p.gfx.rotation += p.rotationSpeed * delta;
      p.gfx.scale.x = Math.max(0, p.gfx.scale.x - p.scaleDecay * delta);
      p.gfx.scale.y = Math.max(0, p.gfx.scale.y - p.scaleDecay * delta);

      const progress = p.life / p.maxLife;
      p.gfx.alpha = Math.max(0, 1 - progress);

      if (p.life >= p.maxLife || p.gfx.scale.x <= 0.05) {
        if (p.gfx.parent) p.gfx.parent.removeChild(p.gfx);
        p.gfx.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  public burst(
    x: number,
    y: number,
    kind: ParticleKind,
    count = 12,
    customContainer?: Container
  ) {
    const targetContainer = customContainer || this.container;
    if (!targetContainer) return;

    for (let i = 0; i < count; i++) {
      const gfx = new Graphics();
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 5 + 2;
      let maxLife = 35 + Math.random() * 25;
      let scaleDecay = 0.005;
      let rotationSpeed = (Math.random() - 0.5) * 0.2;

      switch (kind) {
        case 'star': {
          // 5꼭지 반짝이는 황금/노랑 별
          const starColors = [0xfbbf24, 0xf59e0b, 0xfef08a, 0xffffff];
          const color = starColors[Math.floor(Math.random() * starColors.length)];
          const r = 9 + Math.random() * 6;
          drawStar(gfx, 0, 0, 5, r, r / 2, color);
          break;
        }

        case 'drop': {
          // 파란 물방울
          const dropColors = [0x38bdf8, 0x0284c7, 0x60a5fa, 0xbae6fd];
          const color = dropColors[Math.floor(Math.random() * dropColors.length)];
          const r = 5 + Math.random() * 4;
          gfx.circle(0, 0, r).fill({ color, alpha: 0.9 });
          // 물방울 반사광
          gfx.circle(-r * 0.3, -r * 0.3, r * 0.3).fill({ color: 0xffffff, alpha: 0.8 });
          angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5; // 위쪽으로 튀어오름
          speed = Math.random() * 6 + 3;
          break;
        }

        case 'bubble': {
          // 투명한 무지개 거품
          const bubbleColors = [0x38bdf8, 0xa7f3d0, 0xfbcfe8, 0xc4b5fd];
          const color = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
          const r = 8 + Math.random() * 8;
          gfx.circle(0, 0, r).stroke({ width: 2, color, alpha: 0.85 });
          gfx.circle(-r * 0.35, -r * 0.35, r * 0.3).fill({ color: 0xffffff, alpha: 0.9 });
          speed = Math.random() * 3 + 1;
          break;
        }

        case 'dirt': {
          // 갈색 흙 덩어리
          const dirtColors = [0x78350f, 0x92400e, 0xb45309, 0xa16207];
          const color = dirtColors[Math.floor(Math.random() * dirtColors.length)];
          const r = 6 + Math.random() * 5;
          gfx.ellipse(0, 0, r, r * 0.7).fill({ color, alpha: 0.95 });
          break;
        }

        case 'smoke': {
          // 퐁퐁 배기가스 연기
          const smokeColors = [0xf1f5f9, 0xe2e8f0, 0xcbd5e1];
          const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
          const r = 10 + Math.random() * 10;
          gfx.circle(0, 0, r).fill({ color, alpha: 0.7 });
          speed = Math.random() * 2 + 1;
          scaleDecay = -0.005; // 연기는 살짝 커짐
          break;
        }

        case 'confetti': {
          // 색종이 조각
          const confettiColors = [0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0xec4899, 0x8b5cf6];
          const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
          const w = 8 + Math.random() * 6;
          const h = 6 + Math.random() * 4;
          gfx.rect(-w / 2, -h / 2, w, h).fill({ color });
          speed = Math.random() * 7 + 3;
          rotationSpeed = (Math.random() - 0.5) * 0.4;
          break;
        }
      }

      gfx.x = x;
      gfx.y = y;
      targetContainer.addChild(gfx);

      this.particles.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        life: 0,
        maxLife,
        kind,
        rotationSpeed,
        scaleDecay,
      });
    }
  }
}

// 별 그리기 헬퍼
function drawStar(
  g: Graphics,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  color: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  g.beginPath();
  g.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    g.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    g.lineTo(x, y);
    rot += step;
  }
  g.lineTo(cx, cy - outerRadius);
  g.closePath();
  g.fill({ color });
}

export const particleEngine = new ParticleEngine();

// 간편 전역 burst 함수
export function burst(
  x: number,
  y: number,
  kind: ParticleKind,
  count = 12,
  container?: Container
) {
  particleEngine.burst(x, y, kind, count, container);
}

export function triggerCelebrationConfetti() {
  confetti({
    particleCount: 70,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'],
  });
}
