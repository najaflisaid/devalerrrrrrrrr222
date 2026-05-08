import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, ShoppingCart, Menu, X, LogOut, ChevronDown, Bell, Heart, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import CustomerLogin from './auth/CustomerLogin';
import { productService } from '../services/productService';
import { getCategoryTree, type CategoryNode } from '../services/categoryService';
import { getActiveB2BNotifications, B2BNotification } from '../services/b2bNotificationService';
import { toBrandSlug } from '../utils/brandSlug';
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
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showMobileLangDropdown, setShowMobileLangDropdown] = useState(false);
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  // Kategori hierarxiyası (parent → alt-kategori). Firestore-dan oxunur.
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  // Hər kategoriyaya aid məhsul siyahısı — mega menyuda kategoriyaya hover edəndə həmin kateqoriyanın brendləri görünür
  const [productsByCategory, setProductsByCategory] = useState<Record<string, string[]>>({});
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  // Mobil menyu üçün açıq/qapalı state-lər
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState<string | null>(null);
  const [mobileSubCategoryOpen, setMobileSubCategoryOpen] = useState<string | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null); // legacy, unused – retained only to avoid cascading changes
  const [mobileMenuCloseTimeout, setMobileMenuCloseTimeout] = useState<NodeJS.Timeout | null>(null);
  const userDiscount = getUserDiscount();
  void dropdownTimeout; void setDropdownTimeout;
  
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

            // Hər login dəyişiminde (guest→login və ya rol dəyişəndə) səbət təmizlənsin.
            // Eyni rolla yenidən bağlanan token-refresh halında dəyişmir.
            if (previousRole !== newRole) {
              clearCart(true);
            }

            setIsLoggedIn(true);
            setUserName(userData.name || user.email || '');
            setUserRole(newRole);

            localStorage.setItem('userName', userData.name || user.email || '');
            localStorage.setItem('userRole', newRole);
            window.dispatchEvent(new Event('userRoleChanged'));
            localStorage.setItem('userEmail', user.email || '');
            localStorage.setItem('userId', user.uid);

            // B2B istifadəçisi üçün bildirişləri yüklə
            if (newRole === 'b2b' || newRole === 'admin') {
              loadB2BNotifications();
            }
          } else {
            if (previousRole !== 'customer') {
              clearCart(true);
            }

            setIsLoggedIn(true);
            setUserName(user.email || '');
            setUserRole('customer');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          const storedRole = localStorage.getItem('userRole') || 'customer';

          if (previousRole !== storedRole) {
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

  const dropdownTimersRef = useRef<{ outer: ReturnType<typeof setTimeout> | null; inner: ReturnType<typeof setTimeout> | null }>({ outer: null, inner: null });

  useEffect(() => {
    return () => {
      if (dropdownTimersRef.current.outer) clearTimeout(dropdownTimersRef.current.outer);
      if (dropdownTimersRef.current.inner) clearTimeout(dropdownTimersRef.current.inner);
    };
  }, []);

  const loadCategoriesAndBrands = async () => {
    try {
      const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
      const [products, tree] = await Promise.all([
        productService.getAll(),
        getCategoryTree(lang),
      ]);
      const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
      const uniqueBrands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean);
      // Hər kategoriya üçün o kategoriyaya aid brendləri qruplaşdır (kategori adı ilə index)
      const byCat: Record<string, string[]> = {};
      products.forEach(p => {
        if (!p.category || !p.brand) return;
        if (!byCat[p.category]) byCat[p.category] = [];
        if (!byCat[p.category].includes(p.brand)) byCat[p.category].push(p.brand);
      });
      Object.keys(byCat).forEach(k => byCat[k].sort((a, b) => a.localeCompare(b, 'az')));
      // Parent kategori üçün — onun bütün alt-kategoriyalarındakı brendlər də daxil olur
      const enrichBrandsForParents = (node: CategoryNode) => {
        const allNames = [node.nameAz, node.nameRu, node.nameEn].filter(Boolean);
        const collected = new Set<string>();
        allNames.forEach(n => (byCat[n] || []).forEach(b => collected.add(b)));
        node.children.forEach(child => {
          enrichBrandsForParents(child);
          [child.nameAz, child.nameRu, child.nameEn].filter(Boolean).forEach(n => {
            (byCat[n] || []).forEach(b => collected.add(b));
          });
        });
        if (collected.size > 0) {
          allNames.forEach(n => {
            byCat[n] = Array.from(collected).sort((a, b) => a.localeCompare(b, 'az'));
          });
        }
      };
      tree.forEach(enrichBrandsForParents);
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
      setProductsByCategory(byCat);
      setCategoryTree(tree);
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
    // Clear BOTH outer closing-animation timer AND inner unmount timer
    if (dropdownTimersRef.current.outer) {
      clearTimeout(dropdownTimersRef.current.outer);
      dropdownTimersRef.current.outer = null;
    }
    if (dropdownTimersRef.current.inner) {
      clearTimeout(dropdownTimersRef.current.inner);
      dropdownTimersRef.current.inner = null;
    }
    setIsDropdownClosing(false);
    setShowDropdown(true);
  };

  const handleDropdownLeave = () => {
    // Clear any in-flight timers first
    if (dropdownTimersRef.current.outer) clearTimeout(dropdownTimersRef.current.outer);
    if (dropdownTimersRef.current.inner) clearTimeout(dropdownTimersRef.current.inner);
    // Müştəri tələbi: menyu çox tez bağlanmasın — hover-i itirəndən sonra
    // 500ms gözlə, sonra bağlama animasiyasına başla. Bu, miskanın azacıq
    // sürüşməsi (Məhsullar düyməsi ilə dropdown arasında) ilə bağlı problemi həll edir.
    dropdownTimersRef.current.outer = setTimeout(() => {
      setIsDropdownClosing(true);
      dropdownTimersRef.current.inner = setTimeout(() => {
        setShowDropdown(false);
        setIsDropdownClosing(false);
        dropdownTimersRef.current.inner = null;
      }, 320);
      dropdownTimersRef.current.outer = null;
    }, 500);
  };

  const closeMobileMenu = () => {
    if (mobileMenuCloseTimeout) {
      clearTimeout(mobileMenuCloseTimeout);
    }
    setIsMobileMenuClosing(true);
    const timeout = setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsMobileMenuClosing(false);
    }, 280);
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
      window.dispatchEvent(new Event('userRoleChanged'));
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
    // Modal bağlananda da yazılmış axtarışı analitikaya yaz (Enter/click etməsələr belə)
    const q = searchQuery.trim();
    if (q.length >= 2) {
      import('../services/analyticsService').then(({ trackSearch }) =>
        trackSearch(q).catch(() => undefined)
      );
    }
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

  // Filter products as user types + analytics tracking (debounced)
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
    // Debounced: 1.2 saniyə yazmadıqdan sonra analitikaya göndər
    if (q.length >= 2) {
      const debounceTimer = setTimeout(() => {
        import('../services/analyticsService').then(({ trackSearch }) =>
          trackSearch(searchQuery.trim()).catch(() => undefined)
        );
      }, 1200);
      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, allProducts, i18n.language]);

  const goToProduct = (p: Product) => {
    // Track the search query that led to this product click
    if (searchQuery.trim().length >= 2) {
      import('../services/analyticsService').then(({ trackSearch }) =>
        trackSearch(searchQuery.trim()).catch(() => undefined)
      );
    }
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
      <header
        className="dv-main-header sticky top-0 z-50 bg-white border-b border-gray-100"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="dv-header-row flex items-center justify-between h-16">

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden flex-shrink-0 p-2 -ml-2 relative z-[51] transition-opacity duration-200 ${isMobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              onClick={() => { setIsMobileMenuClosing(false); setIsMobileMenuOpen(true); }}
              aria-label="Menu"
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-6 w-6" strokeWidth={1.25} />
            </button>

            {/* Logo - Always centered (mobile + desktop) */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <Link to="/">
                <img
                  src="https://i.hizliresim.com/tmu65g6.png"
                  alt="De Valeur"
                  className="h-8 sm:h-9 md:h-10"
                />
              </Link>
            </div>

            {/* Desktop Navigation - Left aligned */}
            <nav className="hidden md:flex items-center space-x-5">
              <Link
                to="/gift-cards"
                className="inline-flex items-center gap-1.5 border border-black/80 px-3 py-1 text-[11px] uppercase tracking-[0.08em] font-normal text-black hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                data-testid="header-gift-cards-link"
              >
                <Gift className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{t('header.giftCards', { defaultValue: 'Hədiyyə Kartı' })}</span>
              </Link>

              {/* Brendlər Dropdown - wrapper fills entire header height so there's no dead-zone before the megamenu */}
              <div
                className="relative py-[22px] -my-[22px] px-3 -mx-3"
                onMouseEnter={handleDropdownEnter}
                onMouseLeave={handleDropdownLeave}
              >
                <button className="flex items-center text-black hover:text-gray-700 font-normal text-sm tracking-wide whitespace-nowrap transition-colors" style={{ textTransform: 'uppercase' }} data-testid="header-brands-link">
                  {t('header.brands', { defaultValue: 'Brendlər' })}
                </button>

                {showDropdown && (
                  <div
                    className={`fixed left-0 right-0 z-50 dv-megamenu${isDropdownClosing ? ' is-closing' : ''}`}
                    style={{ top: 64 }}
                    onMouseEnter={handleDropdownEnter}
                    onMouseLeave={handleDropdownLeave}
                  >
                    {/* invisible bridge to prevent hover gap between trigger and panel */}
                    <div className="h-3 -mt-3" aria-hidden="true" />
                    <div className="bg-white border-t border-gray-100 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)]">
                      <div className="max-w-[1200px] mx-auto px-10 py-12">
                        <div className="grid grid-cols-12 gap-10">
                          {/* Categories Section — sol tərəf, hover edəndə həmin kategoriyanın brendləri sağda görünür */}
                          <div className="dv-mega-section dv-mega-section-1 col-span-5">
                            <h3 className="text-[11px] tracking-[0.2em] text-gray-700 uppercase mb-6 font-semibold">
                              {t('header.categories')}
                            </h3>
                            <ul className="space-y-1">
                              {(categoryTree.length > 0
                                ? categoryTree.map(n => ({ key: n.id, displayName: n.name, lookupName: n.nameAz || n.name }))
                                : categories.map(c => ({ key: c, displayName: getCategoryTranslation(c), lookupName: c }))
                              ).map((cat, idx) => {
                                const isHovered = hoveredCategory === cat.lookupName;
                                return (
                                  <li key={cat.key}>
                                    <button
                                      onMouseEnter={() => setHoveredCategory(cat.lookupName)}
                                      onClick={() => {
                                        navigate(`/products?category=${encodeURIComponent(cat.lookupName)}`);
                                        setShowDropdown(false);
                                      }}
                                      style={{ ['--dv-i' as any]: idx }}
                                      className={`dv-mega-link group flex w-full text-left items-center justify-between gap-2 text-sm py-2 capitalize transition-colors ${
                                        isHovered ? 'text-black font-medium' : 'text-gray-700 hover:text-black'
                                      }`}
                                      data-testid={`menu-category-${cat.lookupName}`}
                                    >
                                      <span className="dv-mega-text">{cat.displayName}</span>
                                      <span className={`text-xs transition-transform ${isHovered ? 'translate-x-1 text-amber-500' : 'text-gray-300'}`}>›</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          {/* Brands Section — kategoriyaya hover edildikdə həmin kategoriyanın alt-kateqoriyaları + brendləri, hover yoxdursa hamısı */}
                          <div
                            className="dv-mega-section dv-mega-section-2 col-span-7 border-l border-gray-100 pl-10"
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            {(() => {
                              // Hover edilən kategorinin tree-də node-unu tap
                              const hoveredNode = hoveredCategory
                                ? categoryTree.find(n => n.nameAz === hoveredCategory || n.nameRu === hoveredCategory || n.nameEn === hoveredCategory || n.name === hoveredCategory)
                                : null;
                              const subcats = hoveredNode?.children || [];
                              const brandsForHover = hoveredCategory && productsByCategory[hoveredCategory]?.length
                                ? productsByCategory[hoveredCategory]
                                : brands;
                              return (
                                <>
                                  {/* Sub-categories (varsa) */}
                                  {subcats.length > 0 && (
                                    <div className="mb-6">
                                      <h3 className="text-[11px] tracking-[0.2em] text-gray-700 uppercase mb-3 font-semibold">
                                        Alt kateqoriyalar
                                      </h3>
                                      <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                                        {subcats.map((sub, idx) => (
                                          <li key={sub.id}>
                                            <button
                                              onClick={() => {
                                                navigate(`/products?category=${encodeURIComponent(sub.nameAz || sub.name)}`);
                                                setShowDropdown(false);
                                              }}
                                              style={{ ['--dv-i' as any]: idx }}
                                              className="dv-mega-link group block w-full text-left text-sm text-gray-800 hover:text-amber-700 py-1.5 transition-colors capitalize font-medium"
                                              data-testid={`menu-subcategory-${sub.name}`}
                                            >
                                              <span className="dv-mega-text">› {sub.name}</span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Brands */}
                                  <h3 className="text-[11px] tracking-[0.2em] text-gray-700 uppercase mb-4 font-semibold flex items-center gap-2">
                                    {hoveredCategory ? (
                                      <>
                                        <span className="capitalize text-amber-700">{getCategoryTranslation(hoveredCategory)}</span>
                                        <span className="text-gray-400">/ {t('header.brands')}</span>
                                      </>
                                    ) : (
                                      <span>{t('header.brands')}</span>
                                    )}
                                  </h3>
                                  <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                                    {brandsForHover.map((brand, idx) => (
                                      <li key={`${hoveredCategory || 'all'}-${brand}`}>
                                        <button
                                          onClick={() => {
                                            if (hoveredCategory) {
                                              const params = new URLSearchParams();
                                              params.set('brand', brand);
                                              params.set('category', hoveredCategory);
                                              navigate(`/products?${params.toString()}`);
                                            } else {
                                              navigate(`/brand/${toBrandSlug(brand)}`);
                                            }
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
                                  {hoveredCategory && brandsForHover.length === 0 && subcats.length === 0 && (
                                    <p className="text-xs text-gray-400 italic mt-2">Bu kateqoriyada məhsul yoxdur.</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
            <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
              {/* Search — FIRST */}
              <button
                onClick={() => setShowSearch(true)}
                className="p-1 -m-1"
                aria-label="Search"
                data-testid="header-search-btn"
              >
                <Search className="h-5 w-5 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1.25} />
              </button>

              {/* Language Hover Dropdown (desktop) — bridge prevents gap-flicker */}
              <div
                className="relative hidden md:block py-[22px] -my-[22px]"
                onMouseEnter={() => setShowLangDropdown(true)}
                onMouseLeave={() => setShowLangDropdown(false)}
              >
                <button
                  className="text-sm font-normal text-gray-900 hover:text-gray-600 uppercase flex items-center gap-1"
                  data-testid="header-lang-btn"
                  aria-haspopup="menu"
                >
                  {getLanguageLabel()}
                  <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 top-full bg-white border border-gray-100 shadow-lg min-w-[64px] z-50" data-testid="lang-dropdown">
                    {(['az', 'ru', 'en'] as const).map((lng) => (
                      <button
                        key={lng}
                        onClick={() => {
                          i18n.changeLanguage(lng);
                          setShowLangDropdown(false);
                        }}
                        className={`block w-full text-left px-3 py-1.5 text-[12px] uppercase hover:bg-gray-50 transition-colors ${
                          i18n.language === lng ? 'font-semibold text-black' : 'text-gray-700'
                        }`}
                        data-testid={`lang-option-${lng}`}
                      >
                        {lng}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                    <Bell className="h-4 w-4 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1.25} />
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
                <div
                  className="relative hidden md:block py-[22px] -my-[22px]"
                  onMouseEnter={() => setShowLoginDropdown(true)}
                  onMouseLeave={() => setShowLoginDropdown(false)}
                >
                  <button
                    className="p-1 -m-1 text-gray-700 hover:text-gray-900"
                    aria-label="Account"
                    data-testid="header-account-btn"
                  >
                    <User className="h-5 w-5" strokeWidth={1.25} />
                  </button>
                  {showLoginDropdown && (
                    <div className="absolute right-0 top-full bg-white border border-gray-100 shadow-lg min-w-[180px] z-50" data-testid="account-dropdown">
                      <button
                        onClick={() => {
                          setShowLoginDropdown(false);
                          setShowLoginModal(true);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-[13px] text-gray-800 hover:bg-gray-50 transition-colors"
                        data-testid="account-customer-login"
                      >
                        Müştəri Girişi
                      </button>
                      <Link
                        to="/b2b-login"
                        onClick={() => setShowLoginDropdown(false)}
                        className="block w-full text-left px-4 py-2.5 text-[13px] text-gray-800 hover:bg-gray-50 transition-colors border-t border-gray-100"
                        data-testid="account-b2b-login"
                      >
                        B2B Girişi
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center space-x-3">
                  <span className="text-sm text-gray-700 font-normal">{userName}</span>
                  <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
                    <LogOut className="h-5 w-5" strokeWidth={1.25} />
                  </button>
                </div>
              )}

              <button onClick={() => navigate('/cart')} className="relative p-1 -m-1" aria-label="Cart">
                <ShoppingCart className="h-5 w-5 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1.25} />
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
                <Heart className="h-5 w-5 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900 transition-colors" strokeWidth={1.25} />
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
              style={{ boxShadow: '8px 0 32px -8px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-10" />
                <button onClick={closeMobileMenu} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="h-6 w-6" strokeWidth={1.25} />
                </button>
              </div>

              <div className="flex flex-col h-[calc(100%-80px)] overflow-y-auto">
                <nav className="flex-1 p-6 space-y-1">
                  {/* Mobile "Brendlər" akardeonu — yalnız kateqoriyalar görünür, hər kateqoriyanın altında brendlər (və varsa alt-kateqoriyalar) genişlənir */}
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 0 }}>
                    <button
                      onClick={() => setMobileProductsOpen(v => !v)}
                      className="dv-mobile-nav-link w-full flex items-center justify-between px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors text-left"
                      data-testid="mobile-products-toggle"
                    >
                      <span>{t('header.brands', { defaultValue: 'Brendlər' })}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${mobileProductsOpen ? 'rotate-180' : ''}`} strokeWidth={1.25} />
                    </button>
                    {mobileProductsOpen && (
                      <div className="mt-1 ml-2 pl-3 border-l border-gray-200 space-y-0.5 dv-accordion-open">
                        {/* Top-level kategoriyalar (parent) — əgər categoryTree boşdursa fallback olaraq düz categories siyahısı */}
                        {(categoryTree.length > 0
                          ? categoryTree.map(node => ({ key: node.id, name: node.name, displayName: node.name, lookupNames: [node.nameAz, node.nameRu, node.nameEn].filter(Boolean), children: node.children }))
                          : categories.map(c => ({ key: c, name: c, displayName: getCategoryTranslation(c), lookupNames: [c], children: [] as CategoryNode[] }))
                        ).map((cat) => {
                          const isOpen = mobileCategoryOpen === cat.key;
                          // Bu kategoriyaya aid brendlər (parent isə alt-larından da daxil)
                          const catBrands = Array.from(new Set(cat.lookupNames.flatMap(n => productsByCategory[n] || [])))
                            .sort((a, b) => a.localeCompare(b, 'az'));
                          return (
                            <div key={cat.key} className="border-b border-gray-50 last:border-0">
                              <button
                                onClick={() => {
                                  setMobileCategoryOpen(isOpen ? null : cat.key);
                                  setMobileSubCategoryOpen(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 rounded transition-colors text-left"
                                data-testid={`mobile-category-toggle-${cat.name}`}
                              >
                                <span className="capitalize">{cat.displayName}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.25} />
                              </button>
                              {isOpen && (
                                <div className="ml-2 pl-3 border-l border-amber-200/60 mb-2 space-y-0.5 dv-accordion-open">
                                  {/* Alt-kateqoriyalar (varsa) — hər birinin də öz akardeonu var (brendlərini açır) */}
                                  {cat.children && cat.children.length > 0 && cat.children.map((sub: CategoryNode) => {
                                    const subOpen = mobileSubCategoryOpen === sub.id;
                                    const subLookups = [sub.nameAz, sub.nameRu, sub.nameEn].filter(Boolean);
                                    const subBrands = Array.from(new Set(subLookups.flatMap(n => productsByCategory[n] || [])))
                                      .sort((a, b) => a.localeCompare(b, 'az'));
                                    return (
                                      <div key={sub.id}>
                                        <button
                                          onClick={() => setMobileSubCategoryOpen(subOpen ? null : sub.id)}
                                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded text-left"
                                          data-testid={`mobile-subcategory-toggle-${sub.name}`}
                                        >
                                          <span className="capitalize">{sub.name}</span>
                                          <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${subOpen ? 'rotate-180' : ''}`} strokeWidth={1.25} />
                                        </button>
                                        {subOpen && (
                                          <div className="ml-2 pl-3 border-l border-gray-100 space-y-0.5 mb-1 dv-accordion-open">
                                            {subBrands.length > 0 ? subBrands.map(b => (
                                              <button
                                                key={`${sub.id}-${b}`}
                                                onClick={() => {
                                                  const params = new URLSearchParams();
                                                  params.set('brand', b);
                                                  params.set('category', sub.nameAz || sub.name);
                                                  navigate(`/products?${params.toString()}`);
                                                  closeMobileMenu();
                                                  window.scrollTo({ top: 0, behavior: 'auto' });
                                                }}
                                                className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
                                              >
                                                {b}
                                              </button>
                                            )) : (
                                              <p className="px-3 py-1.5 text-[11px] text-gray-400 italic">Brend yoxdur</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Birbaşa brendlər (alt-kategoriyaya aid olmayan, və ya alt-kategoriyalı parent üçün toplam brendlər) */}
                                  {(!cat.children || cat.children.length === 0) && (
                                    catBrands.length > 0 ? catBrands.map(b => (
                                      <button
                                        key={`${cat.key}-${b}`}
                                        onClick={() => {
                                          const params = new URLSearchParams();
                                          params.set('brand', b);
                                          params.set('category', cat.lookupNames[0] || cat.name);
                                          navigate(`/products?${params.toString()}`);
                                          closeMobileMenu();
                                          window.scrollTo({ top: 0, behavior: 'auto' });
                                        }}
                                        className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
                                      >
                                        {b}
                                      </button>
                                    )) : (
                                      <p className="px-3 py-1.5 text-[11px] text-gray-400 italic">Brend yoxdur</p>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 1 }}>
                  <Link
                    to="/gift-cards"
                    className="dv-mobile-nav-link block px-4 py-3 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                    data-testid="mobile-gift-cards-link"
                  >
                    {t('header.giftCards', { defaultValue: 'Hədiyyə Kartı' })}
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
                  {/* Language Switcher with dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMobileLangDropdown((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      data-testid="mobile-lang-btn"
                    >
                      <span className="font-medium text-gray-700">{t('header.language')}</span>
                      <span className="flex items-center gap-1 text-sm font-bold text-gray-900 uppercase">
                        {getLanguageLabel()}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMobileLangDropdown ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                      </span>
                    </button>
                    {showMobileLangDropdown && (
                      <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden bg-white" data-testid="mobile-lang-dropdown">
                        {(['az', 'ru', 'en'] as const).map((lng) => (
                          <button
                            key={lng}
                            onClick={() => {
                              i18n.changeLanguage(lng);
                              setShowMobileLangDropdown(false);
                            }}
                            className={`block w-full text-left px-4 py-2.5 text-sm uppercase hover:bg-gray-50 transition-colors ${
                              i18n.language === lng ? 'font-semibold text-black bg-gray-50' : 'text-gray-700'
                            }`}
                            data-testid={`mobile-lang-option-${lng}`}
                          >
                            {lng}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Login/Logout */}
                  {!isLoggedIn ? (
                    <>
                      <button
                        onClick={() => {
                          setShowLoginModal(true);
                          closeMobileMenu();
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-gray-900 bg-white hover:bg-white border border-black transition-colors"
                      >
                        <User className="h-5 w-5" strokeWidth={1.25} />
                        <span className="font-medium">{t('header.login')}</span>
                      </button>
                      <Link
                        to="/b2b-login"
                        onClick={closeMobileMenu}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-gray-900 bg-white hover:bg-white border border-black transition-colors"
                      >
                        <User className="h-5 w-5" strokeWidth={1.25} />
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
                        <LogOut className="h-5 w-5" strokeWidth={1.25} />
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
                  onBlur={() => {
                    // Müştəri OK/axtar düyməsi basmasa belə yazdığı sözü analitikaya yaz —
                    // bəzən dropdown-dakı məhsula klik etmədən modal-dan çıxırlar.
                    const q = searchQuery.trim();
                    if (q.length >= 2) {
                      import('../services/analyticsService').then(({ trackSearch }) =>
                        trackSearch(q).catch(() => undefined)
                      );
                    }
                  }}
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
                            {(p.salePrice ?? p.price)} AZN
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
