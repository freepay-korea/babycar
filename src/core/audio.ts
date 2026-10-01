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

  constructor() {
    this.setupUnlockListeners();
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
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
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
          volume,
          html5: false,
        });
        this.currentHowls.set(url, sound);
      }
      sound.volume(volume);
      sound.play();
    } catch {
      // fallback
    }
  }

  // 한국어 TTS 함수 speak(text) (켜기/끄기 지원)
  public speak(text: string) {
    if (!this.ttsEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // 이전 음성 즉시 중단

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95; // 유아가 편안하게 듣는 약간 부드럽고 또렷한 속도
      utterance.pitch = 1.25; // 밝고 친근한 톤

      // 사용 가능한 한국어 음성 탐색
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
