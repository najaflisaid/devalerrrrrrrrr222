import React from 'react';

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Qlobal səhv tutucusu — xüsusilə iPhone-da Instagram in-app brauzeri və
 * Brave kimi mühitlərdə chunk-load uğursuzluqları və ya 3rd-party storage
 * blokları zamanı React-in tam çökməsinin qarşısını alır.
 *
 * Səhv baş verərsə istifadəçi bir təmiz "Yenidən cəhd et" düyməsi görür,
 * boş ağ ekran və ya işləməyən kliklərlə qalmır.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Konsola yaz — istehsalda telemetriya gələcəkdə əlavə oluna bilər
    // eslint-disable-next-line no-console
    console.error('App ErrorBoundary caught:', error, info);
  }

  handleRetry = () => {
    try {
      // Sessiyaya xas zibil təmizliyi — bəzən stale state yenidən çöküşə səbəb olur
      sessionStorage.clear();
    } catch { /* noop */ }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-6 text-center"
          data-testid="error-boundary"
        >
          <img
            src="https://i.hizliresim.com/tmu65g6.png"
            alt="De Valeur"
            className="h-8 mb-6 opacity-80"
            draggable={false}
          />
          <h1 className="text-lg font-medium text-gray-900 mb-2">
            Xəta baş verdi
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Səhifə yüklənərkən gözlənilməyən bir problem oldu. Zəhmət olmasa
            yenidən cəhd edin.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-6 py-3 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors rounded-full"
            data-testid="error-boundary-retry"
          >
            Yenidən cəhd et
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
