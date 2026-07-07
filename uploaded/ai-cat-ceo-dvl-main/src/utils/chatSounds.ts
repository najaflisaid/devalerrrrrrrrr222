/**
 * De Valeur AI Chat — səs bildirişləri.
 * Singleton AudioContext + resume() garantiya edir ki, browser autoplay policy
 * bloklamasın (əvvəlcədən istifadəçi ilə interaction olmuşdursa).
 */

const CUSTOMER_MUTE_KEY = 'dv_chat_sound_muted';
const ADMIN_CHAT_MUTE_KEY = 'admin_chat_sound_muted';

let sharedCtx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
};

const beep = (
  ctx: AudioContext,
  freq: number,
  dur: number,
  gain = 0.35,
  type: OscillatorType = 'sine',
  delay = 0
) => {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.015);
  g.gain.setValueAtTime(gain, start + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.02);
};

const playSequence = (
  notes: Array<[number, number, number?, OscillatorType?, number?]>,
  muteKey: string
) => {
  try { if (localStorage.getItem(muteKey) === '1') return; } catch { /* ignore */ }
  const ctx = getCtx();
  if (!ctx) return;
  const doPlay = () => {
    try {
      notes.forEach(([freq, dur, gain = 0.35, type = 'sine', delay = 0]) => {
        beep(ctx, freq, dur, gain, type, delay);
      });
    } catch { /* ignore */ }
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(doPlay).catch(doPlay);
  } else {
    doPlay();
  }
};

/**
 * Müştəri tərəfi: yumşaq "ding" — admin cavab yazanda çalır.
 */
export const playCustomerReceiveSound = (): void => {
  playSequence(
    [
      [880, 0.14, 0.32, 'sine', 0],
      [1320, 0.18, 0.26, 'sine', 0.11],
    ],
    CUSTOMER_MUTE_KEY
  );
};

/**
 * Admin tərəfi: yeni müştəri mesajı gələndə mövcud söhbətdə.
 */
export const playAdminMessageSound = (): void => {
  playSequence(
    [
      [1046, 0.12, 0.4, 'triangle', 0],
      [1568, 0.16, 0.32, 'triangle', 0.09],
    ],
    ADMIN_CHAT_MUTE_KEY
  );
};

/**
 * Admin tərəfi: yeni söhbət başladı — 3-notaya fərqli akkord.
 */
export const playNewSessionSound = (): void => {
  playSequence(
    [
      [659, 0.15, 0.42, 'triangle', 0],       // E5
      [880, 0.15, 0.42, 'triangle', 0.16],    // A5
      [1319, 0.22, 0.42, 'triangle', 0.32],   // E6
    ],
    ADMIN_CHAT_MUTE_KEY
  );
};

/**
 * User gesture-dən sonra çağırılmalıdır — AudioContext-i "unlock" edir.
 * Çağrıldıqdan sonra bütün gələcək səslər autoplay problemi olmadan çalır.
 */
export const unlockChatAudio = (): void => {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
};

export const setCustomerMuted = (muted: boolean) => {
  try { localStorage.setItem(CUSTOMER_MUTE_KEY, muted ? '1' : '0'); } catch { /* noop */ }
};

export const setAdminChatMuted = (muted: boolean) => {
  try { localStorage.setItem(ADMIN_CHAT_MUTE_KEY, muted ? '1' : '0'); } catch { /* noop */ }
};

export const isAdminChatMuted = (): boolean => {
  try { return localStorage.getItem(ADMIN_CHAT_MUTE_KEY) === '1'; } catch { return false; }
};

export const isCustomerMuted = (): boolean => {
  try { return localStorage.getItem(CUSTOMER_MUTE_KEY) === '1'; } catch { return false; }
};
