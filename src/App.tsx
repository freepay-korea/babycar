/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from './core/store';
import { Home } from './app/Home';
import { ModeScreen } from './app/ModeScreen';
import { ParentGateModal } from './app/ParentGateModal';
import { SettingsModal } from './app/SettingsModal';
import { BedtimeLockScreen } from './app/BedtimeLockScreen';
import { initNativeFeatures } from './core/native';

export default function App() {
  const [currentModeId, setCurrentModeId] = useState<string | null>(null);
  const [parentGateMode, setParentGateMode] = useState<'settings' | 'exit'>('settings');

  const {
    isSleeping,
    parentGateOpen,
    settingsOpen,
    timerActive,
    setParentGateOpen,
    setSettingsOpen,
    resetBedtime,
    decrementTimer,
  } = useAppStore();

  const currentModeRef = useRef<string | null>(null);
  currentModeRef.current = currentModeId;

  // Capacitor 네이티브 기능 초기화 (상태바 숨김, 스플래시 화면 닫기, Android 뒤로가기 가로채기)
  useEffect(() => {
    initNativeFeatures({
      isHome: () => currentModeRef.current === null,
      onBackToHome: () => {
        setCurrentModeId(null);
      },
      onOpenParentExitPrompt: () => {
        setParentGateMode('exit');
        setParentGateOpen(true);
      },
    });
  }, [setParentGateOpen]);

  // 놀이 시간 타이머 1초 주기 카운트다운
  useEffect(() => {
    if (!timerActive || isSleeping) return;

    const interval = setInterval(() => {
      decrementTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, isSleeping, decrementTimer]);

  const handleOpenParentGate = () => {
    setParentGateMode('settings');
    setParentGateOpen(true);
  };

  const handleParentGateSuccess = () => {
    setParentGateOpen(false);
    if (isSleeping) {
      resetBedtime();
    }
    setSettingsOpen(true);
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-sky-300 select-none touch-none">
      {/* 타이머 종료 시 차고로 가자(잠자기 잠금 화면) */}
      {isSleeping ? (
        <BedtimeLockScreen onOpenParentGate={handleOpenParentGate} />
      ) : currentModeId ? (
        <ModeScreen
          modeId={currentModeId}
          onBack={() => setCurrentModeId(null)}
        />
      ) : (
        <Home
          onSelectMode={(modeId) => setCurrentModeId(modeId)}
          onOpenParentGate={handleOpenParentGate}
        />
      )}

      {/* 부모 게이트 한글 산수 퀴즈 모달 (설정 진입 또는 Android 뒤로가기 종료 확인) */}
      <ParentGateModal
        isOpen={parentGateOpen}
        mode={parentGateMode}
        onSuccess={handleParentGateSuccess}
        onClose={() => setParentGateOpen(false)}
      />

      {/* 부모 안심 설정 모달 */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
