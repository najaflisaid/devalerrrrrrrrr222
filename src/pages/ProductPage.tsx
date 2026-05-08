import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Share2, ShoppingBag, PackageCheck, ShieldCheck, RotateCcw, Plus, Minus, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { useCart } from '../context/CartContext';
import CreditApplicationForm from '../components/CreditApplicationForm';
import ProductReviews from '../components/ProductReviews';
import { trackProductView } from '../services/analyticsService';
import type { Product } from '../types';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isB2BUser, setIsB2BUser] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('description');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    setIsB2BUser(userRole === 'b2b');
    if (id) loadProduct(id);
    // Reset state on navigation between products
    setCurrentImageIndex(0);
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  const loadProduct = async (productId: string) => {
    setLoading(true);
    try {
      const products = await productService.getAll();
      const foundProduct = products.find((p) => p.id === productId);
      setProduct(foundProduct || null);
      if (foundProduct) {
        const name = foundProduct.name?.az || foundProduct.name?.en || '';
        trackProductView(foundProduct.id, { name, image: foundProduct.images?.[0] }).catch(() => undefined);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (product) addToCart(product, quantity);
    navigate('/cart');
  };

  const handleAddToCart = () => {
    if (product) addToCart(product, quantity);
  };

  const nextImage = () => {
    if (product) setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    if (product) setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const getName = (p: Product) =>
    p.name[i18n.language as 'az' | 'ru' | 'en'] || p.name.en || p.name.az || '';

  const handleShare = async () => {
    if (!product) return;
    const productName = getName(product);
    const shareData = { title: productName, text: `${productName} — De Valeur`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-black/15 border-t-black" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-light text-black mb-3">{t('product.notFound')}</h1>
          <Link to="/" className="text-black underline underline-offset-4 hover:opacity-70">
            {t('product.returnHome')}
          </Link>
        </div>
      </div>
    );
  }

  const productName = getName(product);
  const description = product.description?.[i18n.language as 'az' | 'ru' | 'en'] || product.description?.en || product.description?.az || '';
  const onSale = !!product.salePrice && product.salePrice < product.price;
  const discountPct = onSale ? Math.round(((product.price - product.salePrice!) / product.price) * 100) : 0;
  const inStock = (product.stock ?? 0) > 0 || product.stock === undefined;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 py-6 lg:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[12px] text-black/55 mb-6 lg:mb-10 uppercase tracking-[0.18em]">
          <Link to="/" className="hover:text-black transition-colors">{t('product.home')}</Link>
          <span className="text-black/25">/</span>
          <Link to={`/category/${product.category}`} className="hover:text-black transition-colors capitalize truncate max-w-[150px]">
            {product.category}
          </Link>
          <span className="text-black/25">/</span>
          <span className="text-black truncate max-w-[260px] normal-case tracking-normal">{productName}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16">
          {/* LEFT — Gallery */}
          <div>
            <div className="relative aspect-square bg-white border border-black/10 overflow-hidden">
              {onSale && (
                <span className="absolute top-4 left-4 z-10 bg-[#D14545] text-white text-[10px] tracking-[0.22em] uppercase px-2.5 py-1 font-medium">
                  −{discountPct}%
                </span>
              )}

              <img
                src={product.images?.[currentImageIndex]}
                alt={productName}
                className="w-full h-full object-contain p-8 sm:p-12"
              />

              {product.images?.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    aria-label="Previous"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white border border-black/10 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={nextImage}
                    aria-label="Next"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white border border-black/10 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails — show OTHER images (not the currently displayed main image) */}
            {product.images?.length > 1 && (
              <div className="grid grid-cols-2 gap-2 mt-3 pb-1" data-testid="product-thumbnails">
                {product.images
                  .map((img, originalIndex) => ({ img, originalIndex }))
                  .filter(({ originalIndex }) => originalIndex !== currentImageIndex)
                  .map(({ img, originalIndex }) => (
                  <button
                    key={originalIndex}
                    onClick={() => setCurrentImageIndex(originalIndex)}
                    aria-label={`Image ${originalIndex + 1}`}
                    className="aspect-square border border-black/[0.06] hover:border-black/30 bg-white overflow-hidden transition-colors"
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-2.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Info */}
          <div className="lg:pl-2">
            <p className="text-[11px] uppercase tracking-[0.32em] text-black/50 mb-3" data-testid="product-brand">
              {product.brand}
            </p>
            <h1
              className="text-[26px] sm:text-[32px] lg:text-[36px] font-light leading-[1.1] tracking-tight text-black mb-4"
              data-testid="product-name"
            >
              {productName}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              {onSale ? (
                <>
                  <span className="text-[26px] font-medium text-[#D14545] tabular-nums">
                    {product.salePrice!.toFixed(2)} AZN
                  </span>
                  <span className="text-[16px] text-black/40 line-through tabular-nums">
                    {product.price.toFixed(2)} AZN
                  </span>
                </>
              ) : (
                <span className="text-[26px] font-medium text-black tabular-nums">
                  {product.price.toFixed(2)} AZN
                </span>
              )}
            </div>

            {/* Stock — show only when out of stock */}
            {!inStock && (
              <div className="flex items-center gap-2 mb-6" data-testid="product-stock-status">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[12px] uppercase tracking-[0.18em] text-red-600">
                  {t('product.outOfStock', { defaultValue: 'Bitdi' })}
                </span>
              </div>
            )}

            <div className="border-t border-black/10 pt-6 space-y-5">
              {/* Quantity selector */}
              <div className="flex items-center gap-4">
                <span className="text-[12px] uppercase tracking-[0.22em] text-black/55">
                  {t('product.quantity')}
                </span>
                <div className="inline-flex items-center border border-black/25">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease"
                    className="w-10 h-10 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                    data-testid="product-qty-minus"
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                  <span className="w-12 text-center text-[14px] leading-10 border-x border-black/25 select-none">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Increase"
                    className="w-10 h-10 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                    data-testid="product-qty-plus"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2.5">
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="w-full h-11 bg-black text-white text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-black/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="product-add-to-cart"
                >
                  <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {t('product.addToCart')}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={!inStock}
                  className="w-full h-11 bg-white text-black border border-black text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="product-buy-now"
                >
                  {t('product.buyNow')}
                </button>
                {!isB2BUser && (
                  <button
                    onClick={() => setShowCreditForm(true)}
                    className="w-full h-11 bg-emerald-600 text-white text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-emerald-700 transition-colors"
                    data-testid="product-credit-btn"
                  >
                    {t('product.buyWithCredit')}
                  </button>
                )}
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-black/65 hover:text-black transition-colors"
                data-testid="product-share-btn"
              >
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{copied ? t('product.linkCopied', { defaultValue: 'Köçürüldü' }) : t('product.share')}</span>
              </button>
            </div>

            {/* Trust badges */}
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                { icon: PackageCheck, label: t('product.freeDelivery', { defaultValue: 'Ödənişsiz çatdırılma' }) },
                { icon: ShieldCheck, label: t('product.warranty', { defaultValue: 'Rəsmi zəmanət' }) },
                { icon: RotateCcw, label: t('product.returns', { defaultValue: '14 gün ərzində qaytarılma' }) },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 px-1 py-3 border border-black/10">
                  <b.icon className="w-4 h-4 text-black/70" strokeWidth={1.5} />
                  <span className="text-[10px] uppercase tracking-[0.16em] text-black/65 leading-tight">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Accordion sections */}
            <div className="mt-10 border-t border-black/10">
              {[
                { id: 'description', title: t('product.description'), content: description },
                {
                  id: 'details',
                  title: t('product.details', { defaultValue: 'Məhsul məlumatları' }),
                  rows: [
                    { k: t('product.brand'), v: product.brand },
                    { k: t('product.category'), v: product.category },
                    {
                      k: t('product.gender'),
                      v: product.gender === 'men'
                        ? t('product.genderMen', { defaultValue: 'Kişi' })
                        : product.gender === 'women'
                          ? t('product.genderWomen', { defaultValue: 'Qadın' })
                          : t('product.genderUnisex', { defaultValue: 'Unisex' }),
                    },
                  ],
                },
                {
                  id: 'shipping',
                  title: t('product.shippingReturns', { defaultValue: 'Çatdırılma' }),
                  content: t('product.shippingInfo', {
                    defaultValue: 'Şəhər daxili gün ərzində ödənişsiz çatdırılma. Bölgələrə poçtla çatdırılma.',
                  }),
                },
              ].map((s) => (
                <div key={s.id} className="border-b border-black/10">
                  <button
                    onClick={() => setOpenSection(openSection === s.id ? null : s.id)}
                    className="w-full flex items-center justify-between py-4 text-left"
                    data-testid={`product-accordion-${s.id}`}
                  >
                    <span className="text-[12px] uppercase tracking-[0.22em] text-black">{s.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${openSection === s.id ? 'rotate-180' : ''}`}
                      strokeWidth={1.5}
                    />
                  </button>
                  {openSection === s.id && (
                    <div className="pb-5 pr-4">
                      {'content' in s && s.content && (
                        <p className="text-[14px] leading-relaxed text-black/70 whitespace-pre-line">{s.content}</p>
                      )}
                      {'rows' in s && s.rows && (
                        <dl className="space-y-2.5">
                          {s.rows.map((r) => (
                            <div key={r.k} className="flex items-baseline justify-between gap-4 text-[13px]">
                              <dt className="text-black/55 uppercase tracking-[0.14em] text-[11px]">{r.k}</dt>
                              <dd className="text-black capitalize text-right">{r.v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-16 lg:mt-24 border-t border-black/10 pt-12">
          <ProductReviews productId={product.id} />
        </div>
      </div>

      {showCreditForm && (
        <CreditApplicationForm
          productName={productName}
          productPrice={product.salePrice || product.price}
          onClose={() => setShowCreditForm(false)}
        />
      )}
    </div>
  );
};

export default ProductPage;
