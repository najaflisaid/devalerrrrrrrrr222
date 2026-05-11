import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  subscribeCampaign,
  isCampaignLive,
  type Campaign,
} from '../services/campaignService';

const SESSION_KEY = 'devaleur_campaign_popup_shown';

const CampaignPopup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  // Active campaign-i dinləyirik
  useEffect(() => {
    const unsub = subscribeCampaign(setCampaign);
    return () => unsub();
  }, []);

  // Popup-ın açılma şərtləri
  useEffect(() => {
    if (!campaign) return;
    if (!isCampaignLive(campaign)) return;
    if (!campaign.popup?.enabled) return;
    if (!campaign.popup?.imageUrl && !campaign.popup?.title) return;

    // Admin/auth səhifələrində popup göstərmirik
    const p = location.pathname;
    if (
      p.startsWith('/admin') ||
      p.startsWith('/workers') ||
      p.startsWith('/b2b-login') ||
      p.startsWith('/admin-login') ||
      p.startsWith('/b2b-request') ||
      p.startsWith('/payment')
    ) return;

    // Sessiyada artıq göstərilibsə təkrar göstərmirik
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch { /* noop */ }

    const delayMs = Math.max(1, campaign.popup.delaySec || 5) * 1000;
    const timer = setTimeout(() => {
      setShow(true);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [campaign, location.pathname]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setShow(false);
      setClosing(false);
    }, 260);
  };

  const handleCta = () => {
    const link = campaign?.popup?.buttonLink || '/products';
    handleClose();
    setTimeout(() => {
      if (link.startsWith('http')) {
        window.open(link, '_blank', 'noopener,noreferrer');
      } else {
        navigate(link);
      }
    }, 100);
  };

  if (!show || !campaign?.popup) return null;
  const { imageUrl, title, subtitle, buttonText } = campaign.popup;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100 animate-fadeIn'}`}
      onClick={handleClose}
      data-testid="campaign-popup"
    >
      <div
        className={`relative bg-white max-w-[480px] w-full overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] transition-all duration-300 ${closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-popupIn'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid #D4AF37' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-black/70 hover:text-black flex items-center justify-center shadow-md transition-all"
          aria-label="Bağla"
          data-testid="campaign-popup-close"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {/* Image */}
        {imageUrl && (
          <div className="w-full aspect-[5/4] bg-black/[0.04] overflow-hidden">
            <img
              src={imageUrl}
              alt={title || 'Kampaniya'}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        )}

        {/* Body */}
        <div className="px-7 pt-6 pb-7 text-center">
          {title && (
            <h2
              className="font-playfair text-2xl md:text-3xl font-light text-black mb-2 tracking-tight"
              data-testid="campaign-popup-title"
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-[13px] text-black/65 leading-relaxed mb-5 whitespace-pre-line">
              {subtitle}
            </p>
          )}
          {buttonText && (
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex items-center justify-center min-w-[200px] h-11 px-6 bg-black text-white text-[11px] uppercase tracking-[0.22em] hover:bg-[#D4AF37] hover:text-black transition-colors"
              data-testid="campaign-popup-cta"
            >
              {buttonText}
            </button>
          )}
        </div>

        {/* Gold accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
      </div>
    </div>
  );
};

export default CampaignPopup;
