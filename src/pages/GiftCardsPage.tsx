import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, ShoppingBag, Sparkles } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

const GiftCardsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { addToCart, addNotification } = useCart();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('isGiftCard', '==', true),
          where('isEnabled', '==', true)
        );
        const snap = await getDocs(q);
        const list: Product[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({ ...data, id: d.id } as Product);
        });
        // Sort by price asc
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        setItems(list);
      } catch (e) {
        console.error('Failed to load gift cards:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getName = (p: Product) =>
    p.name?.[i18n.language as 'az' | 'ru' | 'en'] || p.name?.az || p.name?.en || 'Gift Card';

  const handleBuy = (p: Product) => {
    addToCart(p, 1);
    addNotification(t('giftCards.added', { defaultValue: 'Gift kart səbətə əlavə olundu' }), 'success');
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-[#F5EAE2] py-14 md:py-20 px-5 sm:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 text-[11px] uppercase tracking-[0.32em] text-black/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('giftCards.eyebrow', { defaultValue: 'De Valeur' })}</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-[32px] md:text-[44px] leading-[1.05] tracking-tight text-black font-normal mb-4" data-testid="gift-cards-title">
            {t('giftCards.title', { defaultValue: 'Hədiyyə Kartı' })}
          </h1>
          <p className="text-[14px] md:text-[16px] text-black/65 max-w-2xl mx-auto leading-relaxed">
            {t('giftCards.subtitle', {
              defaultValue:
                'Hər anın xüsusi hədiyyəsi. Sevdiklərinizə De Valeur kolleksiyalarından dilədiyini seçmək azadlığını verin.',
            })}
          </p>
        </div>
      </section>

      {/* Cards grid */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        {loading ? (
          <div className="text-center py-20 text-black/55 text-sm">
            {t('common.loading', { defaultValue: 'Yüklənir...' })}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Gift className="w-10 h-10 mx-auto mb-3 text-black/30" strokeWidth={1.25} />
            <p className="text-black/55 text-sm">
              {t('giftCards.empty', {
                defaultValue: 'Hələlik aktiv gift kart yoxdur. Yaxınlarda əlavə olunacaq.',
              })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {items.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col bg-white border border-black/10 hover:shadow-lg transition-shadow duration-500"
                data-testid={`gift-card-${p.id}`}
              >
                {/* Visual */}
                <div className="relative aspect-[16/10] bg-gradient-to-br from-black via-[#1a1a1a] to-[#2a2218] overflow-hidden">
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={getName(p)}
                      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-end justify-between p-5 text-white pointer-events-none">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] opacity-75">De Valeur</p>
                      <p className="text-[22px] md:text-[26px] font-light tracking-tight mt-1">{getName(p)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-65">{t('giftCards.value', { defaultValue: 'Dəyər' })}</p>
                      <p className="text-[20px] md:text-[24px] font-medium">{p.price.toFixed(0)} AZN</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col p-5">
                  <p className="text-[13px] text-black/60 leading-relaxed mb-5 line-clamp-3">
                    {p.description?.[i18n.language as 'az' | 'ru' | 'en'] ||
                      p.description?.az ||
                      t('giftCards.defaultDesc', {
                        defaultValue:
                          'Alış-veriş zamanı promo kod kimi istifadə edilə bilən fiziki/elektron hədiyyə kartı.',
                      })}
                  </p>
                  <button
                    onClick={() => handleBuy(p)}
                    className="mt-auto w-full h-12 bg-black text-white text-[12px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 transition-colors inline-flex items-center justify-center gap-2"
                    data-testid={`gift-card-buy-${p.id}`}
                  >
                    <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                    <span>{t('giftCards.buy', { defaultValue: 'Al' })}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 text-center">
          {[
            { n: '01', t: t('giftCards.step1Title', { defaultValue: 'Seç' }), d: t('giftCards.step1Desc', { defaultValue: 'İstədiyin dəyərdə hədiyyə kartını seç.' }) },
            { n: '02', t: t('giftCards.step2Title', { defaultValue: 'Ödə' }), d: t('giftCards.step2Desc', { defaultValue: 'Təhlükəsiz ödənişi tamamla.' }) },
            { n: '03', t: t('giftCards.step3Title', { defaultValue: 'Hədiyyə et' }), d: t('giftCards.step3Desc', { defaultValue: 'Unikal promo kod yaradılır və e-poçtuna göndərilir.' }) },
          ].map((s) => (
            <div key={s.n}>
              <p className="text-[11px] tracking-[0.32em] text-black/40 mb-2">{s.n}</p>
              <p className="text-[16px] text-black mb-1.5">{s.t}</p>
              <p className="text-[13px] text-black/55 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GiftCardsPage;
