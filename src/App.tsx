import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BrandSlider from './components/BrandSlider';
import Hero from './components/Hero';
import HeroSecondary from './components/HeroSecondary';
import Features from './components/Features';
import CategoryBanner from './components/CategoryBanner';
import HomeProductBanners from './components/HomeProductBanners';
import BestSellersSection from './components/BestSellersSection';
import RedCarpetSection from './components/RedCarpetSection';
import AmbassadorSection from './components/AmbassadorSection';
import GiftFinderSection from './components/GiftFinderSection';
import CollectionTiles from './components/CollectionTiles';
import NewsTiles from './components/NewsTiles';
import HomeBlogSection from './components/HomeBlogSection';
import FeaturedStorySection from './components/FeaturedStorySection';
import RevealOnScroll from './components/RevealOnScroll';

// Heavy / non-critical səhifələr LAZY yüklənir — ilk açılış sürətli olsun
const AdminPanel = React.lazy(() => import('./components/admin/AdminPanel'));
const AdminLogin = React.lazy(() => import('./components/auth/AdminLogin'));
const B2BRequestForm = React.lazy(() => import('./components/auth/B2BRequestForm'));
const B2BLogin = React.lazy(() => import('./components/auth/B2BLogin'));
const ProductPage = React.lazy(() => import('./pages/ProductPage'));
const ProductDetailsPage = React.lazy(() => import('./pages/ProductDetailsPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const CartPage = React.lazy(() => import('./pages/CartPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const BlogPage = React.lazy(() => import('./pages/BlogPage'));
const BlogDetailPage = React.lazy(() => import('./pages/BlogDetailPage'));
const PartnersPage = React.lazy(() => import('./pages/PartnersPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const ReturnPolicyPage = React.lazy(() => import('./pages/ReturnPolicyPage'));
const CareersPage = React.lazy(() => import('./pages/CareersPage'));
const DeliveryPolicyPage = React.lazy(() => import('./pages/DeliveryPolicyPage'));
const CategoryPage = React.lazy(() => import('./pages/CategoryPage'));
const BrandPage = React.lazy(() => import('./pages/BrandPage'));
const B2BOrdersPage = React.lazy(() => import('./pages/B2BOrdersPage'));
const MyOrdersPage = React.lazy(() => import('./pages/MyOrdersPage'));
const ChangePasswordPage = React.lazy(() => import('./pages/ChangePasswordPage'));
const DeliveryPage = React.lazy(() => import('./pages/DeliveryPage'));
const PaymentSuccessPage = React.lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentErrorPage = React.lazy(() => import('./pages/PaymentErrorPage'));
const PaymentResultPage = React.lazy(() => import('./pages/PaymentResultPage'));
const WishlistPage = React.lazy(() => import('./pages/WishlistPage'));
const GiftCardsPage = React.lazy(() => import('./pages/GiftCardsPage'));
const GiftCardCheckoutPage = React.lazy(() => import('./pages/GiftCardCheckoutPage'));
const WorkerLogin = React.lazy(() => import('./pages/workers/WorkerLogin'));
const WorkerDashboard = React.lazy(() => import('./pages/workers/WorkerDashboard'));
const AiChatWidget = React.lazy(() => import('./components/AiChatWidget'));
const CampaignPopup = React.lazy(() => import('./components/CampaignPopup'));
const AdminGlobalNotifications = React.lazy(() => import('./components/AdminGlobalNotifications'));

import { WorkerAuthProvider } from './context/WorkerAuthContext';
import { useCart } from './context/CartContext';
import SuccessNotification from './components/SuccessNotification';
import ScrollToTop from './components/ScrollToTop';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './components/ui/NotificationProvider';
import './i18n';

// Minimal səhifə yüklənmə fallback-i — boş div, qaralma yaratmır
const PageFallback: React.FC = () => <div className="min-h-screen bg-white" />;

const DEFAULT_SECTION_ORDER = [
  'collectionTiles',
  'bestSellers',
  'heroSecondary',
  'redCarpet',
  'ambassador',
  'featuredStory',
  'giftFinder',
  'homeProductBanners',
  'homeBlogSection',
  'newsTiles',
  'categoryBanner',
];

const HomePage: React.FC = () => {
  const [order, setOrder] = React.useState<string[]>(DEFAULT_SECTION_ORDER);

  React.useEffect(() => {
    import('./services/contentService').then(({ getHomepageSections }) => {
      getHomepageSections()
        .then((sec) => {
          if (sec.sectionOrder && sec.sectionOrder.length > 0) {
            // Mövcud + default-da unutulan keyləri əlavə et (yeni section əlavə olunduqda)
            const merged = [
              ...sec.sectionOrder,
              ...DEFAULT_SECTION_ORDER.filter((k) => !sec.sectionOrder!.includes(k)),
            ];
            setOrder(merged);
          }
        })
        .catch(() => undefined);
    });
  }, []);

  const sectionMap: Record<string, React.ReactNode> = {
    collectionTiles: <CollectionTiles />,
    bestSellers: <BestSellersSection />,
    heroSecondary: <HeroSecondary />,
    redCarpet: <RedCarpetSection />,
    ambassador: <AmbassadorSection />,
    featuredStory: <FeaturedStorySection />,
    giftFinder: <GiftFinderSection />,
    homeProductBanners: (
      <RevealOnScroll variant="up">
        <HomeProductBanners />
      </RevealOnScroll>
    ),
    homeBlogSection: <HomeBlogSection />,
    newsTiles: (
      <RevealOnScroll variant="up">
        <NewsTiles />
      </RevealOnScroll>
    ),
    categoryBanner: (
      <RevealOnScroll variant="up">
        <CategoryBanner />
      </RevealOnScroll>
    ),
  };

  return (
    <div className="dv-homepage font-playfair">
      {/* Hero həmişə ən üstdə */}
      <Hero />

      {/* Admin-də müəyyən olunmuş sıra ilə qalan bölmələr */}
      {order.map((key) => (
        <React.Fragment key={key}>{sectionMap[key]}</React.Fragment>
      ))}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { notifications, removeNotification } = useCart();

  return (
    <>
      <div className="min-h-screen bg-white">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Worker routes */}
            <Route path="/workers" element={<WorkerLogin />} />
            <Route path="/workers/dashboard" element={<WorkerDashboard />} />

            {/* Existing Routes */}
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/b2b-request" element={<B2BRequestForm />} />
            <Route path="/b2b-login" element={<B2BLogin />} />
            <Route path="/delivery" element={<DeliveryPage />} />
            <Route path="/*" element={
              <>
                <Header />
                <main>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/product/:id" element={<ProductPage />} />
                      <Route path="/products/:productId" element={<ProductDetailsPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/blog" element={<BlogPage />} />
                      <Route path="/blog/:id" element={<BlogDetailPage />} />
                      <Route path="/partners" element={<PartnersPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                      <Route path="/return-policy" element={<ReturnPolicyPage />} />
                      <Route path="/careers" element={<CareersPage />} />
                      <Route path="/delivery-policy" element={<DeliveryPolicyPage />} />
                      <Route path="/category/:category" element={<CategoryPage />} />
                      <Route path="/brand/:brand" element={<BrandPage />} />
                      <Route path="/b2b/orders" element={<B2BOrdersPage />} />
                      <Route path="/my-orders" element={<MyOrdersPage />} />
                      <Route path="/change-password" element={<ChangePasswordPage />} />
                      <Route path="/payment/success" element={<PaymentSuccessPage />} />
                      <Route path="/payment/error" element={<PaymentErrorPage />} />
                      <Route path="/payment/result" element={<PaymentResultPage />} />
                      <Route path="/wishlist" element={<WishlistPage />} />
                      <Route path="/gift-cards" element={<GiftCardsPage />} />
                      <Route path="/gift-cards/checkout" element={<GiftCardCheckoutPage />} />
                    </Routes>
                  </Suspense>
                </main>
                <BrandSlider />
                <Footer />
              </>
            } />
          </Routes>
        </Suspense>
      </div>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3">
        {notifications.map((notification, index) => (
          <SuccessNotification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      <Suspense fallback={null}>
        <AiChatWidgetGate />
        <CampaignPopup />
        {/* Admin üçün qlobal sifariş bildiriş səsi — admin hansı səhifədə olursa olsun çalışır */}
        <AdminGlobalNotifications />
      </Suspense>
    </>
  );
};

// AI Chat is hidden for B2B users / admins / workers — only retail customers / guests see it
const AiChatWidgetGate: React.FC = () => {
  const [role, setRole] = React.useState<string | null>(() => localStorage.getItem('userRole'));

  React.useEffect(() => {
    const onStorage = () => setRole(localStorage.getItem('userRole'));
    window.addEventListener('storage', onStorage);
    // Also listen for custom auth events fired in same tab
    window.addEventListener('userRoleChanged', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('userRoleChanged', onStorage);
    };
  }, []);

  // Hide for B2B, admin, worker — show for guests and retail customers only
  if (role === 'b2b' || role === 'admin' || role === 'worker') return null;
  return <AiChatWidget />;
};

function App() {
  // Sayta giriş edən hər bir ziyarətçini gündəlik analitikaya əlavə et (sessiya başına 1 dəfə)
  React.useEffect(() => {
    import('./services/analyticsService').then(({ trackDailyVisit }) =>
      trackDailyVisit().catch(() => undefined)
    );
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <ScrollToTop />
        <NotificationProvider>
          <WorkerAuthProvider>
            <AppContent />
          </WorkerAuthProvider>
        </NotificationProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;