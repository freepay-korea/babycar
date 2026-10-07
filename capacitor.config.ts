import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meen.bungbung',
  appName: '부릉부릉 놀이터',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
      backgroundColor: '#38bdf8',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
    },
  },
  ios: {
    // 가로/세로 모든 방향 회전 허용
    preferredContentMode: 'mobile',
    scheme: 'BungBungPlayground',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
