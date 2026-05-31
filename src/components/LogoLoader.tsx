import React from 'react';

/**
 * Minimalist səhifə yüklənmə ekranı.
 * Ekranın ortasında De Valeur logosu zərif "pulse" animasiyası ilə görünür.
 * Heç bir fırlanan spinner və ya progress bar yoxdur — tam minimalist.
 *
 * App.tsx-də React.lazy() Suspense fallback-i kimi istifadə olunur ki,
 * bir səhifədən digərinə keçəndə "ağ ekran" əvəzinə brendləşmiş yükləmə görünsün.
 */
const LogoLoader: React.FC<{ fullScreen?: boolean }> = ({ fullScreen = true }) => {
  return (
    <div
      className={
        fullScreen
          ? 'fixed inset-0 z-[9999] flex items-center justify-center bg-white'
          : 'min-h-[60vh] w-full flex items-center justify-center bg-white'
      }
      data-testid="logo-loader"
      aria-label="Yüklənir"
      role="status"
    >
      <img
        src="https://i.hizliresim.com/tmu65g6.png"
        alt="De Valeur"
        className="h-10 sm:h-12 md:h-14 dv-logo-pulse select-none"
        draggable={false}
      />
    </div>
  );
};

export default LogoLoader;
