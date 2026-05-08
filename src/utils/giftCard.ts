/**
 * Custom-amount gift-card helpers.
 *
 * Müştəri 100 AZN-dən yuxarı istənilən məbləğ seçə bilər. Hər seçim üçün
 * burada sintetik (Firestore-da real sənədi olmayan) `Product` obyekti qurulur
 * və səbətə əlavə olunur. Sintetik məhsul:
 *   - id   = `gift-card-custom-{amount}` formatında olur
 *   - price = istifadəçi seçdiyi AZN
 *   - isGiftCard = true
 *
 * Hidrasiya (CartContext) və ödəniş tamamlandıqda promo-kod buraxma
 * (PaymentSuccessPage) bu prefiksə baxır və Firestore axtarışı tələb etmədən
 * gift-card kimi davranır.
 */
import type { Product } from '../types';

export const GIFT_CARD_CUSTOM_PREFIX = 'gift-card-custom-';
export const GIFT_CARD_MIN_AMOUNT = 100;
export const GIFT_CARD_MAX_AMOUNT = 5000;

export const isCustomGiftCardId = (id: string | undefined | null): boolean =>
  !!id && id.startsWith(GIFT_CARD_CUSTOM_PREFIX);

export const buildCustomGiftCardProduct = (amount: number): Product => {
  const safe = Math.max(GIFT_CARD_MIN_AMOUNT, Math.round(amount));
  return {
    id: `${GIFT_CARD_CUSTOM_PREFIX}${safe}`,
    name: {
      az: `Hədiyyə Kartı — ${safe} AZN`,
      ru: `Подарочная карта — ${safe} AZN`,
      en: `Gift Card — ${safe} AZN`,
    },
    description: {
      az: 'De Valeur saytında istənilən məhsulu almaq üçün dəyər kartı.',
      ru: 'Подарочная карта для покупок на De Valeur.',
      en: 'A De Valeur gift card to spend on any product.',
    },
    price: safe,
    images: [],
    brand: 'De Valeur',
    category: 'Gift Card',
    gender: 'unisex',
    stock: 9999,
    isEnabled: true,
    isGiftCard: true,
    visibleTo: 'all',
  } as unknown as Product;
};
