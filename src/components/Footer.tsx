import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Instagram,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Truck,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { toBrandSlug } from '../utils/brandSlug';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SiteSettings {
  copyrightText: string;
  paymentCards: { id: string; name: string; iconUrl?: string }[];
}

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({
    copyrightText: '© 2026 De Valeur. Bütün hüquqlar qorunur',
    paymentCards: [
      { id: '1', name: 'TamKart' },
      { id: '2', name: 'BirKart' },
      { id: '3', name: 'LeoKart' },
      { id: '4', name: 'Visa' },
      { id: '5', name: 'Mastercard' },
    ],
  });

  useEffect(() => {
    loadCategoriesAndBrands();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const ref = doc(db, 'site_content', 'settings');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<SiteSettings>;
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error('Footer settings load failed', e);
    }
  };

  const loadCategoriesAndBrands = async () => {
    try {
      const products = await productService.getAll();
      const cats = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))) as string[];
      const brs = Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean))) as string[];
      setCategories(cats.sort());
      setBrands(brs.sort());
    } catch (e) {
      console.error('Footer cats/brands failed', e);
    }
  };

  const getCategoryTranslation = (cat: string) => cat;

  const toggle = (key: string) => setOpenSection((prev) => (prev === key ? null : key));

  // Reusable column / accordion section
  type SectionProps = { id: string; title: string; children: React.ReactNode };
  const FooterSection: React.FC<SectionProps> = ({ id, title, children }) => {
    const isOpen = openSection === id;
    return (
      <div className="md:border-0 border-t border-black/8 first:border-t-0 md:border-t-0">
        {/* Mobile accordion header */}
        <button
          type="button"
          onClick={() => toggle(id)}
          className="md:hidden w-full flex items-center justify-between py-4 text-left"
          aria-expanded={isOpen}
          data-testid={`footer-section-toggle-${id}`}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">{title}</span>
          <ChevronDown
            className={`h-4 w-4 text-black/55 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={1.6}
          />
        </button>
        {/* Desktop heading */}
        <h4 className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-4">
          {title}
        </h4>
        {/* Content — accordion on mobile, always visible on desktop */}
        <div
          className={`md:!block md:opacity-100 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            isOpen ? 'max-h-[1200px] opacity-100 pb-5' : 'max-h-0 opacity-0 md:max-h-none md:opacity-100'
          }`}
        >
          {children}
        </div>
      </div>
    );
  };

  return (
    <footer className="bg-white text-black border-t border-black/10" data-testid="site-footer">
      {/* ============== Promo strip — feature cards ============== */}
      <div className="border-b border-black/10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-7">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4 px-4 py-3 md:py-4 border border-black/10 rounded-md md:rounded-lg" data-testid="footer-promo-delivery">
              <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/5 flex items-center justify-center">
                <Truck className="h-5 w-5 text-black" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] md:text-sm font-semibold text-black leading-tight">Sürətli çatdırılma</p>
                <p className="text-[11px] text-black/55 leading-snug mt-0.5">Bakı daxili eyni gün</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4 px-4 py-3 md:py-4 border border-black/10 rounded-md md:rounded-lg" data-testid="footer-promo-return">
              <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/5 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-black" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] md:text-sm font-semibold text-black leading-tight">
                  Sifarişin sürətli və asan qaytarılması
                </p>
                <p className="text-[11px] text-black/55 leading-snug mt-0.5">14 gün ərzində</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4 px-4 py-3 md:py-4 border border-black/10 rounded-md md:rounded-lg" data-testid="footer-promo-authentic">
              <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/5 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-black" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] md:text-sm font-semibold text-black leading-tight">
                  100% orijinal məhsullar
                </p>
                <p className="text-[11px] text-black/55 leading-snug mt-0.5">Rəsmi distribütor zəmanəti</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============== Main columns / accordion ============== */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-0 md:gap-y-8">
          {/* DE VALEUR (about-style links) */}
          <FooterSection id="company" title="DE VALEUR">
            <ul className="space-y-2.5 md:space-y-3">
              <li><Link to="/about" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Haqqımızda</Link></li>
              <li><Link to="/blog" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Bloq</Link></li>
              <li><Link to="/partners" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Tərəfdaşlar</Link></li>
              <li><Link to="/careers" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Karyera</Link></li>
              <li><Link to="/contact" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Əlaqə</Link></li>
            </ul>
          </FooterSection>

          {/* Müştəri xidməti */}
          <FooterSection id="service" title="Müştəri xidməti">
            <ul className="space-y-2.5 md:space-y-3">
              <li><Link to="/gift-card" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Hədiyyə Kartları</Link></li>
              <li><Link to="/delivery-policy" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Çatdırılma</Link></li>
              <li><Link to="/return-policy" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Qaytarılma</Link></li>
              <li><Link to="/privacy-policy" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">Məxfilik Siyasəti</Link></li>
              <li><Link to="/b2b-request" className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">B2B üçün müraciət</Link></li>
            </ul>
          </FooterSection>

          {/* Kateqoriyalar */}
          <FooterSection id="categories" title={t('header.categories')}>
            <ul className="space-y-2.5 md:space-y-2.5">
              {categories.length === 0 && (
                <li className="text-xs text-black/40">—</li>
              )}
              {categories.map((category) => (
                <li key={category}>
                  <button
                    onClick={() => navigate(`/products?category=${encodeURIComponent(category)}`)}
                    className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors text-left capitalize"
                  >
                    {getCategoryTranslation(category)}
                  </button>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Brendlər */}
          <FooterSection id="brands" title={t('header.brands')}>
            <ul className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
              {brands.length === 0 && (
                <li className="text-xs text-black/40">—</li>
              )}
              {brands.map((brand) => (
                <li key={brand}>
                  <button
                    onClick={() => navigate(`/brand/${toBrandSlug(brand)}`)}
                    className="text-[13px] md:text-sm text-black/65 hover:text-black transition-colors text-left"
                  >
                    {brand}
                  </button>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Əlaqə */}
          <FooterSection id="contact" title={t('header.contact')}>
            <ul className="space-y-3 md:space-y-3.5">
              <li>
                <a
                  href="https://maps.app.goo.gl/JPzZU7hrHU5BcW587"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 text-[13px] md:text-sm text-black/65 hover:text-black transition-colors"
                >
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>Bakı, Azərbaycan</span>
                </a>
              </li>
              <li>
                <a href="tel:+994777577277" className="flex items-center gap-2.5 text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">
                  <Phone className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                  <span>+994 77 757 72 77</span>
                </a>
              </li>
              <li>
                <a href="mailto:info@devaleur.az" className="flex items-center gap-2.5 text-[13px] md:text-sm text-black/65 hover:text-black transition-colors">
                  <Mail className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                  <span className="break-all">info@devaleur.az</span>
                </a>
              </li>
            </ul>
          </FooterSection>
        </div>

        {/* ============== Bottom: Payment + Social ============== */}
        <div className="mt-2 md:mt-12 pt-6 md:pt-10 border-t border-black/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Payment cards */}
            <div className="flex items-center gap-3 flex-wrap">
              {settings.paymentCards.map((card) =>
                card.iconUrl ? (
                  <img
                    key={card.id}
                    src={card.iconUrl}
                    alt={card.name}
                    className="h-5 md:h-6 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                    title={card.name}
                  />
                ) : (
                  <span
                    key={card.id}
                    className="text-[11px] md:text-xs text-black/60 px-2 py-1 border border-black/10 rounded-md"
                  >
                    {card.name}
                  </span>
                )
              )}
            </div>

            {/* Social icons — circular */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/55">Sosial media</span>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://www.instagram.com/devaleur.az?igsh=MTVsd2Fwd3JvbTE3dA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="Instagram"
                  data-testid="footer-social-instagram"
                >
                  <Instagram className="h-4 w-4" strokeWidth={1.6} />
                </a>
                <a
                  href="https://www.tiktok.com/@devaleur.az"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="TikTok"
                  data-testid="footer-social-tiktok"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
                <a
                  href="https://wa.me/994777577277"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="WhatsApp"
                  data-testid="footer-social-whatsapp"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-5 border-t border-black/10 text-center">
            <p className="text-[11px] md:text-xs text-black/45">{settings.copyrightText}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
