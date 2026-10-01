import { Application, Container, Graphics } from 'pixi.js';
import { PlayMode, PlayModeContext } from '../types';
import { getVehicleById } from '../../core/vehicles';
import { triggerCelebrationConfetti } from '../../core/particles';

export const driveMode: PlayMode = {
  id: 'drive',
  title: '부릉부릉 드라이브',
  subtitle: '길을 따라 신나게 달려요!',
  icon: '🚗',
  color: '#3b82f6',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    let app: Application | null = null;
    let animId: number | null = null;

    const vehicle = getVehicleById(ctx.vehicleId || 'fire-truck');

    // Pixi App 및 인터랙티브 컨테이너 생성
    const initPixi = async () => {
      app = new Application();
      await app.init({
        resizeTo: el,
        backgroundColor: 0x7dd3fc, // 맑고 밝은 하늘색
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isCleanedUp) {
        app.destroy(true, { children: true });
        return;
      }

      el.appendChild(app.canvas);

      const stage = app.stage;
      const width = el.clientWidth || window.innerWidth;
      const height = el.clientHeight || window.innerHeight;

      // 1. 배경 구름 컨테이너
      const cloudsContainer = new Container();
      stage.addChild(cloudsContainer);

      // 구름 생성 함수
      const createCloud = (x: number, y: number, scale = 1) => {
        const cloud = new Graphics();
        cloud.circle(0, 0, 30 * scale);
        cloud.circle(25 * scale, -10 * scale, 25 * scale);
        cloud.circle(50 * scale, 0, 28 * scale);
        cloud.rect(-10 * scale, 0, 70 * scale, 25 * scale);
        cloud.fill({ color: 0xffffff, alpha: 0.9 });
        cloud.x = x;
        cloud.y = y;
        cloud.eventMode = 'static';
        cloud.cursor = 'pointer';
        cloud.on('pointerdown', () => {
          ctx.audio.playPop(700 + Math.random() * 200);
          cloud.scale.set(scale * 1.25);
          setTimeout(() => {
            if (!isCleanedUp) cloud.scale.set(scale);
          }, 200);
        });
        cloudsContainer.addChild(cloud);
        return cloud;
      };

      const clouds = [
        createCloud(width * 0.15, height * 0.15, 1.2),
        createCloud(width * 0.5, height * 0.1, 0.9),
        createCloud(width * 0.85, height * 0.18, 1.1),
      ];

      // 2. 푸른 언덕 배경
      const hillGraphics = new Graphics();
      hillGraphics.ellipse(width * 0.3, height * 0.75, width * 0.5, height * 0.35);
      hillGraphics.fill({ color: 0x86efac });
      hillGraphics.ellipse(width * 0.8, height * 0.78, width * 0.6, height * 0.38);
      hillGraphics.fill({ color: 0x4ade80 });
      stage.addChild(hillGraphics);

      // 3. 아스팔트 도로
      const roadY = height * 0.68;
      const roadHeight = height * 0.28;
      const road = new Graphics();
      road.rect(0, roadY, width, roadHeight);
      road.fill({ color: 0x334155 });
      // 도로 연석 (빨강-하양 체크)
      const curbHeight = 14;
      const curbCount = Math.ceil(width / 30);
      for (let i = 0; i < curbCount; i++) {
        road.rect(i * 30, roadY - curbHeight, 30, curbHeight);
        road.fill({ color: i % 2 === 0 ? 0xef4444 : 0xffffff });
      }
      stage.addChild(road);

      // 도로 중앙 점선
      const laneContainer = new Container();
      stage.addChild(laneContainer);
      const laneMarks: Graphics[] = [];
      const laneWidth = 45;
      const laneGap = 35;
      const totalLanes = Math.ceil(width / (laneWidth + laneGap)) + 2;

      for (let i = 0; i < totalLanes; i++) {
        const mark = new Graphics();
        mark.roundRect(0, 0, laneWidth, 12, 4);
        mark.fill({ color: 0xfacc15 });
        mark.x = i * (laneWidth + laneGap);
        mark.y = roadY + roadHeight * 0.45;
        laneContainer.addChild(mark);
        laneMarks.push(mark);
      }

      // 4. 자동차 (귀여운 탈것 그래픽)
      const carContainer = new Container();
      const carY = roadY + roadHeight * 0.3;
      carContainer.x = width * 0.25;
      carContainer.y = carY;
      stage.addChild(carContainer);

      const drawVehicle = () => {
        carContainer.removeChildren();

        const vColor = parseInt(vehicle.color.replace('#', '0x'), 16) || 0xef4444;
        const vAccent = parseInt(vehicle.accentColor.replace('#', '0x'), 16) || 0xfbbf24;

        const body = new Graphics();
        // 차체 메인
        body.roundRect(-60, -35, 120, 45, 14);
        body.fill({ color: vColor });
        // 지붕 / 캡
        body.roundRect(-30, -65, 70, 36, 12);
        body.fill({ color: vColor });
        // 창문 (투명 하늘색)
        body.roundRect(-22, -60, 30, 26, 6);
        body.fill({ color: 0xe0f2fe });
        body.roundRect(14, -60, 22, 26, 6);
        body.fill({ color: 0xe0f2fe });

        // 헤드라이트 (앞)
        body.roundRect(50, -25, 14, 16, 4);
        body.fill({ color: 0xfef08a });

        // 범퍼 / 스트라이프
        body.roundRect(-58, -5, 116, 8, 3);
        body.fill({ color: vAccent });

        // 사이렌/경광등 (소방차, 경찰차 등)
        if (vehicle.soundType === 'fire' || vehicle.soundType === 'police') {
          body.roundRect(-5, -77, 20, 14, 4);
          body.fill({ color: 0xef4444 });
          body.circle(5, -70, 4);
          body.fill({ color: 0x38bdf8 });
        }

        // 바퀴 (앞뒤 2개)
        const wheel1 = new Graphics();
        wheel1.circle(0, 0, 18);
        wheel1.fill({ color: 0x1e293b });
        wheel1.circle(0, 0, 9);
        wheel1.fill({ color: 0x94a3b8 });
        wheel1.circle(0, 0, 4);
        wheel1.fill({ color: 0xffffff });
        wheel1.x = -36;
        wheel1.y = 12;

        const wheel2 = new Graphics();
        wheel2.circle(0, 0, 18);
        wheel2.fill({ color: 0x1e293b });
        wheel2.circle(0, 0, 9);
        wheel2.fill({ color: 0x94a3b8 });
        wheel2.circle(0, 0, 4);
        wheel2.fill({ color: 0xffffff });
        wheel2.x = 36;
        wheel2.y = 12;

        carContainer.addChild(body);
        carContainer.addChild(wheel1);
        carContainer.addChild(wheel2);
      };

      drawVehicle();

      // 5. 신호등 인터랙션
      const trafficLight = new Container();
      trafficLight.x = width * 0.75;
      trafficLight.y = roadY - 90;
      const pole = new Graphics();
      pole.rect(8, 50, 8, 45);
      pole.fill({ color: 0x475569 });
      const box = new Graphics();
      box.roundRect(0, 0, 24, 56, 8);
      box.fill({ color: 0x1e293b });
      // 불빛 (초록/노랑/빨강)
      const redLight = new Graphics();
      redLight.circle(12, 12, 7);
      redLight.fill({ color: 0xef4444 });
      const greenLight = new Graphics();
      greenLight.circle(12, 44, 7);
      greenLight.fill({ color: 0x22c55e });

      trafficLight.addChild(pole, box, redLight, greenLight);
      trafficLight.eventMode = 'static';
      trafficLight.cursor = 'pointer';
      trafficLight.on('pointerdown', () => {
        ctx.audio.playHorn();
        trafficLight.scale.set(1.2);
        setTimeout(() => {
          if (!isCleanedUp) trafficLight.scale.set(1.0);
        }, 200);
      });
      stage.addChild(trafficLight);

      // 애니메이션 루프
      let speed = 4;
      let targetSpeed = 4;
      let bounceTime = 0;

      const ticker = () => {
        if (isCleanedUp) return;

        // 속도 보간
        speed += (targetSpeed - speed) * 0.1;

        // 도로 차선 이동
        laneMarks.forEach((mark) => {
          mark.x -= speed;
          if (mark.x < -laneWidth) {
            mark.x += (laneWidth + laneGap) * totalLanes;
          }
        });

        // 구름 이동
        clouds.forEach((cloud, idx) => {
          cloud.x -= (speed * 0.1) * (idx + 1) * 0.5;
          if (cloud.x < -100) {
            cloud.x = width + 80;
          }
        });

        // 신호등 이동
        trafficLight.x -= speed;
        if (trafficLight.x < -60) {
          trafficLight.x = width + 150;
        }

        // 자동차 통통 바운스
        bounceTime += 0.15 * (speed / 3);
        carContainer.y = carY + Math.sin(bounceTime) * 3;

        animId = requestAnimationFrame(ticker);
      };

      animId = requestAnimationFrame(ticker);

      // 속도 조절 노출
      (el as unknown as { boostSpeed: () => void; honk: () => void }).boostSpeed = () => {
        targetSpeed = 12;
        ctx.audio.playEngineRev();
        ctx.audio.triggerHaptic(30);
        setTimeout(() => {
          targetSpeed = 4;
        }, 1200);
      };

      (el as unknown as { boostSpeed: () => void; honk: () => void }).honk = () => {
        ctx.audio.playHorn();
        ctx.audio.triggerHaptic(20);
        // 자동차가 위로 뿅 점프!
        carContainer.y = carY - 24;
        setTimeout(() => {
          if (!isCleanedUp) carContainer.y = carY;
        }, 220);
      };
    };

    initPixi();

    // 상호작용 UI 생성 (하단 큰 터치 버튼: 빵빵! & 부릉부릉 가자!)
    const controlBar = document.createElement('div');
    controlBar.className =
      'absolute bottom-4 left-0 right-0 px-4 flex justify-center items-center gap-4 z-20 pointer-events-auto';

    // 1. 빵빵! 버튼 (최소 68px 이상, 유아 손가락에 맞춘 큰 버튼)
    const hornBtn = document.createElement('button');
    hornBtn.className =
      'w-20 h-20 md:w-24 md:h-24 rounded-full bg-amber-400 hover:bg-amber-500 active:scale-90 border-4 border-amber-200 shadow-xl flex flex-col items-center justify-center text-3xl font-bold text-amber-950 transition-transform select-none cursor-pointer';
    hornBtn.innerHTML = '<span>📢</span><span class="text-xs font-black">빵빵!</span>';
    hornBtn.onclick = (e) => {
      e.stopPropagation();
      const fn = (el as unknown as { honk?: () => void }).honk;
      if (fn) fn();
    };

    // 2. 가자! 부릉부릉 가속 페달 버튼
    const gasBtn = document.createElement('button');
    gasBtn.className =
      'px-8 h-20 md:h-24 rounded-3xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 border-4 border-emerald-200 shadow-xl flex items-center justify-center gap-3 text-2xl md:text-3xl font-black text-white transition-transform select-none cursor-pointer';
    gasBtn.innerHTML = '<span>🚀</span><span>부릉부릉!</span>';
    gasBtn.onclick = (e) => {
      e.stopPropagation();
      const fn = (el as unknown as { boostSpeed?: () => void }).boostSpeed;
      if (fn) fn();
    };

    // 3. 사이렌 / 특수기능 버튼
    const sirenBtn = document.createElement('button');
    sirenBtn.className =
      'w-20 h-20 md:w-24 md:h-24 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 border-4 border-rose-200 shadow-xl flex flex-col items-center justify-center text-3xl font-bold text-white transition-transform select-none cursor-pointer';
    sirenBtn.innerHTML = '<span>🚨</span><span class="text-xs font-black">삐뽀!</span>';
    sirenBtn.onclick = (e) => {
      e.stopPropagation();
      ctx.audio.playSiren(2);
      ctx.audio.triggerHaptic(40);
    };

    // 4. 별 축하 완주 버튼
    const finishBtn = document.createElement('button');
    finishBtn.className =
      'w-20 h-20 md:w-24 md:h-24 rounded-full bg-yellow-400 hover:bg-yellow-500 active:scale-90 border-4 border-yellow-100 shadow-xl flex flex-col items-center justify-center text-3xl font-bold text-yellow-950 transition-transform select-none cursor-pointer';
    finishBtn.innerHTML = '<span>⭐</span><span class="text-xs font-black">골인!</span>';
    finishBtn.onclick = (e) => {
      e.stopPropagation();
      ctx.audio.playFanfare();
      triggerCelebrationConfetti();
      if (ctx.onComplete) ctx.onComplete();
    };

    controlBar.appendChild(hornBtn);
    controlBar.appendChild(gasBtn);
    controlBar.appendChild(sirenBtn);
    controlBar.appendChild(finishBtn);
    el.appendChild(controlBar);

    // 전체 화면 터치해도 즐거운 빵빵 소리와 햅틱 반응 (유아 UX: 모든 터치에 즉시 반응)
    const handleScreenClick = (e: MouseEvent | TouchEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      ctx.audio.playPop(480 + Math.random() * 200);
      ctx.audio.triggerHaptic(15);
    };

    el.addEventListener('pointerdown', handleScreenClick);

    // Cleanup 함수
    return () => {
      isCleanedUp = true;
      if (animId !== null) cancelAnimationFrame(animId);
      el.removeEventListener('pointerdown', handleScreenClick);
      if (controlBar.parentElement) {
        controlBar.parentElement.removeChild(controlBar);
      }
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // safe destroy
        }
      }
    };
  },
};
