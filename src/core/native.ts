import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export interface NativeInitOptions {
  isHome: () => boolean;
  onBackToHome: () => void;
  onOpenParentExitPrompt: () => void;
}

export async function initNativeFeatures(options: NativeInitOptions) {
  // 웹 브라우저 환경에서는 무시
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // 1. 상태표시줄 숨김 (아이들을 위한 몰입형 전체화면)
  try {
    await StatusBar.hide();
  } catch (e) {
    console.warn('StatusBar.hide failed:', e);
  }

  // 2. 스플래시 화면 닫기
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.warn('SplashScreen.hide failed:', e);
  }

  // 3. Android 하드웨어 뒤로가기 버튼 가로채기
  // 놀이 모드일 때는 홈 화면으로만 돌아가며,
  // 홈 화면에서는 부모 게이트를 통과해야만 앱이 종료됨.
  try {
    CapApp.addListener('backButton', () => {
      if (!options.isHome()) {
        options.onBackToHome();
      } else {
        options.onOpenParentExitPrompt();
      }
    });
  } catch (e) {
    console.warn('Capacitor App.addListener failed:', e);
  }
}

export function exitApp() {
  if (Capacitor.isNativePlatform()) {
    CapApp.exitApp();
  }
}
