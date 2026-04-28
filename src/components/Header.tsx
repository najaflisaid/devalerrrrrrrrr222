import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, ShoppingCart, Menu, X, LogOut, ChevronDown, Bell, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import CustomerLogin from './auth/CustomerLogin';
import { productService } from '../services/productService';
import { getActiveB2BNotifications, B2BNotification } from '../services/b2bNotificationService';
import type { Product } from '../types';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getTotalItems, getUserDiscount, clearCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuClosing, setIsMobileMenuClosing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mobileMenuCloseTimeout, setMobileMenuCloseTimeout] = useState<NodeJS.Timeout | null>(null);
  const userDiscount = getUserDiscount();
  
  // B2B Bildiriş state-ləri
  const [b2bNotifications, setB2bNotifications] = useState<B2BNotification[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const previousRole = localStorage.getItem('userRole');
        try {
          const usersQuery = query(collection(db, 'users'), where('id', '==', user.uid));
          const usersSnapshot = await getDocs(usersQuery);

          if (!usersSnapshot.empty) {
            const userData = usersSnapshot.docs[0].data();
            const newRole = userData.role || 'customer';

            if (previousRole && previousRole !== newRole) {
              clearCart(true);
            }

            setIsLoggedIn(true);
            setUserName(userData.name || user.email || '');
            setUserRole(newRole);

            localStorage.setItem('userName', userData.name || user.email || '');
            localStorage.setItem('userRole', newRole);
            localStorage.setItem('userEmail', user.email || '');
            localStorage.setItem('userId', user.uid);

            // B2B istifadəçisi üçün bildirişləri yüklə
            if (newRole === 'b2b' || newRole === 'admin') {
              loadB2BNotifications();
            }
          } else {
            if (previousRole && previousRole !== 'customer') {
              clearCart(true);
            }

            setIsLoggedIn(true);
            setUserName(user.email || '');
            setUserRole('customer');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          const storedRole = localStorage.getItem('userRole') || 'customer';

          if (previousRole && previousRole !== storedRole) {
            clearCart(true);
          }

          setIsLoggedIn(true);
          setUserName(localStorage.getItem('userName') || user.email || '');
          setUserRole(storedRole);
        }
      } else {
        const hadUser = localStorage.getItem('userRole') !== null;
        if (hadUser) {
          clearCart(true);
        }

        setIsLoggedIn(false);
        setUserName('');
        setUserRole('');
      }
    });
    return () => unsubscribe();
  }, [clearCart]);


  useEffect(() => {
    loadCategoriesAndBrands();
  }, []);

  useEffect(() => {
    return () => {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
      }
    };
  }, [dropdownTimeout]);

  const loadCategoriesAndBrands = async () => {
    try {
      const products = await productService.getAll();
      const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
      const uniqueBrands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean);
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Error loading categories and brands:', error);
    }
  };

  // B2B bildirişləri yüklə
  const loadB2BNotifications = async () => {
    try {
      const notifs = await getActiveB2BNotifications();
      setB2bNotifications(notifs);
      
      // Oxunub-oxunmadığını yoxla
      const readKey = `b2b_notif_read_${new Date().toDateString()}`;
      if (sessionStorage.getItem(readKey)) {
        setNotificationsRead(true);
      }
      
      // Giriş edən kimi modal göstər
      if (notifs.length > 0) {
        const shownKey = `b2b_notif_shown_${new Date().toDateString()}`;
        if (!sessionStorage.getItem(shownKey)) {
          setShowNotificationModal(true);
          sessionStorage.setItem(shownKey, 'true');
        }
      }
    } catch (error) {
      console.error('Error loading B2B notifications:', error);
    }
  };

  // Bildirişləri oxunmuş kimi işarələ
  const markNotificationsAsRead = () => {
    setNotificationsRead(true);
    const readKey = `b2b_notif_read_${new Date().toDateString()}`;
    sessionStorage.setItem(readKey, 'true');
  };

  const handleDropdownEnter = () => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setIsDropdownClosing(false);
    setShowDropdown(true);
  };

  const handleDropdownLeave = () => {
    const timeout = setTimeout(() => {
      setIsDropdownClosing(true);
      setTimeout(() => {
        setShowDropdown(false);
        setIsDropdownClosing(false);
      }, 320);
    }, 120);
    setDropdownTimeout(timeout);
  };

  const closeMobileMenu = () => {
    if (mobileMenuCloseTimeout) {
      clearTimeout(mobileMenuCloseTimeout);
    }
    setIsMobileMenuClosing(true);
    const timeout = setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsMobileMenuClosing(false);
    }, 460);
    setMobileMenuCloseTimeout(timeout);
  };

  const getCategoryTranslation = (category: string) => {
    const categoryKey = category.toLowerCase().replace(/\s+/g, '');
    const translationKey = `category.${categoryKey}`;
    const translated = t(translationKey);
    return translated === translationKey ? category : translated;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('userDiscount');
      localStorage.removeItem('userDiscountType');
      localStorage.removeItem('userId');
      localStorage.removeItem('userData');
      clearCart(true);
      setIsLoggedIn(false);
      navigate('/');
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleLanguage = () => {
    const currentLang = i18n.language;
    let newLang = 'az';
    if (currentLang === 'az') {
      newLang = 'ru';
    } else if (currentLang === 'ru') {
      newLang = 'en';
    } else {
      newLang = 'az';
    }
    i18n.changeLanguage(newLang);
  };

  const getLanguageLabel = () => {
    const lang = i18n.language;
    if (lang === 'az') return 'AZ';
    if (lang === 'ru') return 'RU';
    return 'EN';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Track search analytics
      import('../services/analyticsService').then(({ trackSearch }) =>
        trackSearch(searchQuery.trim()).catch(() => undefined)
      );
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      closeSearchModal();
    }
  };

  const closeSearchModal = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setHighlightIndex(-1);
  };

  // Load products when search modal opens
  useEffect(() => {
    if (showSearch && allProducts.length === 0) {
      productService.getAll().then(setAllProducts).catch(() => setAllProducts([]));
    }
  }, [showSearch, allProducts.length]);

  // Filter products as user types
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setHighlightIndex(-1);
      return;
    }
    const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
    const matches = allProducts
      .filter((p) => {
        const nameAz = p.name?.az?.toLowerCase() || '';
        const nameRu = p.name?.ru?.toLowerCase() || '';
        const nameEn = p.name?.en?.toLowerCase() || '';
        const brand = (p.brand || '').toLowerCase();
        return nameAz.includes(q) || nameRu.includes(q) || nameEn.includes(q) || brand.includes(q);
      })
      .slice(0, 8);
    setSearchResults(matches);
    setHighlightIndex(matches.length > 0 ? 0 : -1);
    void lang;
  }, [searchQuery, allProducts, i18n.language]);

  const goToProduct = (p: Product) => {
    navigate(`/products/${p.id}`);
    closeSearchModal();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      goToProduct(searchResults[highlightIndex]);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => { setIsMobileMenuClosing(false); setIsMobileMenuOpen(true); }}>
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo - Center on Desktop */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none">
              <Link to="/">
                <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-10" />
              </Link>
            </div>

            {/* Desktop Navigation - Left */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.home')}
              </Link>

              {/* Products Dropdown with Categories & Brands */}
              <div
                className="relative"
                onMouseEnter={handleDropdownEnter}
                onMouseLeave={handleDropdownLeave}
              >
                <button className="dv-navlink flex items-center text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.products')}
                </button>

                {showDropdown && (
                  <div
                    className={`fixed left-0 right-0 top-[64px] z-50 dv-megamenu ${isDropdownClosing ? 'is-closing' : ''}`}
                    onMouseEnter={handleDropdownEnter}
                    onMouseLeave={handleDropdownLeave}
                  >
                    {/* invisible bridge to prevent hover gap between trigger and panel */}
                    <div className="h-2 -mt-2" aria-hidden="true" />
                    <div className="bg-white border-t border-gray-100 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)]">
                      <div className="max-w-[1200px] mx-auto px-10 py-12">
                        <div className="grid grid-cols-2 gap-16">
                          {/* Categories Section */}
                          <div className="dv-mega-section dv-mega-section-1">
                            <h3 className="text-[11px] tracking-[0.2em] text-gray-700 uppercase mb-6 font-semibold">
                              {t('header.categories')}
                            </h3>
                            <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                              {categories.map((category, idx) => (
                                <li key={category}>
                                  <button
                                    onClick={() => {
                                      navigate(`/products?category=${encodeURIComponent(category)}`);
                                      setShowDropdown(false);
                                    }}
                                    style={{ ['--dv-i' as any]: idx }}
                                    className="dv-mega-link group block w-full text-left text-sm text-gray-700 hover:text-black py-2 capitalize transition-colors"
                                    data-testid={`menu-category-${category}`}
                                  >
                                    <span className="dv-mega-text">{getCategoryTranslation(category)}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Brands Section */}
                          <div className="dv-mega-section dv-mega-section-2">
                            <h3 className="text-[11px] tracking-[0.2em] text-gray-700 uppercase mb-6 font-semibold">
                              {t('header.brands')}
                            </h3>
                            <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                              {brands.map((brand, idx) => (
                                <li key={brand}>
                                  <button
                                    onClick={() => {
                                      navigate(`/products?brand=${encodeURIComponent(brand)}`);
                                      setShowDropdown(false);
                                    }}
                                    style={{ ['--dv-i' as any]: idx }}
                                    className="dv-mega-link group block w-full text-left text-sm text-gray-700 hover:text-black py-2 transition-colors"
                                    data-testid={`menu-brand-${brand}`}
                                  >
                                    <span className="dv-mega-text">{brand}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link to="/about" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.about')}
              </Link>
              <Link to="/blog" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.blog')}
              </Link>
              <Link to="/partners" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.partners')}
              </Link>
              <Link to="/contact" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.contact')}
              </Link>
              {isLoggedIn && userRole === 'customer' && (
                <Link to="/my-orders" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap" data-testid="header-my-orders-link">
                  Sifarişlərim
                </Link>
              )}
              {isLoggedIn && userRole === 'b2b' && (
                <Link to="/b2b/orders" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.myOrders')}
                </Link>
              )}
              {isLoggedIn && userRole === 'admin' && (
                <Link to="/admin" className="dv-navlink text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.admin')}
                </Link>
              )}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
              <button
                onClick={toggleLanguage}
                className="hidden md:block text-sm font-medium text-gray-900 hover:text-gray-600 uppercase"
              >
                {getLanguageLabel()}
              </button>

              <button
                onClick={() => setShowSearch(true)}
                className="p-1 -m-1"
                aria-label="Search"
                data-testid="header-search-btn"
              >
                <Search className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" />
              </button>

              {/* B2B Bildiriş İkonu */}
              {isLoggedIn && (userRole === 'b2b' || userRole === 'admin') && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotificationDropdown(!showNotificationDropdown);
                      if (!showNotificationDropdown) {
                        markNotificationsAsRead();
                      }
                    }}
                    className="relative p-1"
                  >
                    <Bell className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" />
                    {b2bNotifications.length > 0 && !notificationsRead && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold ring-2 ring-white">
                        {b2bNotifications.length}
                      </span>
                    )}
                  </button>

                  {/* Bildiriş Dropdown */}
                  {showNotificationDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="h-5 w-5" />
                          <span className="font-semibold text-lg">Bildirişlər</span>
                        </div>
                        <button 
                          onClick={() => setShowNotificationDropdown(false)}
                          className="hover:bg-white/20 p-1 rounded-full transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-80">
                        {b2bNotifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Bell className="h-8 w-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">Bildiriş yoxdur</p>
                          </div>
                        ) : (
                          b2bNotifications.map((notif, index) => (
                            <div 
                              key={notif.id} 
                              className={`p-5 bg-gray-700 hover:bg-gray-600 transition-colors ${index !== b2bNotifications.length - 1 ? 'border-b border-gray-600' : ''}`}
                            >
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-white break-words">{notif.title}</h4>
                                <p className="text-gray-200 text-sm mt-1 break-words whitespace-pre-wrap">{notif.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isLoggedIn ? (
                <>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="hidden md:flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <User className="h-5 w-5 mr-1" />
                    <span>{t('header.login')}</span>
                  </button>
                  <Link to="/b2b-login" className="hidden md:block text-sm font-medium text-gray-700 hover:text-gray-900">
                    B2B
                  </Link>
                </>
              ) : (
                <div className="hidden md:flex items-center space-x-3">
                  <span className="text-sm text-gray-700 font-medium">{userName}</span>
                  <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              )}

              <button onClick={() => navigate('/cart')} className="relative p-1 -m-1" aria-label="Cart">
                <ShoppingCart className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold ring-2 ring-white">
                    {getTotalItems()}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/wishlist')}
                className="relative p-1 -m-1"
                title="Wishlist"
                data-testid="header-wishlist-btn"
              >
                <Heart className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900 transition-colors" />
                {wishlistCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold ring-2 ring-white"
                    data-testid="header-wishlist-count"
                  >
                    {wishlistCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            <div
              className={`fixed inset-0 z-50 bg-black/55 dv-menu-backdrop ${isMobileMenuClosing ? 'is-closing' : ''}`}
              onClick={closeMobileMenu}
            ></div>

            <div
              className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 bg-white dv-menu-panel ${isMobileMenuClosing ? 'is-closing' : ''}`}
              style={{ boxShadow: '40px 0 80px -20px rgba(0,0,0,0.35)' }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-10" />
                <button onClick={closeMobileMenu} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex flex-col h-[calc(100%-80px)] overflow-y-auto">
                <nav className="flex-1 p-6 space-y-1">
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 0 }}>
                  <Link
                    to="/"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.home')}
                  </Link>
                  </div>
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 1 }}>
                  <Link
                    to="/products"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.products')}
                  </Link>
                  </div>

                  {/* Mobile Categories Dropdown */}
                  <div className="dv-menu-item px-4 py-2" style={{ ['--dv-i' as any]: 2 }}>
                    <details className="group">
                      <summary className="py-2 font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>{t('header.categories')}</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 ml-4 space-y-2">
                        {categories.map((category) => (
                          <button
                            key={category}
                            onClick={() => {
                              navigate(`/products?category=${encodeURIComponent(category)}`);
                              closeMobileMenu();
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded capitalize"
                          >
                            {getCategoryTranslation(category)}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>

                  {/* Mobile Brands Dropdown */}
                  <div className="dv-menu-item px-4 py-2" style={{ ['--dv-i' as any]: 3 }}>
                    <details className="group">
                      <summary className="py-2 font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>{t('header.brands')}</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 ml-4 space-y-2">
                        {brands.map((brand) => (
                          <button
                            key={brand}
                            onClick={() => {
                              navigate(`/products?brand=${encodeURIComponent(brand)}`);
                              closeMobileMenu();
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                          >
                            {brand}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 4 }}>
                  <Link
                    to="/about"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.about')}
                  </Link>
                  </div>
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 5 }}>
                  <Link
                    to="/blog"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.blog')}
                  </Link>
                  </div>
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 6 }}>
                  <Link
                    to="/partners"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.partners')}
                  </Link>
                  </div>
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 7 }}>
                  <Link
                    to="/contact"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    {t('header.contact')}
                  </Link>
                  </div>

                  {isLoggedIn && userRole === 'customer' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 8 }}>
                    <Link
                      to="/my-orders"
                      className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={closeMobileMenu}
                    >
                      Sifarişlərim
                    </Link>
                    </div>
                  )}

                  {isLoggedIn && userRole === 'b2b' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 8 }}>
                    <Link
                      to="/b2b/orders"
                      className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={closeMobileMenu}
                    >
                      {t('header.myOrders')}
                    </Link>
                    </div>
                  )}

                  {isLoggedIn && userRole === 'admin' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 9 }}>
                    <Link
                      to="/admin"
                      className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={closeMobileMenu}
                    >
                      {t('header.admin')}
                    </Link>
                    </div>
                  )}
                </nav>

                {/* Mobile Menu Footer */}
                <div className="border-t border-gray-100 p-6 space-y-3">
                  {/* Language Switcher */}
                  <button
                    onClick={() => {
                      toggleLanguage();
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="font-medium text-gray-700">{t('header.language')}</span>
                    <span className="text-sm font-bold text-gray-900 uppercase">{getLanguageLabel()}</span>
                  </button>

                  {/* Login/Logout */}
                  {!isLoggedIn ? (
                    <>
                      <button
                        onClick={() => {
                          setShowLoginModal(true);
                          closeMobileMenu();
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors"
                      >
                        <User className="h-5 w-5" />
                        <span className="font-medium">{t('header.login')}</span>
                      </button>
                      <Link
                        to="/b2b-login"
                        onClick={closeMobileMenu}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <User className="h-5 w-5" />
                        <span className="font-medium">B2B {t('header.login')}</span>
                      </Link>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">{t('header.welcomeUser')}</p>
                        <p className="font-medium text-gray-900">{userName}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleLogout();
                          closeMobileMenu();
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">{t('header.logout')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {showLoginModal && <CustomerLogin onClose={() => setShowLoginModal(false)} />}

      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-24" onClick={closeSearchModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearch} className="p-6">
              <div className="flex items-center gap-4">
                <Search className="h-6 w-6 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('header.search')}
                  className="flex-1 text-lg outline-none text-gray-900 placeholder-gray-400"
                  autoFocus
                  data-testid="header-search-input"
                />

                <button
                  type="button"
                  onClick={closeSearchModal}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="header-search-close-btn"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {searchQuery && searchResults.length > 0 && (
                <ul
                  className="mt-4 max-h-96 overflow-y-auto divide-y divide-gray-100 border-t border-gray-100"
                  data-testid="header-search-results"
                >
                  {searchResults.map((p, idx) => {
                    const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
                    const displayName = p.name?.[lang] || p.name?.az || p.name?.en || '';
                    const isActive = idx === highlightIndex;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => goToProduct(p)}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                            isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                          data-testid={`header-search-result-${p.id}`}
                        >
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt={displayName}
                              className="w-12 h-12 object-cover rounded bg-gray-50 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                            <div className="text-xs text-gray-500 truncate">{p.brand}</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
                            {(p.salePrice ?? p.price)} ₼
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="mt-4 text-center text-sm text-gray-500 py-6" data-testid="header-search-no-results">
                  {t('common.noResults', 'Nəticə tapılmadı')}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* B2B Bildiriş Modalı */}
      {showNotificationModal && b2bNotifications.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl transform transition-all">
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-xl">Bildirişlər</h2>
                  <p className="text-white/70 text-sm">{b2bNotifications.length} yeni bildiriş</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNotificationModal(false);
                  markNotificationsAsRead();
                }}
                className="hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[55vh]">
              {b2bNotifications.map((notif, index) => (
                <div
                  key={notif.id}
                  className="bg-gray-700 border border-gray-600 rounded-2xl p-5 shadow-sm hover:bg-gray-600 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-lg break-words">{notif.title}</h3>
                    <p className="text-gray-200 mt-2 whitespace-pre-wrap break-words leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-5 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowNotificationModal(false);
                  markNotificationsAsRead();
                }}
                className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white py-3.5 rounded-xl hover:from-gray-800 hover:to-gray-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Oxudum, Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
