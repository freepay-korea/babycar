/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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

  // 필요한 값만 구독 (타이머가 매초 바뀌어도 App 전체가 다시 그려지지 않도록)
  const isSleeping = useAppStore((s) => s.isSleeping);
  const parentGateOpen = useAppStore((s) => s.parentGateOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const timerActive = useAppStore((s) => s.timerActive);
  const setParentGateOpen = useAppStore((s) => s.setParentGateOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const resetBedtime = useAppStore((s) => s.resetBedtime);
  const decrementTimer = useAppStore((s) => s.decrementTimer);

  const goHome = useCallback(() => setCurrentModeId(null), []);

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

  const handleOpenParentGate = useCallback(() => {
    setParentGateMode('settings');
    setParentGateOpen(true);
  }, [setParentGateOpen]);

  const handleParentGateSuccess = () => {
    setParentGateOpen(false);
    if (isSleeping) {
      resetBedtime();
      setCurrentModeId(null);
    }
    setSettingsOpen(true);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-sky-300 select-none">
      {/* 타이머 종료 시 차고로 가자(잠자기 잠금 화면) */}
      {isSleeping ? (
        <BedtimeLockScreen onOpenParentGate={handleOpenParentGate} />
      ) : currentModeId ? (
        <ModeScreen
          modeId={currentModeId}
          onBack={goHome}
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
