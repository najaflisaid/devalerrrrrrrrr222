import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, ShoppingCart, Menu, X, LogOut, ChevronDown, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import CustomerLogin from './auth/CustomerLogin';
import { productService } from '../services/productService';
import { getActiveB2BNotifications, B2BNotification } from '../services/b2bNotificationService';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getTotalItems, getUserDiscount, clearCart } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);
  const userDiscount = getUserDiscount();
  
  // B2B Bildiriş state-ləri
  const [b2bNotifications, setB2bNotifications] = useState<B2BNotification[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

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
              clearCart();
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
              clearCart();
            }

            setIsLoggedIn(true);
            setUserName(user.email || '');
            setUserRole('customer');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          const storedRole = localStorage.getItem('userRole') || 'customer';

          if (previousRole && previousRole !== storedRole) {
            clearCart();
          }

          setIsLoggedIn(true);
          setUserName(localStorage.getItem('userName') || user.email || '');
          setUserRole(storedRole);
        }
      } else {
        const hadUser = localStorage.getItem('userRole') !== null;
        if (hadUser) {
          clearCart();
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

  const handleDropdownEnter = () => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setShowDropdown(true);
  };

  const handleDropdownLeave = () => {
    const timeout = setTimeout(() => {
      setShowDropdown(false);
    }, 200);
    setDropdownTimeout(timeout);
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
      clearCart();
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
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
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
              <Link to="/" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.home')}
              </Link>

              {/* Products Dropdown with Categories & Brands */}
              <div
                className="relative"
                onMouseEnter={handleDropdownEnter}
                onMouseLeave={handleDropdownLeave}
              >
                <button className="flex items-center text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.products')}
                </button>

                {showDropdown && (
                  <div
                    className="fixed left-0 right-0 top-[64px] bg-white shadow-2xl border-t border-gray-200 animate-slideDown z-50"
                    onMouseEnter={handleDropdownEnter}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <div className="max-w-[1440px] mx-auto px-8">
                      <div className="grid grid-cols-2 divide-x divide-gray-200">
                        {/* Categories Section */}
                        <div className="py-8 pr-8">
                          <h3 className="font-bold text-gray-900 mb-6 text-lg uppercase tracking-wide">{t('header.categories')}</h3>
                          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                            {categories.map((category) => (
                              <button
                                key={category}
                                onClick={() => {
                                  navigate(`/products?category=${encodeURIComponent(category)}`);
                                  setShowDropdown(false);
                                }}
                                className="text-left text-sm text-gray-700 hover:text-black px-4 py-2.5 rounded-lg transition-all capitalize font-medium hover:bg-gray-50"
                              >
                                {getCategoryTranslation(category)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Brands Section */}
                        <div className="py-8 pl-8">
                          <h3 className="font-bold text-gray-900 mb-6 text-lg uppercase tracking-wide">{t('header.brands')}</h3>
                          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                            {brands.map((brand) => (
                              <button
                                key={brand}
                                onClick={() => {
                                  navigate(`/products?brand=${encodeURIComponent(brand)}`);
                                  setShowDropdown(false);
                                }}
                                className="text-left text-sm text-gray-700 hover:text-black px-4 py-2.5 rounded-lg transition-all font-medium hover:bg-gray-50"
                              >
                                {brand}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link to="/about" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.about')}
              </Link>
              <Link to="/blog" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.blog')}
              </Link>
              <Link to="/partners" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.partners')}
              </Link>
              <Link to="/contact" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                {t('header.contact')}
              </Link>
              {isLoggedIn && userRole === 'b2b' && (
                <Link to="/b2b/orders" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.myOrders')}
                </Link>
              )}
              {isLoggedIn && userRole === 'admin' && (
                <Link to="/admin" className="text-gray-900 hover:text-gray-600 font-medium text-sm whitespace-nowrap">
                  {t('header.admin')}
                </Link>
              )}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleLanguage}
                className="hidden md:block text-sm font-medium text-gray-900 hover:text-gray-600 uppercase"
              >
                {getLanguageLabel()}
              </button>

              <Search
                onClick={() => setShowSearch(true)}
                className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900"
              />

              {/* B2B Bildiriş İkonu */}
              {isLoggedIn && (userRole === 'b2b' || userRole === 'admin') && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                    className="relative p-1"
                  >
                    <Bell className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" />
                    {b2bNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
                        {b2bNotifications.length}
                      </span>
                    )}
                  </button>

                  {/* Bildiriş Dropdown */}
                  {showNotificationDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
                        <span className="font-semibold">Bildirişlər</span>
                        <button onClick={() => setShowNotificationDropdown(false)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-72">
                        {b2bNotifications.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            Bildiriş yoxdur
                          </div>
                        ) : (
                          b2bNotifications.map((notif) => (
                            <div key={notif.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                              <h4 className="font-semibold text-gray-900 text-sm">{notif.title}</h4>
                              <p className="text-gray-600 text-xs mt-1 line-clamp-2">{notif.message}</p>
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

              <button onClick={() => navigate('/cart')} className="relative">
                <ShoppingCart className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {getTotalItems()}
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
              className="fixed inset-0 z-50 bg-black bg-opacity-60 animate-fadeIn"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>

            <div className="fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 bg-white shadow-2xl animate-slideInLeft">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-10" />
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex flex-col h-[calc(100%-80px)] overflow-y-auto">
                <nav className="flex-1 p-6 space-y-1">
                  <Link
                    to="/"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.home')}
                  </Link>
                  <Link
                    to="/products"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.products')}
                  </Link>

                  {/* Mobile Categories Dropdown */}
                  <div className="px-4 py-2">
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
                              setIsMobileMenuOpen(false);
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
                  <div className="px-4 py-2">
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
                              setIsMobileMenuOpen(false);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                          >
                            {brand}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>

                  <Link
                    to="/about"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.about')}
                  </Link>
                  <Link
                    to="/blog"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.blog')}
                  </Link>
                  <Link
                    to="/partners"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.partners')}
                  </Link>
                  <Link
                    to="/contact"
                    className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('header.contact')}
                  </Link>

                  {isLoggedIn && userRole === 'b2b' && (
                    <Link
                      to="/b2b/orders"
                      className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t('header.myOrders')}
                    </Link>
                  )}

                  {isLoggedIn && userRole === 'admin' && (
                    <Link
                      to="/admin"
                      className="block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t('header.admin')}
                    </Link>
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
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors"
                      >
                        <User className="h-5 w-5" />
                        <span className="font-medium">{t('header.login')}</span>
                      </button>
                      <Link
                        to="/b2b-login"
                        onClick={() => setIsMobileMenuOpen(false)}
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
                          setIsMobileMenuOpen(false);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-24">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <form onSubmit={handleSearch} className="p-6">
              <div className="flex items-center gap-4">
                <Search className="h-6 w-6 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('header.search')}
                  className="flex-1 text-lg outline-none"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {searchQuery && (
                <div className="mt-4 text-center">
                  <button className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800">
                    {t('header.searchButton')}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* B2B Bildiriş Modalı */}
      {showNotificationModal && b2bNotifications.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-fadeIn">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <h2 className="font-semibold text-lg">Bildirişlər</h2>
              </div>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {b2bNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{notif.title}</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{notif.message}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
