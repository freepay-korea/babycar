import React, { useEffect, useRef } from 'react';
import { getModeById } from '../modes/registry';
import { audioManager } from '../core/audio';
import { Home as HomeIcon } from 'lucide-react';

interface ModeScreenProps {
  modeId: string;
  onBack: () => void;
}

export const ModeScreen: React.FC<ModeScreenProps> = ({ modeId, onBack }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mode = getModeById(modeId);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // 모드는 modeId가 바뀔 때만 새로 마운트 (부모가 다시 그려져도 놀이가 초기화되지 않게)
  useEffect(() => {
    if (!mode || !mountRef.current) return;

    const el = mountRef.current;
    el.innerHTML = '';

    let cleanup: (() => void) | undefined;
    try {
      cleanup = mode.mount(el, {
        audio: audioManager,
        onBack: () => onBackRef.current(),
      });
    } catch (err) {
      console.error(`[${modeId}] mount 실패`, err);
    }

    return () => {
      try {
        cleanup?.();
      } catch (err) {
        console.error(`[${modeId}] cleanup 실패`, err);
      }
      el.innerHTML = '';
    };
  }, [mode, modeId]);

  const handleHomeClick = () => {
    audioManager.playPop(520);
    audioManager.speak('홈으로 가요');
    onBack();
  };

  if (!mode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-sky-200">
        <button
          onClick={handleHomeClick}
          className="min-w-[72px] min-h-[72px] rounded-3xl bg-rose-500 text-white font-black text-2xl shadow-xl flex items-center justify-center gap-2 px-6"
        >
          <HomeIcon className="w-8 h-8 stroke-[3]" /> 홈으로
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-50 select-none">
      {/* 왼쪽 위의 크고 선명한 집 모양 홈 버튼 (72px 이상 터치 영역) */}
      <div className="absolute top-4 left-4 z-40">
        <button
          onClick={handleHomeClick}
          aria-label="홈으로 가기"
          className="min-w-[72px] min-h-[72px] rounded-3xl bg-rose-500 hover:bg-rose-600 active:scale-90 border-4 border-white shadow-2xl flex items-center justify-center text-white cursor-pointer transition-transform"
        >
          <HomeIcon className="w-9 h-9 stroke-[2.5]" />
        </button>
      </div>

      {/* 모드 마운트 컨테이너 */}
      <div ref={mountRef} className="relative w-full h-full flex-1 overflow-hidden" />
    </div>
  );
};
