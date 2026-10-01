import React, { useState, useEffect } from 'react';
import { audioManager } from '../core/audio';
import { Moon, Star, Lock } from 'lucide-react';

interface BedtimeLockScreenProps {
  onOpenParentGate: () => void;
}

export const BedtimeLockScreen: React.FC<BedtimeLockScreenProps> = ({
  onOpenParentGate,
}) => {
  const [garageStep, setGarageStep] = useState(0); // 0 = 차 진입, 1 = 주차 완료, 2 = 문 닫힘, 3 = 소등 완료
  const [longPressProgress, setLongPressProgress] = useState(0);

  useEffect(() => {
    // 1. 차들이 차고로 들어가는 애니메이션
    audioManager.speak('놀이 시간이 끝났어요. 차고로 가자!');

    const t1 = setTimeout(() => {
      setGarageStep(1);
      audioManager.playEngine();
    }, 1500);

    // 2. 차고 문 닫힘
    const t2 = setTimeout(() => {
      setGarageStep(2);
      audioManager.playPop(300);
    }, 3200);

    // 3. 소등 및 굿바이 인사
    const t3 = setTimeout(() => {
      setGarageStep(3);
      audioManager.playPop(200);
      audioManager.speak('오늘도 잘 놀았어! 또 만나자!');
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // 부모 게이트 3초 롱프레스 핸들러
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (longPressProgress > 0 && longPressProgress < 100) {
      timer = setTimeout(() => {
        setLongPressProgress((prev) => Math.min(100, prev + 4));
      }, 50);
    } else if (longPressProgress >= 100) {
      setLongPressProgress(0);
      onOpenParentGate();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [longPressProgress, onOpenParentGate]);

  const handlePointerDown = () => {
    setLongPressProgress(4);
    audioManager.playPop(450);
  };

  const handlePointerUp = () => {
    setLongPressProgress(0);
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 select-none transition-colors duration-1000 ${
      garageStep >= 3 ? 'bg-slate-950 text-white' : 'bg-slate-900 text-slate-100'
    }`}>
      {/* 1. 밤하늘 달님 & 별님 */}
      <div className="relative w-full flex items-center justify-between pt-4 px-2">
        <div className="flex items-center gap-2">
          <Moon className="w-12 h-12 text-amber-200 fill-amber-200 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xl md:text-2xl font-black text-amber-100">꿈나라 차고</span>
            <span className="text-xs text-slate-400">자동차들도 코오 잠잘 시간이에요</span>
          </div>
        </div>

        <div className="flex gap-3 text-amber-300">
          <Star className="w-6 h-6 fill-amber-300 animate-bounce duration-1000" />
          <Star className="w-8 h-8 fill-amber-200 animate-pulse" />
          <Star className="w-5 h-5 fill-amber-300 animate-bounce" />
        </div>
      </div>

      {/* 2. 중앙 차고 건물과 주차 애니메이션 */}
      <div className="relative w-full max-w-lg flex flex-col items-center my-auto">
        {/* 차고 지붕 */}
        <div className="w-full h-12 bg-rose-900 rounded-t-3xl border-b-4 border-rose-950 shadow-2xl flex items-center justify-center">
          <span className="text-xs font-black text-rose-200 tracking-widest">★ BUNG BUNG GARAGE ★</span>
        </div>

        {/* 3칸 차고 도어 */}
        <div className="w-full bg-slate-800 p-4 rounded-b-3xl border-4 border-slate-700 shadow-2xl grid grid-cols-3 gap-3">
          {[
            { id: 'fire', icon: '🚒', name: '소방차' },
            { id: 'police', icon: '🚓', name: '경찰차' },
            { id: 'bus', icon: '🚌', name: '노란버스' },
          ].map((bay, idx) => (
            <div
              key={bay.id}
              className={`relative h-40 rounded-2xl border-4 overflow-hidden flex flex-col items-center justify-end p-2 transition-all duration-700 ${
                garageStep >= 3 ? 'bg-black border-slate-900' : 'bg-slate-900 border-slate-600'
              }`}
            >
              {/* 차고 내부 차량 */}
              <div
                className={`text-5xl transition-all duration-1000 ${
                  garageStep >= 1
                    ? 'transform scale-90 translate-y-0 opacity-100'
                    : 'transform scale-110 translate-y-12 opacity-60'
                }`}
              >
                {bay.icon}
              </div>

              {/* 셔터 문 닫힘 오버레이 */}
              <div
                className={`absolute inset-0 bg-slate-700 border-b-4 border-slate-600 flex flex-col justify-around p-2 transition-all duration-700 ${
                  garageStep >= 2 ? 'translate-y-0 opacity-95' : '-translate-y-full opacity-0'
                }`}
              >
                <div className="w-full h-1 bg-slate-600 rounded"></div>
                <div className="w-full h-1 bg-slate-600 rounded"></div>
                <div className="w-full h-1 bg-slate-600 rounded"></div>
                <div className="w-full h-1 bg-slate-600 rounded"></div>
                <div className="text-center text-xs font-black text-amber-400">
                  {idx === 0 ? 'zzz...' : idx === 1 ? '잘 자요' : '내일 만나요'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm md:text-base font-black text-amber-200 mt-6 text-center animate-pulse">
          "오늘도 신나게 잘 놀았어! 내일 또 만나자~"
        </p>
      </div>

      {/* 3. 하단 구석 부모 게이트 3초 길게 누르기 버튼 */}
      <div className="w-full flex justify-end pb-2">
        <div className="relative">
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 text-xs font-black text-slate-300 shadow-xl active:scale-95 transition-all cursor-pointer"
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>부모 확인 (3초 꾹)</span>
          </button>

          {/* 원형 / 바 프로그레스 게이지 */}
          {longPressProgress > 0 && (
            <div className="absolute -bottom-2 inset-x-0 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${longPressProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
