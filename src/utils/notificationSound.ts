/**
 * Admin üçün QLOBAL bildiriş səsi.
 *
 * Tələb: 3 dəfə qısa, kəskin "ding" siqnalı (əvvəlki melodiya/TTS əvəzinə).
 * WebAudio ilə generasiya olunur — fayl asılılığı yoxdur, hər brauzerdə eyni səslə işləyir.
 *
 * `localStorage.admin_sound_notifications_enabled === 'false'` olarsa səs verilmir.
 */
const isMuted = (): boolean => {
  try {
    return localStorage.getItem('admin_sound_notifications_enabled') === 'false';
  } catch {
    return false;
  }
};

const play3Beeps = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();

    // 3 eyni "ding" — hər biri 0.18sn, aralarında 0.16sn fasilə
    const BEEP_FREQ = 1320; // E6 — diqqəti çəkən, yumşaq amma kəskin
    const BEEP_DUR = 0.18;
    const BEEP_GAP = 0.16;
    const COUNT = 3;

    const playAll = () => {
      for (let i = 0; i < COUNT; i++) {
        const start = ctx.currentTime + i * (BEEP_DUR + BEEP_GAP);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = BEEP_FREQ;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.5, start + 0.01);
        gain.gain.setValueAtTime(0.5, start + BEEP_DUR - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + BEEP_DUR);
        osc.start(start);
        osc.stop(start + BEEP_DUR + 0.02);
      }
      const totalMs = COUNT * (BEEP_DUR + BEEP_GAP) * 1000 + 200;
      setTimeout(() => ctx.close().catch(() => undefined), totalMs);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(playAll).catch(() => playAll());
    } else {
      playAll();
    }
  } catch {
    /* ignore */
  }
};

export const playNewOrderSound = async (): Promise<void> => {
  if (isMuted()) return;
  play3Beeps();
};

/**
 * İlk istifadəçi gesture-undən sonra audio "kilidini aç" — autoplay siyasətinin
 * sonrakı səsləri bloklamamasına kömək edir.
 */
export const unlockAudio = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    setTimeout(() => ctx.close().catch(() => undefined), 100);
  } catch {
    /* ignore */
  }
};
