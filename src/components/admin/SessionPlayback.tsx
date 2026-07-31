/**
 * SessionPlayback
 * ────────────────
 * "Cinema" replay of a chat session — messages appear one at a time with a
 * gap between them that mirrors the real waiting time between messages in
 * the original conversation (compressed so the whole session plays in a
 * reasonable duration). Great for QA / training / spotting where customers
 * bounce off.
 *
 * Controls
 *  • Play / Pause
 *  • Skip to end (dumps everything)
 *  • Restart
 *  • Speed selector (0.5×, 1×, 2×, 4×)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, X, User as UserIcon, Bot } from 'lucide-react';
import type { ChatSessionMessage } from '../../services/chatSessionService';
import { sessionShortCode } from '../../services/chatSessionService';

interface Props {
  sessionId: string;
  sessionName?: string;          // Real customer name if captured
  messages: ChatSessionMessage[];
  onClose: () => void;
}

const getMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
};

const MIN_GAP_MS = 400;   // minimum reveal gap
const MAX_GAP_MS = 2500;  // cap so long silences don't stall playback

const SessionPlayback: React.FC<Props> = ({ sessionId, sessionName, messages, onClose }) => {
  // Precompute delays between messages (compressed)
  const delays = useMemo(() => {
    if (messages.length === 0) return [] as number[];
    const arr: number[] = [];
    let prev = getMs(messages[0].ts);
    for (let i = 0; i < messages.length; i++) {
      if (i === 0) { arr.push(MIN_GAP_MS); continue; }
      const cur = getMs(messages[i].ts);
      let gap = cur - prev;
      if (!gap || gap < 0) gap = 800;
      // Compress: 1 second real → 200 ms playback
      const scaled = Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, gap * 0.2));
      arr.push(scaled);
      prev = cur;
    }
    return arr;
  }, [messages]);

  const [visible, setVisible] = useState<number>(0); // number of revealed messages
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Autoplay tick
  useEffect(() => {
    if (!playing) return;
    if (visible >= messages.length) return;
    const delay = (delays[visible] ?? MIN_GAP_MS) / speed;
    const t = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [playing, visible, delays, messages.length, speed]);

  // Auto-scroll to bottom on reveal
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  const restart = () => { setVisible(0); setPlaying(true); };
  const skipToEnd = () => { setVisible(messages.length); setPlaying(false); };

  const isFinished = visible >= messages.length;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div
        className="relative w-full max-w-2xl h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
        data-testid="session-playback-modal"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {sessionName ? sessionName.slice(0, 2).toUpperCase() : sessionShortCode(sessionId).slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">
              Söhbət replay-i · {sessionName || <span className="font-mono">#{sessionShortCode(sessionId)}</span>}
            </div>
            <div className="text-[11px] text-gray-500">
              {visible}/{messages.length} mesaj göstərilir · {isFinished ? 'tamamlandı' : playing ? 'oxunur' : 'dayandırılıb'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 text-gray-500 hover:text-gray-800"
            data-testid="session-playback-close"
            aria-label="Bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Message stage */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#F5F0E5]/40 min-h-0">
          {messages.slice(0, visible).map((m, idx) => {
            const isUser = m.role === 'user';
            const isAdmin = m.role === 'admin';
            return (
              <div
                key={m.id || idx}
                className={`flex ${isUser ? 'justify-start' : 'justify-end'} dv-playback-appear`}
                style={{ animationDelay: '0ms' }}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[13.5px] shadow-sm ${
                  isUser
                    ? 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                    : isAdmin
                    ? 'bg-[#DCF8C6] text-gray-900 rounded-br-sm'
                    : 'bg-indigo-600 text-white rounded-br-sm'
                }`}>
                  <div className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${
                    isUser ? 'text-gray-500' : isAdmin ? 'text-emerald-800' : 'text-white/75'
                  }`}>
                    {isUser
                      ? <><UserIcon className="h-2.5 w-2.5" /> Müştəri</>
                      : isAdmin
                      ? <>👤 {m.byName || 'Konsultant'}</>
                      : <><Bot className="h-2.5 w-2.5" /> AI</>}
                  </div>
                  {m.imageUrl && (
                    <img src={m.imageUrl} alt="" className="rounded-lg max-h-52 object-cover mb-1.5" />
                  )}
                  {m.content && <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>}
                </div>
              </div>
            );
          })}
          {playing && !isFinished && (
            <div className="flex justify-start" data-testid="playback-typing">
              <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 shadow-sm flex items-center gap-1.5">
                <span className="dv-dot" />
                <span className="dv-dot" style={{ animationDelay: '0.15s' }} />
                <span className="dv-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { if (isFinished) restart(); else setPlaying((p) => !p); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
            data-testid="playback-toggle-btn"
          >
            {isFinished ? <><RotateCcw className="h-3.5 w-3.5" /> Yenidən oxut</>
              : playing ? <><Pause className="h-3.5 w-3.5" /> Dayandır</>
              : <><Play className="h-3.5 w-3.5" /> Davam et</>}
          </button>
          <button
            onClick={skipToEnd}
            disabled={isFinished}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium hover:bg-gray-200 disabled:opacity-40"
            data-testid="playback-skip-btn"
          >
            <FastForward className="h-3.5 w-3.5" /> Sona keç
          </button>
          <div className="ml-auto flex items-center gap-1 text-[11px] text-gray-500">
            <span className="mr-1">Sürət:</span>
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  speed === s ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`playback-speed-${s}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes dvPlaybackAppear {
            from { opacity: 0; transform: translateY(6px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
          .dv-playback-appear { animation: dvPlaybackAppear 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
        `}</style>
      </div>
    </div>
  );
};

export default SessionPlayback;
