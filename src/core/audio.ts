import { Howl } from 'howler';

export type SoundEffect =
  | 'siren'
  | 'police'
  | 'horn'
  | 'engine'
  | 'pop'
  | 'water'
  | 'ding'
  | 'fanfare';

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private isUnlocked = false;
  private ttsEnabled = true;
  private sfxEnabled = true;
  private currentHowls: Map<string, Howl> = new Map();
  private volume = 0.8;
  private lastPlayed: Map<string, number> = new Map();

  constructor() {
    this.setupUnlockListeners();
    this.setupIosAudioSession();
  }

  // iOS 무음 스위치가 켜져 있어도 효과음이 나도록 재생(playback) 세션으로 지정 (Safari 16.4+)
  private setupIosAudioSession() {
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      // 지원하지 않는 브라우저
    }
  }

  // 같은 소리가 너무 촘촘히 겹치지 않게 (문지르기·드래그 중 소리 폭주 방지)
  public throttle(key: string, intervalMs: number): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < intervalMs) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.volume;
    this.currentHowls.forEach((h) => h.volume(this.volume));
  }

  public getVolume(): number {
    return this.volume;
  }

  // 첫 터치에서 오디오 컨텍스트 잠금 해제
  private setupUnlockListeners() {
    const unlock = () => {
      this.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  public unlockAudio() {
    this.primeSpeech();
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.volume;
        this.sfxGain.connect(this.ctx.destination);
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      this.isUnlocked = true;
    } catch {
      // safe fallback
    }
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  public getSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setTtsEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
  }

  public getTtsEnabled(): boolean {
    return this.ttsEnabled;
  }

  // --- Web Audio API 기반 무지연 합성음 ---

  // 1. 뽅! 팝 사운드 (버튼 터치, 가벼운 반응)
  public playPop(frequency = 520) {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, t);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.6, t + 0.08);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // safe catch
    }
  }

  // 2. 사이렌 오르내림 (소방차, 앰뷸런스 continuous sweep)
  public playSiren(cycles = 2) {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';

      const cycleDuration = 0.28;
      const totalDuration = cycles * cycleDuration * 2;

      for (let i = 0; i < cycles; i++) {
        const start = t + i * cycleDuration * 2;
        osc.frequency.setValueAtTime(550, start);
        osc.frequency.linearRampToValueAtTime(950, start + cycleDuration);
        osc.frequency.linearRampToValueAtTime(550, start + cycleDuration * 2);
      }

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0.25, t + totalDuration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + totalDuration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + totalDuration);
    } catch {
      // safe catch
    }
  }

  // 3. 경찰 2음 사이렌 (삐-뽀-삐-뽀 2음 교차)
  public playPolice(cycles = 3) {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';

      const noteDuration = 0.18;
      const totalDuration = cycles * noteDuration * 2;

      for (let i = 0; i < cycles; i++) {
        const startHigh = t + i * noteDuration * 2;
        const startLow = startHigh + noteDuration;
        osc.frequency.setValueAtTime(960, startHigh);
        osc.frequency.setValueAtTime(720, startLow);
      }

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.setValueAtTime(0.18, t + totalDuration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + totalDuration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + totalDuration);
    } catch {
      // safe catch
    }
  }

  // 4. 경적 (자동차 빵빵! 듀얼 톤 화음)
  public playHorn() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const freqs = [350, 440]; // 듀얼 톤 경적
      freqs.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq + 10, t + 0.2);

        gain.gain.setValueAtTime(0.32, t);
        gain.gain.setValueAtTime(0.32, t + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch {
      // safe catch
    }
  }

  // 5. 엔진 럼블 (부르릉~ 저음 진동)
  public playEngine() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';

      osc.frequency.setValueAtTime(65, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.5);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.58);
    } catch {
      // safe catch
    }
  }

  // 6. 물소리 (시원한 물줄기, 세차 및 소방차)
  public playWater() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, t);
      filter.frequency.exponentialRampToValueAtTime(600, t + 0.3);
      filter.Q.value = 2.5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.34);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.35);
    } catch {
      // safe catch
    }
  }

  // 7. 딩! (맑고 명쾌한 벨/별 사운드)
  public playDing(freq = 1046.5) {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.42);
    } catch {
      // safe catch
    }
  }

  // 8. 팡파레 (성공 및 완료 축하 화음)
  public playFanfare() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const chords = [
        { freqs: [523.25, 659.25], start: 0, dur: 0.12 },
        { freqs: [523.25, 659.25], start: 0.14, dur: 0.12 },
        { freqs: [523.25, 659.25], start: 0.28, dur: 0.12 },
        { freqs: [659.25, 783.99, 1046.5], start: 0.45, dur: 0.55 },
      ];

      chords.forEach(({ freqs, start, dur }) => {
        const chordStart = this.ctx!.currentTime + start;
        freqs.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, chordStart);

          gain.gain.setValueAtTime(0.24, chordStart);
          gain.gain.setValueAtTime(0.24, chordStart + dur * 0.7);
          gain.gain.exponentialRampToValueAtTime(0.001, chordStart + dur);

          osc.connect(gain);
          gain.connect(this.sfxGain!);

          osc.start(chordStart);
          osc.stop(chordStart + dur + 0.05);
        });
      });
    } catch {
      // safe catch
    }
  }

  // 9. 터널 울림 (우웅~ 낮게 울리는 소리)
  public playTunnel() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      [110, 165].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 0.8, t + 0.8);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.92);
      });
    } catch {
      // safe catch
    }
  }

  // 10. 폴짝 점프 (뾰로롱 올라가는 소리)
  public playBoing() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.4);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.45);
    } catch {
      // safe catch
    }
  }

  // 11. 드릴 조이는 소리 (위잉- 착!)
  public playDrill() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.linearRampToValueAtTime(620, t + 0.35);
      lfo.frequency.value = 40;
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.setValueAtTime(0.12, t + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 0.42);
      lfo.stop(t + 0.42);
    } catch {
      // safe catch
    }
    // 마지막에 "착!"
    setTimeout(() => this.playPop(900), 380);
  }

  // 12. 흙 쏟아지는 소리 (콸르르)
  public playDirtPour() {
    if (!this.sfxEnabled) return;
    this.unlockAudio();
    if (!this.ctx || !this.sfxGain) return;
    try {
      const t = this.ctx.currentTime;
      const dur = 0.7;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // 자글자글 끊기는 잡음
        data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.25);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + dur);
    } catch {
      // safe catch
    }
  }

  // 사운드 이펙트 이름으로 재생
  public setSoundMuted(muted: boolean) {
    this.sfxEnabled = !muted;
  }

  public setMusicMuted(_muted: boolean) {
    // bgm placeholder
  }

  public triggerHaptic(duration = 25) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // ignore
      }
    }
  }

  public playBubble() {
    this.playPop(650);
  }

  public playStarChime() {
    this.playDing(1046.5);
  }

  public playWaterSplash() {
    this.playWater();
  }

  public playEngineRev() {
    this.playEngine();
  }

  public playTrainWhistle() {
    this.playHorn();
  }

  public playRocketBlast() {
    this.playEngine();
  }

  public playExcavatorClank() {
    this.playPop(300);
  }

  public play(effect: SoundEffect) {
    switch (effect) {
      case 'siren':
        this.playSiren();
        break;
      case 'police':
        this.playPolice();
        break;
      case 'horn':
        this.playHorn();
        break;
      case 'engine':
        this.playEngine();
        break;
      case 'pop':
        this.playPop();
        break;
      case 'water':
        this.playWater();
        break;
      case 'ding':
        this.playDing();
        break;
      case 'fanfare':
        this.playFanfare();
        break;
    }
  }

  // Howler mp3 재생 관리
  public playSoundUrl(url: string, volume = 0.8) {
    if (!this.sfxEnabled) return;
    try {
      let sound = this.currentHowls.get(url);
      if (!sound) {
        sound = new Howl({
          src: [url],
          volume: volume * this.volume,
          html5: false,
        });
        this.currentHowls.set(url, sound);
      }
      sound.volume(volume * this.volume);
      sound.play();
    } catch {
      // fallback
    }
  }

  private speechPrimed = false;
  private speakTimer: ReturnType<typeof setTimeout> | null = null;

  // iOS는 첫 음성이 반드시 터치 안에서 시작돼야 함 → 첫 터치에서 빈 문장을 한 번 말해 둠
  private primeSpeech() {
    if (this.speechPrimed || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.speechPrimed = true;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      // 음성 목록을 미리 불러 둠 (처음엔 비어 있는 브라우저가 많음)
      window.speechSynthesis.getVoices();
    } catch {
      // 지원하지 않는 브라우저
    }
  }

  // 한국어 TTS 함수 speak(text) (켜기/끄기 지원)
  public speak(text: string) {
    if (!this.ttsEnabled || !text) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      // 이전 음성 즉시 중단. Android Chrome은 cancel 직후 speak하면 소리가 안 나는 경우가 있어 잠깐 뒤에 말함
      if (this.speakTimer) clearTimeout(this.speakTimer);
      const wasSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      window.speechSynthesis.cancel();
      if (wasSpeaking) {
        this.speakTimer = setTimeout(() => this.speakNow(text), 80);
      } else {
        this.speakNow(text);
      }
    } catch {
      // fallback
    }
  }

  private speakNow(text: string) {
    if (!this.ttsEnabled) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95; // 유아가 편안하게 듣는 약간 부드럽고 또렷한 속도
      utterance.pitch = 1.25; // 밝고 친근한 톤

      // 사용 가능한 한국어 음성 탐색 (목록이 아직 비어 있으면 브라우저 기본 ko-KR 사용)
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find((v) => v.lang.startsWith('ko'));
      if (koVoice) {
        utterance.voice = koVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // fallback
    }
  }
}

export const audioManager = new AudioManager();
export const speak = (text: string) => audioManager.speak(text);
