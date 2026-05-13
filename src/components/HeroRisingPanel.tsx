import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * HeroRisingPanel — Hero bannerinin üzərinə "qalxan panel" effekti.
 *
 * Effekt:
 *  - Panel ilkin vəziyyətdə təbii pozisiyasından ~280px aşağıda qalır
 *    (Hero görünən, panel hələ görünməyə yenicə başlayır).
 *  - User scroll edən kimi (0 → 320px window scroll), panel yumşaq şəkildə
 *    280px yuxarı qalxır — sanki bannerin altından "qapaq" kimi sürüşür.
 *  - z-index Hero-dan yuxarıdır, ona görə Hero üzərinə yığılır.
 *  - Rounded-top künclər + üstdə incə qızıl xətt → lüks "card rising" görünüşü.
 *
 * Daxildə children-ləri olduğu kimi render edir (CollectionTiles, BestSellers və s.).
 */
interface HeroRisingPanelProps {
  children: React.ReactNode;
}

const HeroRisingPanel: React.FC<HeroRisingPanelProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [hasContent, setHasContent] = React.useState(true);

  // Daxili məzmun (CollectionTiles + BestSellers) heç bir element render etmirsə,
  // boş ağ qapaq göstərməyək — panel-i tamamilə gizlət.
  React.useEffect(() => {
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
    // İlkin yüklənmədən sonra bir neçə dəfə yoxla (asinxron data üçün)
    const tids = [200, 600, 1500, 3000].map((d) => window.setTimeout(check, d));
    return () => {
      observer.disconnect();
      tids.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Window scroll-una bağlı translateY animasiyası.
  // İlk 320px scroll-da panel 280px → 0px qalxır.
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 320], [280, 0], { clamp: true });
  const shadowOpacity = useTransform(scrollY, [0, 200, 320], [0, 0.12, 0.22], { clamp: true });

  return (
    <motion.div
      ref={ref}
      className={`relative z-10 -mt-[80px] md:-mt-[110px] lg:-mt-[140px] ${hasContent ? '' : 'hidden'}`}
      style={{ y }}
      data-testid="hero-rising-panel"
    >
      {/* Üstdə yumşaq alt-kölgə (Hero ilə ayrılığı vurğulayır) */}
      <motion.div
        aria-hidden="true"
        className="absolute -top-10 left-0 right-0 h-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.2), rgba(0,0,0,0))',
          opacity: shadowOpacity,
        }}
      />

      {/* Üst hissə: rounded küncləri olan ağ "qapaq" */}
      <div
        className="relative bg-white rounded-t-[32px] md:rounded-t-[48px] overflow-hidden"
        data-testid="hero-rising-panel-card"
      >
        {/* İncə qızıl üst xətt — luxury detal */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-16 md:w-24 h-px"
          style={{ background: 'linear-gradient(to right, transparent, #C9A961, transparent)' }}
        />
        <div ref={innerRef}>{children}</div>
      </div>
    </motion.div>
  );
};

export default HeroRisingPanel;
