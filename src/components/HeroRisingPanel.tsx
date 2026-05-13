import React, { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

/**
 * HeroRisingPanel — Hero bannerinin üzərinə "qalxan səhifə" effekti.
 *
 * İstifadəçi cüzi scroll edən kimi (>= ~40px) — panel avtomatik olaraq aşağıdan
 * yumşaq animasiya ilə tam yuxarı qalxır (smooth auto-snap). Eyni zamanda
 * rənglər keçidlə dəyişir: tünd Hero overlay → kremvari işıqlı panel.
 *
 *  - Panel ilkin vəziyyətdə təbii pozisiyasından `RISE_DISTANCE`px aşağıda durur.
 *  - User scroll edən kimi (0 → SNAP_TARGET window scroll), panel yumşaq şəkildə
 *    yuxarı qalxır — sanki yeni "səhifə" alt qatdan sürüşüb gəlir.
 *  - z-index Hero-dan yuxarıdır, ona görə Hero üzərinə yığılır.
 *  - Rounded-top künclər + üstdə incə qızıl xətt + scroll əsasında dəyişən rəng.
 *  - SCROLL THRESHOLD aşıldıqda window.scrollTo ilə smooth-snap edirik.
 */
interface HeroRisingPanelProps {
  children: React.ReactNode;
}

// Animasiyanın açılma məsafəsi — bu qədər scroll arasında panel tam qalxır.
// İlkin dəyərlər; mount zamanı viewport-a görə dəqiqləşir.
const DEFAULT_SNAP_TARGET = 720; // px — auto-snap window scroll target
const DEFAULT_RISE_DISTANCE = 560; // px — panelin başlanğıcda aşağıda durduğu məsafə
const TRIGGER_THRESHOLD = 40; // px — bu qədər scroll edən kimi auto-snap işə düşür

const HeroRisingPanel: React.FC<HeroRisingPanelProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [hasContent, setHasContent] = React.useState(true);

  // Daxili məzmun (CollectionTiles + BestSellers) heç bir element render etmirsə,
  // boş ağ qapaq göstərməyək — panel-i tamamilə gizlət.
  useEffect(() => {
    const check = () => {
      if (!innerRef.current) return;
      const visibleChildren = Array.from(innerRef.current.children).filter(
        (el) => (el as HTMLElement).offsetHeight > 0
      );
      setHasContent(visibleChildren.length > 0);
    };
    check();
    const observer = new MutationObserver(check);
    if (innerRef.current) {
      observer.observe(innerRef.current, { childList: true, subtree: true, attributes: true });
    }
    const tids = [200, 600, 1500, 3000].map((d) => window.setTimeout(check, d));
    return () => {
      observer.disconnect();
      tids.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const { scrollY } = useScroll();

  // Viewport-a görə hesablanmış snap & rise — Hero hündürlüyü 88vh-dir, ona görə
  // panel viewport-un təxminən 70%-i qədər aşağıdan qalxır.
  const [snapTarget, setSnapTarget] = React.useState(DEFAULT_SNAP_TARGET);
  const [riseDistance, setRiseDistance] = React.useState(DEFAULT_RISE_DISTANCE);
  useEffect(() => {
    const compute = () => {
      const h = window.innerHeight || 800;
      // Hero 88vh-dir → snap target = hero hündürlüyünün ~80%-i (panel tam çıxsın)
      const target = Math.max(500, Math.min(880, Math.round(h * 0.7)));
      const rise = Math.max(420, Math.min(720, Math.round(h * 0.55)));
      setSnapTarget(target);
      setRiseDistance(rise);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Panel `riseDistance`px aşağıdan → 0-a qalxır (translateY).
  const y = useTransform(scrollY, [0, snapTarget], [riseDistance, 0], { clamp: true });
  // Kölgə → dərinlik üçün
  const shadowOpacity = useTransform(scrollY, [0, snapTarget * 0.5, snapTarget], [0, 0.18, 0.32], {
    clamp: true,
  });
  // Hero üzərinə qaranlıq vurğu (panel qalxdıqca Hero dim olur)
  const heroDim = useTransform(scrollY, [0, snapTarget], [0, 0.55], { clamp: true });

  // Üst hissədəki rəng — kremvari ağ → daha isti qızılı kremə yumşaq keçid
  const panelBgColor = useTransform(
    scrollY,
    [0, snapTarget * 0.5, snapTarget],
    ['#F4ECE0', '#FBF7F0', '#FFFFFF']
  );
  // Üstdəki qızıl xəttin parlaqlığı
  const accentScale = useTransform(scrollY, [0, snapTarget], [0.4, 1], { clamp: true });
  const accentOpacity = useTransform(scrollY, [0, snapTarget * 0.3, snapTarget], [0, 0.6, 1], {
    clamp: true,
  });

  // ===== Auto-snap (səhifə kimi yuxarı qalxma) =====
  // Cüzi scroll (>= TRIGGER_THRESHOLD və < SNAP_TARGET) baş verən kimi
  // pəncərəni yumşaq şəkildə SNAP_TARGET-a aparırıq.
  const isSnappingRef = useRef(false);
  const lastSnapDirectionRef = useRef<'down' | 'up' | null>(null);

  useMotionValueEvent(scrollY, 'change', (v) => {
    // İstifadəçi yuxarıya qayıdırsa — reset
    if (v <= 4) {
      lastSnapDirectionRef.current = null;
      isSnappingRef.current = false;
      return;
    }

    if (isSnappingRef.current) return;

    // Aşağıya snap: cüzi scroll → tam aç
    if (
      lastSnapDirectionRef.current !== 'down' &&
      v >= TRIGGER_THRESHOLD &&
      v < snapTarget - 20
    ) {
      isSnappingRef.current = true;
      lastSnapDirectionRef.current = 'down';
      // Yumşaq smooth scroll — brauzerin native smooth davranışı
      window.scrollTo({ top: snapTarget, behavior: 'smooth' });
      // Animasiya bitdikdən sonra flag-ı azad et
      window.setTimeout(() => {
        isSnappingRef.current = false;
      }, 900);
      return;
    }

    // Yuxarıya snap: panel tam açılmış, lakin user bir az yuxarı scroll etdi
    // (lakin Hero-ya tam dönmədi) → tam Hero-ya geri qaytar.
    if (
      lastSnapDirectionRef.current !== 'up' &&
      v > 4 &&
      v < TRIGGER_THRESHOLD &&
      // Yalnız əvvəlcədən aşağı snap edilmiş vəziyyətdən gəlirsə
      lastSnapDirectionRef.current === 'down'
    ) {
      isSnappingRef.current = true;
      lastSnapDirectionRef.current = 'up';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        isSnappingRef.current = false;
      }, 900);
    }
  });

  // prefers-reduced-motion → auto-snap-i deaktiv et
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      isSnappingRef.current = true; // həmişə blok = heç vaxt snap olmaz
    }
  }, []);

  return (
    <>
      {/* Hero üzərinə dim overlay — panel qalxdıqca Hero qaralır */}
      <motion.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 pointer-events-none z-[6]"
        style={{
          height: '100vh',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.85) 100%)',
          opacity: heroDim,
        }}
      />

      <motion.div
        ref={ref}
        className={`relative z-10 -mt-[80px] md:-mt-[110px] lg:-mt-[140px] ${
          hasContent ? '' : 'hidden'
        }`}
        style={{ y }}
        data-testid="hero-rising-panel"
      >
        {/* Üstdə yumşaq alt-kölgə (Hero ilə ayrılığı vurğulayır) */}
        <motion.div
          aria-hidden="true"
          className="absolute -top-12 left-0 right-0 h-12 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0))',
            opacity: shadowOpacity,
          }}
        />

        {/* Üst hissə: rounded küncləri olan "qalxan səhifə" */}
        <motion.div
          className="relative rounded-t-[36px] md:rounded-t-[56px] overflow-hidden"
          style={{ backgroundColor: panelBgColor }}
          data-testid="hero-rising-panel-card"
        >
          {/* İncə qızıl üst xətt — luxury detal (scroll ilə uzanır) */}
          <motion.div
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 h-px"
            style={{
              width: '120px',
              background: 'linear-gradient(to right, transparent, #C9A961, transparent)',
              scaleX: accentScale,
              opacity: accentOpacity,
              transformOrigin: 'center',
            }}
          />
          <div ref={innerRef}>{children}</div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default HeroRisingPanel;
