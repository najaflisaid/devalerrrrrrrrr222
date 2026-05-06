/**
 * Admin üçün QLOBAL bildiriş səsi.
 *
 * Üstünlük sırası:
 *   1) `/sounds/new-order.mp3` — admin gələcəkdə custom audio yükləsə oradan götürür
 *   2) `window.speechSynthesis` — brauzerin daxili TTS-i (azərbaycan/türk/rus səs ilə oxuyur)
 *   3) WebAudio iki-tonlu beep — TTS dəstəklənmirsə son ehtiyat
 *
 * `localStorage.admin_sound_notifications_enabled === 'false'` olarsa səs verilmir.
 */
const SPEECH_TEXT = 'New order received';
const CUSTOM_AUDIO_URL = '/sounds/new-order.mp3';

let cachedCustomAudioOk: boolean | null = null;

const isMuted = (): boolean => {
  try {
    return localStorage.getItem('admin_sound_notifications_enabled') === 'false';
  } catch {
    return false;
  }
};

const playBeepFallback = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const tones: { f: number; t: number; d: number }[] = [
      { f: 1175, t: 0.0, d: 0.16 },
      { f: 880, t: 0.16, d: 0.28 },
      { f: 1175, t: 0.55, d: 0.16 },
      { f: 880, t: 0.71, d: 0.28 },
    ];
    const playTones = () => {
      tones.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = f;
        osc.type = 'sine';
        osc.detune.value = -3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + t;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.45, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
        osc.start(start);
        osc.stop(start + d + 0.02);
      });
      setTimeout(() => ctx.close(), 1500);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(playTones).catch(() => playTones());
    } else {
      playTones();
    }
  } catch {
    /* ignore */
  }
};

const playSpeech = (): boolean => {
  try {
    if (!('speechSynthesis' in window)) return false;
    const synth = window.speechSynthesis;
    // Səs növbəsi yığılmasın deyə əvvəlki nitqi kəs
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(SPEECH_TEXT);
    utter.rate = 1.0;
    utter.volume = 1.0;
    utter.pitch = 1.0;
    utter.lang = 'en-US';

    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      // En yaxşı: ABS/UK ingilis səs. Yoxsa default ingilis. Sonda heç biri yoxdursa default qalır.
      const enUsVoice = voices.find((v) => v.lang?.toLowerCase() === 'en-us');
      const enGbVoice = voices.find((v) => v.lang?.toLowerCase() === 'en-gb');
      const anyEnVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
      const picked = enUsVoice || enGbVoice || anyEnVoice;
      if (picked) {
        utter.voice = picked;
        utter.lang = picked.lang;
      }
    }
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
};

const playCustomAudio = (): Promise<boolean> => {
  if (cachedCustomAudioOk === false) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const audio = new Audio(CUSTOM_AUDIO_URL);
      audio.volume = 1.0;
      audio.preload = 'auto';
      audio.addEventListener(
        'error',
        () => {
          cachedCustomAudioOk = false;
          resolve(false);
        },
        { once: true }
      );
      audio.addEventListener(
        'playing',
        () => {
          cachedCustomAudioOk = true;
          resolve(true);
        },
        { once: true }
      );
      audio.play().catch(() => {
        cachedCustomAudioOk = false;
        resolve(false);
      });
    } catch {
      cachedCustomAudioOk = false;
      resolve(false);
    }
  });
};

export const playNewOrderSound = async (): Promise<void> => {
  if (isMuted()) return;
  // 1) Custom MP3
  const ok = await playCustomAudio();
  if (ok) return;
  // 2) TTS
  if (playSpeech()) return;
  // 3) Beep fallback
  playBeepFallback();
};

/**
 * İlk istifadəçi gesture-undən sonra audio "kilidini aç" — autoplay siyasətinin
 * sonrakı səsləri bloklamamasına kömək edir. Speech-i sıfırlayan boş çağırış.
 */
export const unlockAudio = () => {
  try {
    if ('speechSynthesis' in window) {
      // Boş utterance ilə synth-i hazır vəziyyətə gətir
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
};
