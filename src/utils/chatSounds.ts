/**
 * De Valeur AI Chat — səs bildirişləri.
 * WebAudio ilə generasiya olunur, xarici fayl asılılığı yoxdur.
 */

const CUSTOMER_MUTE_KEY = 'dv_chat_sound_muted';
const ADMIN_CHAT_MUTE_KEY = 'admin_chat_sound_muted';

const beep = (freq: number, dur: number, gain = 0.35, type: OscillatorType = 'sine', delay = 0) => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
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
    setTimeout(() => ctx.close().catch(() => undefined), (delay + dur + 0.1) * 1000);
  } catch { /* ignore */ }
};

/**
 * Müştəri tərəfi: yumşaq bir "ding" — yeni mesaj alanda çalır.
 */
export const playCustomerReceiveSound = (): void => {
  try { if (localStorage.getItem(CUSTOMER_MUTE_KEY) === '1') return; } catch { /* noop */ }
  beep(880, 0.14, 0.28, 'sine');
  beep(1320, 0.18, 0.22, 'sine', 0.11);
};

/**
 * Admin tərəfi: yeni müştəri mesajı gələndə (mövcud söhbətdə) — 1 qısa siqnal.
 */
export const playAdminMessageSound = (): void => {
  try { if (localStorage.getItem(ADMIN_CHAT_MUTE_KEY) === '1') return; } catch { /* noop */ }
  beep(1046, 0.12, 0.35, 'triangle');
  beep(1568, 0.16, 0.28, 'triangle', 0.09);
};

/**
 * Admin tərəfi: yeni söhbət başladı (yeni müştəri gəldi) — 3 qat siqnal + fərqli akkord.
 */
export const playNewSessionSound = (): void => {
  try { if (localStorage.getItem(ADMIN_CHAT_MUTE_KEY) === '1') return; } catch { /* noop */ }
  beep(659, 0.15, 0.4, 'triangle');       // E5
  beep(880, 0.15, 0.4, 'triangle', 0.16); // A5
  beep(1319, 0.22, 0.4, 'triangle', 0.32); // E6
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
