import React, { useState, useEffect } from 'react';
import { getAllModes } from '../modes/registry';
import { audioManager } from '../core/audio';
import { useAppStore } from '../core/store';
import { Volume2, VolumeX, Mic, MicOff, Settings } from 'lucide-react';

interface HomeProps {
  onSelectMode: (modeId: string) => void;
  onOpenParentGate: () => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectMode, onOpenParentGate }) => {
  const modes = getAllModes();
  const sfxOn = useAppStore((s) => s.soundEnabled);
  const ttsOn = useAppStore((s) => s.voiceEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled);
  const [clickedModeId, setClickedModeId] = useState<string | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);

  // 톱니바퀴 3초 롱프레스 타이머
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (longPressProgress > 0 && longPressProgress < 100) {
      // 50ms마다 100/60씩 → 약 3초
      timer = setTimeout(() => {
        setLongPressProgress((prev) => Math.min(100, prev + 100 / 60));
      }, 50);
    } else if (longPressProgress >= 100) {
      setLongPressProgress(0);
      audioManager.playDing(880);
      onOpenParentGate();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [longPressProgress, onOpenParentGate]);

  const handleModeClick = (modeId: string, title: string) => {
    if (clickedModeId) return; // 연타 방지
    setClickedModeId(modeId);
    audioManager.playPop(580);
    audioManager.speak(title);

    setTimeout(() => {
      onSelectMode(modeId);
      setClickedModeId(null);
    }, 280);
  };

  const toggleSfx = () => {
    const next = !sfxOn;
    toggleSound();
    if (next) audioManager.playPop(500);
  };

  const toggleTts = () => {
    const next = !ttsOn;
    setVoiceEnabled(next);
    if (next) audioManager.speak('목소리를 켰어요');
  };

  const handleSettingsDown = () => {
    setLongPressProgress(1);
    audioManager.playPop(480);
  };

  const handleSettingsUp = () => {
    setLongPressProgress(0);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-sky-400 via-sky-200 to-sky-100 select-none">
      {/* 1. 배경 애니메이션 요소 (해, 구름, 언덕, 달리는 버스) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 방긋 웃는 해 */}
        <div className="absolute top-4 right-5 sm:top-8 sm:right-12 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-amber-300 border-4 border-amber-200 shadow-2xl flex items-center justify-center text-4xl sm:text-5xl animate-spin duration-10000" style={{ animationDuration: '24s' }}>
          ☀️
        </div>

        {/* 둥실둥실 구름들 */}
        <div className="absolute top-12 -left-12 text-6xl opacity-90 animate-cloud-slow">
          ☁️
        </div>
        <div className="absolute top-24 -left-20 text-5xl opacity-80 animate-cloud-medium">
          ☁️
        </div>
        <div className="absolute top-6 left-1/3 text-7xl opacity-85 animate-cloud-fast">
          ☁️
        </div>

        {/* 초록 언덕 배경 */}
        <div className="absolute bottom-24 inset-x-0 h-36 bg-emerald-400 rounded-t-[100%] scale-110 opacity-70"></div>
        <div className="absolute bottom-20 inset-x-0 h-32 bg-emerald-500 rounded-t-[100%] scale-105"></div>

        {/* 도로 배경 */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-slate-700 border-t-4 border-slate-600 flex items-center overflow-hidden">
          {/* 도로 중앙 황색 점선 */}
          <div className="w-full flex gap-8 justify-center">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="w-12 h-3 rounded-full bg-amber-400 shrink-0"></div>
            ))}
          </div>

          {/* 도로 위를 계속 지나가는 노란 버스 */}
          <div className="absolute bottom-2 text-6xl md:text-7xl animate-bus-drive">
            🚌
          </div>
        </div>
      </div>

      {/* 2. 상단 바: 타이틀 및 사운드/TTS 토글 버튼 + 부모 톱니바퀴 버튼 */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-4">
        {/* 타이틀 배지 */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-3xl border-3 border-amber-300 shadow-lg">
          <span className="text-2xl animate-bounce">🎈</span>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight">
            부릉부릉 놀이터
          </h1>
        </div>

        {/* 우측 사운드 & 부모 게이트 톱니바퀴 버튼 */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTts}
            aria-label="음성 안내 켜기/끄기"
            className={`w-12 h-12 md:w-13 md:h-13 rounded-2xl flex items-center justify-center border-3 shadow-md transition-all active:scale-90 cursor-pointer ${
              ttsOn
                ? 'bg-amber-400 border-amber-300 text-amber-950'
                : 'bg-white/80 border-gray-300 text-gray-400'
            }`}
          >
            {ttsOn ? <Mic className="w-6 h-6 stroke-[2.5]" /> : <MicOff className="w-6 h-6 stroke-[2.5]" />}
          </button>

          <button
            onClick={toggleSfx}
            aria-label="효과음 켜기/끄기"
            className={`w-12 h-12 md:w-13 md:h-13 rounded-2xl flex items-center justify-center border-3 shadow-md transition-all active:scale-90 cursor-pointer ${
              sfxOn
                ? 'bg-emerald-400 border-emerald-300 text-emerald-950'
                : 'bg-white/80 border-gray-300 text-gray-400'
            }`}
          >
            {sfxOn ? <Volume2 className="w-6 h-6 stroke-[2.5]" /> : <VolumeX className="w-6 h-6 stroke-[2.5]" />}
          </button>

          {/* 톱니바퀴 부모 게이트 버튼 (3초 꾹 누름) */}
          <div className="relative">
            <button
              onPointerDown={handleSettingsDown}
              onPointerUp={handleSettingsUp}
              onPointerLeave={handleSettingsUp}
              onPointerCancel={handleSettingsUp}
              aria-label="부모 설정 (3초 누름)"
              className="w-12 h-12 md:w-13 md:h-13 rounded-2xl flex items-center justify-center bg-white/90 hover:bg-white border-3 border-amber-300 text-slate-700 shadow-md transition-all active:scale-90 cursor-pointer relative overflow-hidden"
            >
              <Settings className="w-6 h-6 stroke-[2.2]" />

              {/* 3초 게이지 채움 오버레이 */}
              {longPressProgress > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-amber-400/70 transition-all duration-75 pointer-events-none"
                  style={{ height: `${longPressProgress}%` }}
                />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. 모드별 큰 색 버튼 목록 */}
      <main className="relative z-20 w-full max-w-4xl mx-auto px-4 my-auto py-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
          {modes.map((mode) => {
            const isPressed = clickedModeId === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeClick(mode.id, mode.title)}
                style={{ borderColor: mode.color }}
                className={`relative min-h-[96px] sm:min-h-[120px] rounded-3xl p-3 sm:p-4 bg-white/95 backdrop-blur-md border-4 shadow-xl flex items-center sm:flex-col justify-center gap-3 transition-all duration-200 cursor-pointer active:scale-90 ${
                  isPressed ? 'scale-110 shadow-2xl ring-4 ring-white' : 'hover:scale-102'
                }`}
              >
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-md"
                  style={{ backgroundColor: `${mode.color}25` }}
                >
                  <span className="drop-shadow-sm">{mode.icon}</span>
                </div>

                <span className="text-lg sm:text-xl font-black text-gray-800 text-left sm:text-center leading-tight">
                  {mode.title}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {/* 4. 하단 안내 텍스트 */}
      <footer className="relative z-20 pb-2 text-center">
        <span className="inline-block bg-white/85 backdrop-blur-sm text-xs font-bold text-slate-700 px-4 py-1.5 rounded-full shadow border border-white">
          🌈 마음에 드는 놀이를 콕 터치해 보세요! (톱니바퀴 3초 꾹 ➜ 부모 설정)
        </span>
      </footer>
    </div>
  );
};
