import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BrandSlider from './components/BrandSlider';
import Hero from './components/Hero';
import Features from './components/Features';
import CategoryBanner from './components/CategoryBanner';
import HomeProductBanners from './components/HomeProductBanners';
import BestSellersSection from './components/BestSellersSection';
import StatsBand from './components/StatsBand';
import SignaturePiece3D from './components/SignaturePiece3D';
import AdminPanel from './components/admin/AdminPanel';
import AdminLogin from './components/auth/AdminLogin';
import B2BRequestForm from './components/auth/B2BRequestForm';
import B2BLogin from './components/auth/B2BLogin';
import ProductPage from './pages/ProductPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import AboutPage from './pages/AboutPage';
import BlogPage from './pages/BlogPage';
import BlogDetailPage from './pages/BlogDetailPage';
import PartnersPage from './pages/PartnersPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ReturnPolicyPage from './pages/ReturnPolicyPage';
import CareersPage from './pages/CareersPage';
import DeliveryPolicyPage from './pages/DeliveryPolicyPage';
import CategoryPage from './pages/CategoryPage';
import BrandPage from './pages/BrandPage';
import B2BOrdersPage from './pages/B2BOrdersPage';
import WorkerLogin from './pages/workers/WorkerLogin';
import WorkerDashboard from './pages/workers/WorkerDashboard';
import { WorkerAuthProvider } from './context/WorkerAuthContext';
import { useCart } from './context/CartContext';
import SuccessNotification from './components/SuccessNotification';
import ScrollToTop from './components/ScrollToTop';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './components/ui/NotificationProvider';
import './i18n';

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <BestSellersSection />
      <SignaturePiece3D />
      <HomeProductBanners />
      <StatsBand />
      <Features />
      <CategoryBanner />
    </>
  );
};

const AppContent: React.FC = () => {
  const { notifications, removeNotification } = useCart();

  return (
    <>
      <div className="min-h-screen bg-white">
        <Routes>
          {/* Worker routes */}
          <Route path="/workers" element={<WorkerLogin />} />
          <Route path="/workers/dashboard" element={<WorkerDashboard />} />

          {/* Existing Routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/b2b-request" element={<B2BRequestForm />} />
          <Route path="/b2b-login" element={<B2BLogin />} />
          <Route path="/*" element={
            <>
              <Header />
              <main>
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
                  <Route path="/delivery" element={<DeliveryPolicyPage />} />
                  <Route path="/category/:category" element={<CategoryPage />} />
                  <Route path="/brand/:brand" element={<BrandPage />} />
                  <Route path="/b2b/orders" element={<B2BOrdersPage />} />
                </Routes>
              </main>
              <BrandSlider />
              <Footer />
            </>
          } />
        </Routes>
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
    </>
  );
};

function App() {
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