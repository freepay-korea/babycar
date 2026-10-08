import { PlayMode, PlayModeContext } from '../types';
import { VEHICLES, VehicleData } from '../../core/vehicles';
import { burst, triggerCelebrationConfetti } from '../../core/particles';

/**
 * 보글보글 세차장
 * 1) 진흙: 차 실루엣에만 진흙이 묻어 있음. 스펀지(손가락)로 문지르면 그 자리의 진흙이 지워지고 거품이 남.
 * 2) 헹구기: 호스(손가락)로 쓸면 물줄기가 나오며 거품이 씻겨 내려감.
 * 3) 반짝: 광택이 쓱 지나가고 무지개·햇님이 뜨며 팡파레. 차가 떠나고 다음 차가 들어옴.
 */

type Stage = 'mud' | 'rinse' | 'shine' | 'leave';

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
}

const SPONGE_ICON = `
<svg viewBox="0 0 40 40" class="w-7 h-7">
  <rect x="4" y="9" width="32" height="22" rx="6" fill="#facc15"/>
  <rect x="4" y="22" width="32" height="9" rx="4" fill="#4ade80"/>
  <circle cx="12" cy="15" r="2" fill="#eab308"/><circle cx="22" cy="18" r="2.5" fill="#eab308"/><circle cx="30" cy="14" r="1.8" fill="#eab308"/>
</svg>`;
const HOSE_ICON = `
<svg viewBox="0 0 40 40" class="w-7 h-7">
  <rect x="6" y="14" width="16" height="12" rx="4" fill="#64748b"/>
  <rect x="20" y="12" width="8" height="16" rx="2" fill="#334155"/>
  <path d="M30 14 L37 9 M30 20 L38 20 M30 26 L37 31" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
  <circle cx="36" cy="14" r="2" fill="#7dd3fc"/><circle cx="36" cy="26" r="2" fill="#7dd3fc"/>
</svg>`;
const SHINE_ICON = `
<svg viewBox="0 0 40 40" class="w-7 h-7">
  <path d="M20 4 L23 16 L35 20 L23 24 L20 36 L17 24 L5 20 L17 16 Z" fill="#fde047"/>
  <path d="M31 6 L32.5 10 L36.5 11.5 L32.5 13 L31 17 L29.5 13 L25.5 11.5 L29.5 10 Z" fill="#fef9c3"/>
</svg>`;

const RAINBOW_SVG = `
<svg viewBox="0 0 400 210" class="w-full h-full">
  <defs>
    <radialGradient id="sunglow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fde047" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#fde047" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#8b5cf6']
    .map((c, i) => `<path d="M ${20 + i * 14} 200 A ${180 - i * 14} ${180 - i * 14} 0 0 1 ${380 - i * 14} 200" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round"/>`)
    .join('')}
  <circle cx="330" cy="60" r="60" fill="url(#sunglow)"/>
  <circle cx="330" cy="60" r="28" fill="#fde047"/>
  <circle cx="321" cy="56" r="3.5" fill="#1e293b"/><circle cx="339" cy="56" r="3.5" fill="#1e293b"/>
  <path d="M320 66 Q330 74 340 66" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="314" cy="64" r="4" fill="#fb7185" opacity="0.6"/><circle cx="346" cy="64" r="4" fill="#fb7185" opacity="0.6"/>
  <g fill="#ffffff" opacity="0.95">
    <ellipse cx="70" cy="70" rx="34" ry="18"/><circle cx="52" cy="66" r="16"/><circle cx="82" cy="58" r="20"/>
  </g>
</svg>`;

export const carWashMode: PlayMode = {
  id: 'car-wash',
  title: '보글보글 세차장',
  icon: '🧼',
  color: '#06b6d4',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => !isCleanedUp && fn(), ms));
    };

    let vehicleIndex = 0;
    let currentVehicle: VehicleData = VEHICLES[vehicleIndex];
    let stage: Stage = 'mud';
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ==========================================
    // DOM
    // ==========================================
    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col items-center justify-between p-3 pt-24 overflow-hidden bg-gradient-to-b from-sky-400 via-sky-200 to-cyan-100 select-none touch-none';

    // 배경 장식: 구름, 세차장 간판 느낌의 띠
    const decor = document.createElement('div');
    decor.className = 'absolute inset-0 pointer-events-none overflow-hidden';
    decor.innerHTML = `
      <div class="absolute top-28 -left-10 w-40 h-14 bg-white/80 rounded-full blur-[1px]"></div>
      <div class="absolute top-36 right-6 w-28 h-10 bg-white/70 rounded-full"></div>
      <div class="absolute bottom-0 inset-x-0 h-28 bg-cyan-300/60"></div>
      <div class="absolute bottom-24 inset-x-0 h-3 bg-white/60"></div>
    `;
    container.appendChild(decor);

    // 단계 표시 (그림 아이콘)
    const header = document.createElement('div');
    header.className =
      'relative z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md py-2 px-3 rounded-3xl border-3 border-cyan-300 shadow-xl';
    const stepEl = (key: Stage, icon: string) =>
      `<div data-step="${key}" class="w-14 h-14 rounded-2xl flex items-center justify-center transition-all">${icon}</div>`;
    header.innerHTML = `${stepEl('mud', SPONGE_ICON)}<span class="text-cyan-300 font-black text-xl">›</span>${stepEl('rinse', HOSE_ICON)}<span class="text-cyan-300 font-black text-xl">›</span>${stepEl('shine', SHINE_ICON)}`;
    container.appendChild(header);

    const updateSteps = () => {
      header.querySelectorAll<HTMLElement>('[data-step]').forEach((n) => {
        const key = n.dataset.step as Stage;
        const order: Stage[] = ['mud', 'rinse', 'shine'];
        const cur = stage === 'leave' ? 'shine' : stage;
        const idx = order.indexOf(key);
        const curIdx = order.indexOf(cur);
        n.className = `w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
          idx === curIdx ? 'bg-amber-300 scale-110 shadow-md ring-3 ring-amber-200' : idx < curIdx ? 'bg-emerald-100 opacity-80' : 'bg-gray-100 opacity-40'
        }`;
      });
    };

    // 무대
    const stageBay = document.createElement('div');
    stageBay.className = 'relative z-10 flex-1 w-full max-w-2xl flex items-center justify-center my-auto touch-none';

    const rainbowEl = document.createElement('div');
    rainbowEl.className =
      'absolute left-1/2 -translate-x-1/2 top-0 w-[22rem] md:w-[28rem] aspect-[400/210] pointer-events-none transition-all duration-700 opacity-0 scale-50';
    rainbowEl.innerHTML = RAINBOW_SVG;
    stageBay.appendChild(rainbowEl);

    // 차 카드: 차 그림 + 진흙/거품 캔버스
    const vehicleCard = document.createElement('div');
    vehicleCard.className = 'vehicle-unit relative w-80 h-52 md:w-[28rem] md:h-72 transition-transform duration-700 ease-out';
    const svgHolder = document.createElement('div');
    svgHolder.className = 'absolute inset-0 drop-shadow-2xl';
    const carCanvas = document.createElement('canvas');
    carCanvas.className = 'absolute inset-0 w-full h-full pointer-events-none';
    vehicleCard.appendChild(svgHolder);
    vehicleCard.appendChild(carCanvas);
    stageBay.appendChild(vehicleCard);

    // 효과 캔버스 (스펀지/호스 커서, 물줄기, 광택)
    const fxCanvas = document.createElement('canvas');
    fxCanvas.className = 'absolute inset-0 w-full h-full pointer-events-none z-20';
    stageBay.appendChild(fxCanvas);
    container.appendChild(stageBay);

    // 진행 바
    const footer = document.createElement('div');
    footer.className = 'relative z-20 w-64 h-5 bg-white/80 rounded-full overflow-hidden border-2 border-cyan-300 shadow';
    footer.innerHTML = `<div data-bar class="h-full bg-amber-500 rounded-full transition-all duration-200" style="width:100%"></div>`;
    container.appendChild(footer);
    const bar = footer.querySelector('[data-bar]') as HTMLElement;
    const setBar = (ratio: number, color: string) => {
      bar.style.width = `${Math.round(ratio * 100)}%`;
      bar.className = `h-full ${color} rounded-full transition-all duration-200`;
    };

    el.appendChild(container);

    // ==========================================
    // 캔버스 레이어
    // ==========================================
    const cctx = carCanvas.getContext('2d')!;
    const fctx = fxCanvas.getContext('2d')!;
    const mask = document.createElement('canvas'); // 차 실루엣
    const mud = document.createElement('canvas');
    const foam = document.createElement('canvas');
    const mctx = mask.getContext('2d')!;
    const mudCtx = mud.getContext('2d')!;
    const foamCtx = foam.getContext('2d')!;
    let W = 0;
    let H = 0; // 차 캔버스 크기(기기 px)
    let maskAlpha: Uint8ClampedArray | null = null; // 저해상도 실루엣 (거품을 차 위에만)
    const LOW = 4;
    let lowW = 0;
    let lowH = 0;
    let mudInitial = 1;
    let foamPeak = 1;
    let strokeCount = 0;

    const drops: Drop[] = [];
    let pointer: { x: number; y: number; down: boolean } | null = null; // fx 캔버스 좌표(css px)
    let shineT = -1; // 광택 애니메이션 진행(0~1), -1이면 꺼짐
    let maskReady = false;

    const sizeCanvases = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = vehicleCard.clientWidth || 320;
      const ch = vehicleCard.clientHeight || 208;
      W = Math.round(cw * dpr);
      H = Math.round(ch * dpr);
      [carCanvas, mask, mud, foam].forEach((c) => {
        c.width = W;
        c.height = H;
      });
      const sw = stageBay.clientWidth || 320;
      const sh = stageBay.clientHeight || 300;
      fxCanvas.width = Math.round(sw * dpr);
      fxCanvas.height = Math.round(sh * dpr);
      lowW = Math.ceil(W / LOW);
      lowH = Math.ceil(H / LOW);
    };

    // SVG → 실루엣 마스크 (viewBox 160x100, meet 정렬과 같은 배치)
    const buildMask = (v: VehicleData) =>
      new Promise<void>((resolve) => {
        maskReady = false;
        const svgText = v.svg
          .replace(/<svg([^>]*)>/, '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"$1>')
          .replace(/class="[^"]*"/g, '');
        const img = new Image();
        img.onload = () => {
          mctx.clearRect(0, 0, W, H);
          const s = Math.min(W / 160, H / 100);
          const ox = (W - 160 * s) / 2;
          const oy = (H - 100 * s) / 2;
          mctx.drawImage(img, ox, oy, 160 * s, 100 * s);
          // 저해상도 알파 샘플
          const low = document.createElement('canvas');
          low.width = lowW;
          low.height = lowH;
          const lctx = low.getContext('2d')!;
          lctx.drawImage(mask, 0, 0, lowW, lowH);
          maskAlpha = lctx.getImageData(0, 0, lowW, lowH).data;
          maskReady = true;
          resolve();
        };
        img.onerror = () => {
          // 실패해도 놀이는 되게: 카드 전체를 차로 간주
          mctx.fillStyle = '#000';
          mctx.beginPath();
          mctx.ellipse(W / 2, H / 2, W * 0.42, H * 0.36, 0, 0, Math.PI * 2);
          mctx.fill();
          maskAlpha = null;
          maskReady = true;
          resolve();
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      });

    const onCar = (x: number, y: number) => {
      if (!maskAlpha) return true;
      const ix = Math.max(0, Math.min(lowW - 1, Math.floor(x / dpr / (W / dpr) * lowW)));
      const iy = Math.max(0, Math.min(lowH - 1, Math.floor(y / dpr / (H / dpr) * lowH)));
      return maskAlpha[(iy * lowW + ix) * 4 + 3] > 40;
    };

    // 진흙 칠하기: 큼직한 흙탕 얼룩 + 튄 자국, 실루엣 안에만
    const paintMud = () => {
      const g = mudCtx;
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      const browns = ['#78350f', '#92400e', '#6b3410', '#a16207'];
      for (let i = 0; i < 26; i++) {
        const x = W * (0.1 + Math.random() * 0.8);
        const y = H * (0.2 + Math.random() * 0.7);
        const rx = W * (0.06 + Math.random() * 0.09);
        const ry = rx * (0.5 + Math.random() * 0.5);
        g.fillStyle = browns[i % browns.length];
        g.globalAlpha = 0.85 + Math.random() * 0.15;
        g.beginPath();
        g.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      // 튄 자국
      g.globalAlpha = 0.9;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = browns[i % browns.length];
        g.beginPath();
        g.arc(Math.random() * W, H * (0.3 + Math.random() * 0.7), 2 * dpr + Math.random() * 5 * dpr, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0);
      g.globalCompositeOperation = 'source-over';
      mudInitial = Math.max(1, countAlpha(mud));
      foamCtx.clearRect(0, 0, W, H);
      foamPeak = 1;
    };

    const sampler = document.createElement('canvas');
    const countAlpha = (src: HTMLCanvasElement) => {
      sampler.width = 64;
      sampler.height = 40;
      const s = sampler.getContext('2d')!;
      s.clearRect(0, 0, 64, 40);
      s.drawImage(src, 0, 0, 64, 40);
      const d = s.getImageData(0, 0, 64, 40).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++;
      return n;
    };

    const composite = () => {
      cctx.clearRect(0, 0, W, H);
      cctx.drawImage(mud, 0, 0);
      cctx.drawImage(foam, 0, 0);
    };

    // 스펀지로 문지르기 (차 캔버스 좌표, 기기 px)
    const scrub = (x: number, y: number) => {
      const R = Math.max(W, H) * 0.09;
      const g = mudCtx;
      g.globalCompositeOperation = 'destination-out';
      const grad = g.createRadialGradient(x, y, R * 0.2, x, y, R);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';

      // 거품: 차 위에서만, 크기가 다른 보글보글 방울 몇 개
      const f = foamCtx;
      for (let i = 0; i < 2; i++) {
        const bx = x + (Math.random() - 0.5) * R * 1.6;
        const by = y + (Math.random() - 0.5) * R * 1.2;
        if (!onCar(bx, by)) continue;
        const r = R * (0.2 + Math.random() * 0.35);
        f.beginPath();
        f.arc(bx, by, r, 0, Math.PI * 2);
        f.fillStyle = 'rgba(255,255,255,0.88)';
        f.fill();
        f.lineWidth = 1.5 * dpr;
        f.strokeStyle = 'rgba(125,211,252,0.7)';
        f.stroke();
        f.beginPath();
        f.arc(bx - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2);
        f.fillStyle = 'rgba(255,255,255,1)';
        f.fill();
      }
    };

    // 호스로 헹구기
    const rinse = (x: number, y: number) => {
      const R = Math.max(W, H) * 0.13;
      const f = foamCtx;
      f.globalCompositeOperation = 'destination-out';
      const grad = f.createRadialGradient(x, y, R * 0.1, x, y, R);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = grad;
      f.beginPath();
      f.arc(x, y, R, 0, Math.PI * 2);
      f.fill();
      f.globalCompositeOperation = 'source-over';
    };

    // ==========================================
    // 터치
    // ==========================================
    let activePointer: number | null = null;
    const toCar = (e: PointerEvent) => {
      const r = vehicleCard.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, inside: e.clientX >= r.left - 30 && e.clientX <= r.right + 30 && e.clientY >= r.top - 30 && e.clientY <= r.bottom + 30 };
    };
    const toFx = (e: PointerEvent) => {
      const r = stageBay.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const handleStroke = (e: PointerEvent) => {
      if (!maskReady || (stage !== 'mud' && stage !== 'rinse')) return;
      const p = toCar(e);
      const f = toFx(e);
      pointer = { x: f.x, y: f.y, down: true };
      if (!p.inside) return;

      if (stage === 'mud') {
        scrub(p.x, p.y);
        if (ctx.audio.throttle('wash-bubble', 120)) {
          ctx.audio.playBubble();
          ctx.audio.triggerHaptic(10);
          burst(e.clientX, e.clientY - 10, 'bubble', 2);
        }
      } else {
        rinse(p.x, p.y);
        // 물줄기 방울
        for (let i = 0; i < 3; i++) {
          drops.push({ x: f.x + (Math.random() - 0.5) * 20, y: f.y, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3, r: 2 + Math.random() * 3, life: 0, max: 25 + Math.random() * 15 });
        }
        if (ctx.audio.throttle('wash-water', 180)) {
          ctx.audio.playWater();
          ctx.audio.triggerHaptic(12);
        }
      }
      composite();
      vehicleCard.style.transform = `rotate(${(Math.random() - 0.5) * 1.2}deg) scale(1.01)`;

      strokeCount++;
      if (strokeCount % 5 === 0) checkProgress();
    };

    const checkProgress = () => {
      if (stage === 'mud') {
        const ratio = countAlpha(mud) / mudInitial;
        setBar(ratio, 'bg-amber-500');
        foamPeak = Math.max(foamPeak, countAlpha(foam));
        if (ratio < 0.15) {
          // 남은 진흙 싹 지우고 헹구기 단계로
          mudCtx.clearRect(0, 0, W, H);
          composite();
          stage = 'rinse';
          updateSteps();
          setBar(1, 'bg-sky-500');
          ctx.audio.playDing();
          ctx.audio.speak('이제 물로 깨끗하게 헹궈요!');
        }
      } else if (stage === 'rinse') {
        const ratio = countAlpha(foam) / foamPeak;
        setBar(ratio, 'bg-sky-500');
        if (ratio < 0.15) {
          foamCtx.clearRect(0, 0, W, H);
          composite();
          finish();
        }
      }
    };

    const onDown = (e: PointerEvent) => {
      if (activePointer !== null) return;
      activePointer = e.pointerId;
      handleStroke(e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      handleStroke(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      pointer = pointer ? { ...pointer, down: false } : null;
      vehicleCard.style.transform = '';
      checkProgress();
    };
    stageBay.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // ==========================================
    // 효과 캔버스 루프 (스펀지/호스 커서, 물방울, 광택)
    // ==========================================
    let raf = 0;
    const drawTool = (x: number, y: number) => {
      const g = fctx;
      g.save();
      g.translate(x * dpr, y * dpr);
      g.scale(dpr, dpr);
      if (stage === 'mud') {
        g.rotate(-0.25);
        g.fillStyle = '#facc15';
        roundRect(g, -30, -22, 60, 40, 10);
        g.fill();
        g.fillStyle = '#4ade80';
        roundRect(g, -30, 4, 60, 14, 6);
        g.fill();
        g.fillStyle = '#eab308';
        [[-16, -10, 3], [2, -4, 4], [18, -12, 3], [-4, -14, 2.5]].forEach(([hx, hy, hr]) => {
          g.beginPath();
          g.arc(hx, hy, hr, 0, Math.PI * 2);
          g.fill();
        });
      } else if (stage === 'rinse') {
        g.rotate(0.6);
        g.fillStyle = '#64748b';
        roundRect(g, -28, -10, 30, 20, 6);
        g.fill();
        g.fillStyle = '#334155';
        roundRect(g, -2, -12, 14, 24, 4);
        g.fill();
        g.strokeStyle = 'rgba(56,189,248,0.9)';
        g.lineWidth = 4;
        g.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(14, i * 6);
          g.lineTo(34 + Math.random() * 10, i * 14);
          g.stroke();
        }
      }
      g.restore();
    };

    const loop = () => {
      if (isCleanedUp) return;
      raf = requestAnimationFrame(loop);
      const g = fctx;
      g.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

      // 물방울
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life++;
        d.vy += 0.25;
        d.x += d.vx;
        d.y += d.vy;
        if (d.life > d.max) {
          drops.splice(i, 1);
          continue;
        }
        g.globalAlpha = 1 - d.life / d.max;
        g.fillStyle = '#38bdf8';
        g.beginPath();
        g.ellipse(d.x * dpr, d.y * dpr, d.r * dpr, d.r * 1.6 * dpr, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;

      // 광택 쓸기
      if (shineT >= 0) {
        shineT += 0.025;
        const r = vehicleCard.getBoundingClientRect();
        const s = stageBay.getBoundingClientRect();
        const x0 = (r.left - s.left) * dpr;
        const y0 = (r.top - s.top) * dpr;
        const w = r.width * dpr;
        const h = r.height * dpr;
        const px = x0 + (shineT * 1.4 - 0.2) * w;
        const grad = g.createLinearGradient(px - w * 0.15, 0, px + w * 0.15, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.save();
        g.beginPath();
        g.rect(x0, y0, w, h);
        g.clip();
        g.fillStyle = grad;
        g.fillRect(x0, y0, w, h);
        g.restore();
        if (shineT >= 1) shineT = -1;
      }

      if (pointer?.down) drawTool(pointer.x, pointer.y);
    };
    raf = requestAnimationFrame(loop);

    // ==========================================
    // 차 세팅 / 완료 / 교체
    // ==========================================
    const renderVehicle = async (v: VehicleData) => {
      svgHolder.innerHTML = v.svg;
      sizeCanvases();
      await buildMask(v);
      if (isCleanedUp) return;
      paintMud();
      composite();
      setBar(1, 'bg-amber-500');
    };

    const finish = () => {
      stage = 'shine';
      updateSteps();
      setBar(1, 'bg-emerald-500');
      shineT = 0;
      ctx.audio.playDing(1318);
      later(() => {
        ctx.audio.playFanfare();
        ctx.audio.speak('와! 반짝반짝 깨끗해졌어요!');
        triggerCelebrationConfetti();
        rainbowEl.style.opacity = '1';
        rainbowEl.style.transform = 'translateX(-50%) scale(1)';
        const r = vehicleCard.getBoundingClientRect();
        burst(r.left + r.width * 0.3, r.top + r.height * 0.3, 'star', 10);
        burst(r.left + r.width * 0.7, r.top + r.height * 0.4, 'star', 10);
      }, 500);

      // 차 퇴장 → 다음 차 입장
      later(() => {
        stage = 'leave';
        ctx.audio.playHorn();
        ctx.audio.playEngine();
        vehicleCard.style.transition = 'transform 0.9s ease-in';
        vehicleCard.style.transform = 'translateX(120vw) rotate(2deg)';
      }, 2600);
      later(async () => {
        vehicleIndex = (vehicleIndex + 1) % VEHICLES.length;
        currentVehicle = VEHICLES[vehicleIndex];
        rainbowEl.style.opacity = '0';
        rainbowEl.style.transform = 'translateX(-50%) scale(0.5)';
        vehicleCard.style.transition = 'none';
        vehicleCard.style.transform = 'translateX(-120vw)';
        await renderVehicle(currentVehicle);
        if (isCleanedUp) return;
        later(() => {
          vehicleCard.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.3, 0.64, 1)';
          vehicleCard.style.transform = 'translateX(0)';
          stage = 'mud';
          updateSteps();
          ctx.audio.playHorn();
          ctx.audio.speak(`${currentVehicle.name}${hasBatchim(currentVehicle.name) ? '이' : '가'} 왔어요! 깨끗이 씻어 줄까요?`);
        }, 60);
      }, 3600);
    };

    const ro = new ResizeObserver(() => {
      if (!maskReady) return;
      // 크기가 바뀌면 다시 깔끔히 시작 (진행 중 그림은 비율만 유지)
      const snapshotMud = mud.toDataURL();
      const snapshotFoam = foam.toDataURL();
      sizeCanvases();
      buildMask(currentVehicle).then(() => {
        const im = new Image();
        im.onload = () => {
          mudCtx.drawImage(im, 0, 0, W, H);
          const fm = new Image();
          fm.onload = () => {
            foamCtx.drawImage(fm, 0, 0, W, H);
            composite();
          };
          fm.src = snapshotFoam;
        };
        im.src = snapshotMud;
      });
    });
    ro.observe(vehicleCard);

    updateSteps();
    renderVehicle(currentVehicle).then(() => {
      if (!isCleanedUp) later(() => ctx.audio.speak('스펀지로 흙을 쓱쓱 닦아 주세요!'), 400);
    });

    return () => {
      isCleanedUp = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      stageBay.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      container.remove();
    };
  },
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 한글 받침 여부 (이/가 조사 선택)
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}
