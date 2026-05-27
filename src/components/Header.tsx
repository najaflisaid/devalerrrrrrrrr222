import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, ShoppingBag, Menu, X, LogOut, ChevronDown, Bell, Heart, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import CustomerLogin from './auth/CustomerLogin';
import CartDrawer from './CartDrawer';
import { productService } from '../services/productService';
import { getCategoryTree, type CategoryNode } from '../services/categoryService';
import { getActiveB2BNotifications, B2BNotification } from '../services/b2bNotificationService';
import { toBrandSlug } from '../utils/brandSlug';
import type { Product } from '../types';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [mobileLangOpen, setMobileLangOpen] = useState(false);
  const [mobileLoginOpen, setMobileLoginOpen] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Reopen cart drawer if user came back from checkout
  useEffect(() => {
    try {
      if (sessionStorage.getItem('reopenCartDrawer') === '1') {
        sessionStorage.removeItem('reopenCartDrawer');
        setShowCartDrawer(true);
      }
    } catch { /* noop */ }
  }, []);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  // Kategori hierarxiyası (parent → alt-kategori). Firestore-dan oxunur.
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  // Hər kategoriyaya aid məhsul siyahısı — mega menyuda kategoriyaya hover edəndə həmin kateqoriyanın brendləri görünür
  const [productsByCategory, setProductsByCategory] = useState<Record<string, string[]>>({});
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredSubcategory, setHoveredSubcategory] = useState<string | null>(null);
  // Mobil menyu üçün açıq/qapalı state-lər
  // Mobile menu opens with the brands/categories panel already expanded so the
  // user lands directly on the category list (no extra tap needed).
  const [mobileProductsOpen, setMobileProductsOpen] = useState(true);
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
      const [products, tree, brandsFromDb] = await Promise.all([
        productService.getAll(),
        getCategoryTree(lang),
        (async () => {
          // Admin paneldə brend → kateqoriya əlaqəsi: Firestore brands collection-dan yüklə
          try {
            const { collection, getDocs } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            const snap = await getDocs(collection(db, 'brands'));
            return snap.docs.map((d) => {
              const data = d.data() as any;
              const name = typeof data.name === 'object'
                ? (data.name.az || data.name.ru || data.name.en || '')
                : data.name;
              return {
                name: String(name || '').trim(),
                categoryNames: Array.isArray(data.categoryNames) ? data.categoryNames as string[] : [],
              };
            }).filter((b) => b.name);
          } catch (e) {
            console.error('Error loading brands from DB:', e);
            return [] as { name: string; categoryNames: string[] }[];
          }
        })(),
      ]);
      const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
      // Brendlər: həm məhsullardan, həm Firestore brands collection-dan birlikdə
      const productBrandSet = new Set<string>(products.map(p => p.brand).filter(Boolean));
      brandsFromDb.forEach(b => productBrandSet.add(b.name));
      const uniqueBrands = Array.from(productBrandSet);

      // Hər kategoriya üçün o kategoriyaya aid brendləri qruplaşdır (kategori adı ilə index)
      const byCat: Record<string, string[]> = {};

      // 1) Məhsullardan: brend → məhsulun kateqoriyası
      products.forEach(p => {
        if (!p.category || !p.brand) return;
        if (!byCat[p.category]) byCat[p.category] = [];
        if (!byCat[p.category].includes(p.brand)) byCat[p.category].push(p.brand);
      });

      // 2) Admin paneldən təyin olunmuş brend → kateqoriya əlaqəsi (məhsul olmasa belə görünsün)
      brandsFromDb.forEach((b) => {
        (b.categoryNames || []).forEach((catName) => {
          if (!catName) return;
          if (!byCat[catName]) byCat[catName] = [];
          if (!byCat[catName].includes(b.name)) byCat[catName].push(b.name);
        });
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
    // Mouse panelden çıxan kimi bağlamaq üçün qısa gecikmə (yanlış toxunmaları
    // önləmək üçün). Click-əsaslı açılışda bu daha aqressiv ola bilər.
    dropdownTimersRef.current.outer = setTimeout(() => {
      setIsDropdownClosing(true);
      dropdownTimersRef.current.inner = setTimeout(() => {
        setShowDropdown(false);
        setIsDropdownClosing(false);
        setHoveredCategory(null);
        setHoveredSubcategory(null);
        dropdownTimersRef.current.inner = null;
      }, 280);
      dropdownTimersRef.current.outer = null;
    }, 180);
  };

  // Close brands dropdown when clicking outside header
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close on clicks inside the trigger button or the megamenu panel
      if (target.closest('.dv-megamenu') || target.closest('[data-testid="header-brands-link"]')) {
        return;
      }
      handleDropdownLeave();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDropdown]);

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

  // Preload products on mount so search is instant and trending-category
  // clicks (e.g. "SAAT") always return results — avoiding a race condition
  // where the filter runs before products finish loading.
  useEffect(() => {
    if (allProducts.length === 0) {
      productService.getAll().then(setAllProducts).catch(() => setAllProducts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const category = (p.category || '').toLowerCase();
        // Also match the translated/localized category name so that
        // typing or selecting a localized trending term (e.g. "Saat", "Çantalar")
        // returns the correct products in any UI language.
        const categoryLocalized = getCategoryTranslation(p.category || '').toLowerCase();
        return (
          nameAz.includes(q) ||
          nameRu.includes(q) ||
          nameEn.includes(q) ||
          brand.includes(q) ||
          category.includes(q) ||
          categoryLocalized.includes(q)
        );
      })
      .slice(0, 24);
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

  // Şəffaf header sürüşməyə görə (ana səhifədə hero üzərində şəffaf, scroll edəndə ağ)
  const [isAtTop, setIsAtTop] = useState<boolean>(typeof window !== 'undefined' ? window.scrollY < 80 : true);
  const isHomePage = location.pathname === '/';
  useEffect(() => {
    const onScroll = () => setIsAtTop(window.scrollY < 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  // Hər path dəyişikliyində isAtTop yenidən hesablanır (route değişdikdə səhifə üst-də olur)
  useEffect(() => {
    setIsAtTop(window.scrollY < 80);
  }, [location.pathname]);
  const transparentMode = isHomePage && isAtTop;

  return (
    <>
      {/* Main Header */}
      <header
        className={`dv-main-header z-50 transition-all duration-500 ${
          transparentMode
            ? 'fixed top-0 left-0 right-0 bg-transparent border-b border-transparent dv-header-transparent'
            : 'sticky top-0 bg-white border-b border-gray-100 dv-header-solid'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="dv-header-row flex items-center justify-between h-16">

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden flex-shrink-0 p-2 -ml-2 relative z-[51] transition-opacity duration-200 ${isMobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              onClick={() => { setIsMobileMenuClosing(false); setIsMobileMenuOpen(true); setMobileProductsOpen(true); }}
              aria-label="Menu"
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-6 w-6" strokeWidth={1} />
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

            {/* Desktop Navigation - Left aligned (LV-style: Menu | Search | Gift Card) */}
            <nav className="hidden md:flex items-center gap-7">
              {/* Brendlər Dropdown rebadged as "Menu" with hamburger icon */}
              <div
                className="relative py-[22px] -my-[22px] px-3 -mx-3"
              >
                <button
                  onClick={() => {
                    if (showDropdown) {
                      handleDropdownLeave();
                    } else {
                      handleDropdownEnter();
                    }
                  }}
                  className={`flex items-center gap-2 font-normal text-[11px] tracking-wide whitespace-nowrap transition-colors font-futura uppercase ${
                    transparentMode ? 'text-white hover:text-white/80' : 'text-black hover:text-gray-700'
                  }`}
                  data-testid="header-brands-link"
                  aria-expanded={showDropdown}
                  aria-haspopup="menu"
                >
                  <Menu className="h-[16px] w-[16px]" strokeWidth={1.25} />
                  <span>{t('header.menu', { defaultValue: 'Menu' })}</span>
                </button>

                {showDropdown && (
                  <>
                    {/* Backdrop overlay — dims rest of the page (LV-style) */}
                    <div
                      className={`fixed left-0 right-0 bottom-0 z-40 bg-black/40 transition-opacity duration-300 ${isDropdownClosing ? 'opacity-0' : 'opacity-100'}`}
                      style={{ top: 64 }}
                      onMouseEnter={handleDropdownLeave}
                      aria-hidden="true"
                    />
                    <div
                      className={`fixed left-0 bottom-0 z-50 dv-megamenu dv-light-reset${isDropdownClosing ? ' is-closing' : ''}`}
                      style={{ top: 64 }}
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {/* invisible bridge to prevent hover gap between trigger and panel */}
                      <div className="h-3 -mt-3 w-[300px]" aria-hidden="true" />
                      <div className="bg-white border-t border-gray-100 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)] h-[calc(100vh-64px)] overflow-y-auto">
                      {(() => {
                        const categoryItems = categoryTree.length > 0
                          ? categoryTree.map(n => ({ key: n.id, displayName: n.name, lookupName: n.nameAz || n.name, node: n }))
                          : categories.map(c => ({ key: c, displayName: getCategoryTranslation(c), lookupName: c, node: null as CategoryNode | null }));

                        const hoveredNode = hoveredCategory
                          ? categoryTree.find(n => n.nameAz === hoveredCategory || n.nameRu === hoveredCategory || n.nameEn === hoveredCategory || n.name === hoveredCategory)
                          : null;
                        const subcats = hoveredNode?.children || [];
                        const hasSubcats = subcats.length > 0;

                        // Column 2 content: if subcats exist → subcategories list; else → brands for the category
                        const brandsForCategory = hoveredCategory && productsByCategory[hoveredCategory]?.length
                          ? productsByCategory[hoveredCategory]
                          : brands;
                        // Column 3 content: brands for the hovered subcategory
                        const brandsForSubcategory = hoveredSubcategory && productsByCategory[hoveredSubcategory]?.length
                          ? productsByCategory[hoveredSubcategory]
                          : (hoveredSubcategory ? brands : []);

                        return (
                          <div className="flex items-stretch min-h-full">
                            {/* Column 1 — Categories (always visible) */}
                            <div className="dv-mega-col w-[300px] py-10 px-10">
                              <ul className="space-y-1">
                                {categoryItems.map((cat, idx) => {
                                  const isActive = hoveredCategory === cat.lookupName;
                                  const hasChildren = (cat.node?.children?.length || 0) > 0;
                                  return (
                                    <li key={cat.key}>
                                      <button
                                        onMouseEnter={() => {
                                          setHoveredCategory(cat.lookupName);
                                          setHoveredSubcategory(null);
                                        }}
                                        onClick={() => {
                                          navigate(`/products?category=${encodeURIComponent(cat.lookupName)}`);
                                          setShowDropdown(false);
                                        }}
                                        style={{ ['--dv-i' as any]: idx }}
                                        className={`dv-mega-link group flex w-full text-left items-center justify-between gap-3 text-[15px] py-2.5 transition-colors ${
                                          isActive ? 'text-black' : 'text-gray-800 hover:text-black'
                                        }`}
                                        data-testid={`menu-category-${cat.lookupName}`}
                                      >
                                        <span className={`dv-mega-text ${isActive ? 'underline underline-offset-[6px] decoration-[1px]' : ''}`}>{cat.displayName}</span>
                                        {hasChildren && (
                                          <span className={`text-base leading-none ${isActive ? 'text-black' : 'text-gray-400'}`}>›</span>
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            {/* Column 2 — Subcategories OR brands (when category hovered) */}
                            {hoveredCategory && (
                              <div className="dv-mega-col w-[300px] py-10 px-10 border-l border-gray-100 animate-[fadeIn_180ms_ease-out]">
                                {hasSubcats ? (
                                  <ul className="space-y-1">
                                    {subcats.map((sub, idx) => {
                                      const subLookup = sub.nameAz || sub.name;
                                      const isActive = hoveredSubcategory === subLookup;
                                      const subBrands = productsByCategory[subLookup] || [];
                                      const hasBrands = subBrands.length > 0;
                                      return (
                                        <li key={sub.id}>
                                          <button
                                            onMouseEnter={() => setHoveredSubcategory(subLookup)}
                                            onClick={() => {
                                              navigate(`/products?category=${encodeURIComponent(subLookup)}`);
                                              setShowDropdown(false);
                                            }}
                                            style={{ ['--dv-i' as any]: idx }}
                                            className={`dv-mega-link group flex w-full text-left items-center justify-between gap-3 text-[15px] py-2.5 transition-colors ${
                                              isActive ? 'text-black' : 'text-gray-800 hover:text-black'
                                            }`}
                                            data-testid={`menu-subcategory-${sub.name}`}
                                          >
                                            <span className={`dv-mega-text ${isActive ? 'underline underline-offset-[6px] decoration-[1px]' : ''}`}>{sub.name}</span>
                                            {hasBrands && (
                                              <span className={`text-base leading-none ${isActive ? 'text-black' : 'text-gray-400'}`}>›</span>
                                            )}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <ul className="space-y-1">
                                    {brandsForCategory.map((brand, idx) => (
                                      <li key={`${hoveredCategory}-${brand}`}>
                                        <button
                                          onClick={() => {
                                            navigate(`/brand/${toBrandSlug(brand)}`);
                                            setShowDropdown(false);
                                          }}
                                          style={{ ['--dv-i' as any]: idx }}
                                          className="dv-mega-link group block w-full text-left text-[15px] text-gray-800 hover:text-black py-2.5 transition-colors"
                                          data-testid={`menu-brand-${brand}`}
                                        >
                                          <span className="dv-mega-text">{brand}</span>
                                        </button>
                                      </li>
                                    ))}
                                    {brandsForCategory.length === 0 && (
                                      <p className="text-xs text-gray-400 italic mt-2">Bu kateqoriyada məhsul yoxdur.</p>
                                    )}
                                  </ul>
                                )}
                              </div>
                            )}

                            {/* Column 3 — Brands (when subcategory hovered) */}
                            {hoveredCategory && hasSubcats && hoveredSubcategory && (
                              <div className="dv-mega-col w-[300px] py-10 px-10 border-l border-gray-100 animate-[fadeIn_180ms_ease-out]">
                                <ul className="space-y-1">
                                  {brandsForSubcategory.map((brand, idx) => (
                                    <li key={`${hoveredSubcategory}-${brand}`}>
                                      <button
                                        onClick={() => {
                                          navigate(`/brand/${toBrandSlug(brand)}`);
                                          setShowDropdown(false);
                                        }}
                                        style={{ ['--dv-i' as any]: idx }}
                                        className="dv-mega-link group block w-full text-left text-[15px] text-gray-800 hover:text-black py-2.5 transition-colors"
                                        data-testid={`menu-brand-${brand}`}
                                      >
                                        <span className="dv-mega-text">{brand}</span>
                                      </button>
                                    </li>
                                  ))}
                                  {brandsForSubcategory.length === 0 && (
                                    <p className="text-xs text-gray-400 italic mt-2">Bu alt-kateqoriyada brend yoxdur.</p>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  </>
                )}
              </div>

              {/* Search — icon + text (LV-style, left aligned) */}
              <button
                onClick={() => setShowSearch(true)}
                className={`flex items-center gap-2 font-normal text-[11px] tracking-wide whitespace-nowrap transition-colors font-futura uppercase ${
                  transparentMode ? 'text-white hover:text-white/80' : 'text-black hover:text-gray-700'
                }`}
                aria-label="Search"
                data-testid="header-search-text-btn"
              >
                <Search className="h-[16px] w-[16px]" strokeWidth={1.25} />
                <span>{t('header.search', { defaultValue: 'Search' })}</span>
              </button>

              {/* Hədiyyə kartı — çərçivəli (LV-style) + güzgü/shine effekti */}
              <Link
                to="/gift-cards"
                className={`dv-giftcard-btn group relative inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-normal whitespace-nowrap transition-all duration-300 overflow-hidden border ${
                  transparentMode
                    ? 'text-white border-white/70 hover:border-white hover:shadow-[0_6px_20px_-6px_rgba(255,255,255,0.4)]'
                    : 'text-[#8B0000] border-[#8B0000]/80 hover:border-[#8B0000] hover:shadow-[0_6px_20px_-6px_rgba(139,0,0,0.4)]'
                }`}
                data-testid="header-gift-cards-link"
              >
                {/* Mirror / shine sweep — appears on hover */}
                <span
                  aria-hidden="true"
                  className="dv-giftcard-shine pointer-events-none absolute inset-y-0 -left-3/4 w-3/4 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-0 group-hover:opacity-100"
                />
                <Gift
                  className="relative h-[14px] w-[14px] transition-transform duration-300 group-hover:rotate-[-8deg]"
                  strokeWidth={1.4}
                />
                <span className="relative font-playfair italic text-[13px] leading-none tracking-wide">
                  {t('header.giftCards', { defaultValue: 'Hədiyyə' })}
                </span>
              </Link>

              {isLoggedIn && userRole === 'b2b' && (
                <Link to="/b2b/orders" className="dv-navlink text-gray-900 hover:text-gray-600 font-normal text-[13px] whitespace-nowrap font-futura">
                  {t('header.myOrders')}
                </Link>
              )}
              {isLoggedIn && userRole === 'admin' && (
                <Link to="/admin" className="dv-navlink text-gray-900 hover:text-gray-600 font-normal text-[13px] whitespace-nowrap font-futura">
                  {t('header.admin')}
                </Link>
              )}
            </nav>

            {/* Right Actions */}
            <div className={`flex items-center gap-2 sm:gap-3 md:gap-5 ${isMobileMenuOpen ? 'invisible md:visible' : ''}`}>
              {/* Mobile search button (only on mobile, desktop has Search in left nav) */}
              <button
                onClick={() => setShowSearch(true)}
                className="md:hidden p-1 -m-1"
                aria-label="Search"
                data-testid="header-search-btn"
              >
                <Search className="h-5 w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1} />
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
                  <div className="dv-light-reset absolute left-1/2 -translate-x-1/2 top-full bg-white border border-black/10 shadow-lg min-w-[80px] z-50" data-testid="lang-dropdown">
                    {(['az', 'ru', 'en'] as const)
                      .filter((lng) => lng !== i18n.language)
                      .map((lng) => (
                        <button
                          key={lng}
                          onClick={() => {
                            i18n.changeLanguage(lng);
                            setShowLangDropdown(false);
                          }}
                          className="block w-full text-center px-4 py-2 text-[12px] uppercase text-black/70 hover:bg-black/[0.04] hover:text-black transition-colors"
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
                    <Bell className="h-4 w-4 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1} />
                    {b2bNotifications.length > 0 && !notificationsRead && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold ring-2 ring-white">
                        {b2bNotifications.length}
                      </span>
                    )}
                  </button>

                  {/* Bildiriş Dropdown */}
                  {showNotificationDropdown && (
                    <div className="dv-light-reset absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
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
                    <User className="h-5 w-5" strokeWidth={1} />
                  </button>
                  {showLoginDropdown && (
                    <div className="dv-light-reset absolute left-1/2 -translate-x-1/2 top-full bg-white border border-black/10 shadow-lg min-w-[160px] z-50" data-testid="account-dropdown">
                      <button
                        onClick={() => {
                          setShowLoginDropdown(false);
                          setShowLoginModal(true);
                        }}
                        className="block w-full text-center px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors"
                        data-testid="account-customer-login"
                      >
                        Giriş
                      </button>
                      <Link
                        to="/b2b-login"
                        onClick={() => setShowLoginDropdown(false)}
                        className="block w-full text-center px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors border-t border-black/[0.07]"
                        data-testid="account-b2b-login"
                      >
                        B2B Giriş
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="relative hidden md:block py-[22px] -my-[22px]"
                  onMouseEnter={() => setShowLoginDropdown(true)}
                  onMouseLeave={() => setShowLoginDropdown(false)}
                >
                  <button
                    className="p-1 -m-1 text-gray-700 hover:text-gray-900 flex items-center gap-1.5"
                    aria-label="Account"
                    data-testid="header-account-loggedin-btn"
                  >
                    <User className="h-5 w-5" strokeWidth={1} />
                    <span className="text-sm text-gray-700 font-normal max-w-[140px] truncate">{userName}</span>
                  </button>
                  {showLoginDropdown && (
                    <div className="dv-light-reset absolute right-0 top-full bg-white border border-black/10 shadow-lg min-w-[180px] z-50" data-testid="account-loggedin-dropdown">
                      <Link
                        to="/my-orders"
                        onClick={() => setShowLoginDropdown(false)}
                        className="block w-full text-left px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors"
                        data-testid="account-my-orders"
                      >
                        Sifarişlərim
                      </Link>
                      {userRole !== 'b2b' && (
                        <Link
                          to="/change-password"
                          onClick={() => setShowLoginDropdown(false)}
                          className="block w-full text-left px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors border-t border-black/[0.07]"
                          data-testid="account-change-password"
                        >
                          Şifrəni dəyiş
                        </Link>
                      )}
                      <button
                        onClick={() => { setShowLoginDropdown(false); handleLogout(); }}
                        className="block w-full text-left px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors border-t border-black/[0.07]"
                        data-testid="account-logout"
                      >
                        Çıxış
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setShowCartDrawer(true)} className="relative p-1 -m-1" aria-label="Cart" data-testid="header-cart-btn">
                <ShoppingBag className="h-5 w-5 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900" strokeWidth={1} />
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
                <Heart className="h-5 w-5 md:h-5 md:w-5 text-gray-600 cursor-pointer hover:text-gray-900 transition-colors" strokeWidth={1} />
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
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <>
            <div
              className={`fixed inset-0 z-50 bg-black/55 dv-menu-backdrop ${isMobileMenuClosing ? 'is-closing' : ''}`}
              onClick={closeMobileMenu}
            ></div>

            <div
              className={`dv-light-reset fixed top-0 left-0 h-full w-[88%] max-w-[400px] z-50 bg-white dv-menu-panel ${isMobileMenuClosing ? 'is-closing' : ''}`}
              style={{ boxShadow: '12px 0 48px -12px rgba(0,0,0,0.22)' }}
            >
              {/* Top header — luxurious */}
              <div className="relative flex items-center justify-between px-6 py-6 border-b border-black/[0.06]">
                <button
                  onClick={closeMobileMenu}
                  className="p-1.5 -m-1.5 hover:bg-black/[0.04] rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.25} />
                </button>
                <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-9 absolute left-1/2 -translate-x-1/2" />
                <div className="w-7" aria-hidden="true" />
              </div>

              <div className="flex flex-col h-[calc(100%-89px)] overflow-y-auto">
                <nav className="flex-1 p-6 space-y-1.5">
                  {/* Mobile "Brendlər" akardeonu */}
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 0 }}>
                    <button
                      onClick={() => setMobileProductsOpen(v => !v)}
                      className="group w-full flex items-center justify-between px-4 py-4 hover:bg-black/[0.03] transition-colors text-left border-b border-black/[0.06]"
                      data-testid="mobile-products-toggle"
                    >
                      <span className="text-[12px] uppercase tracking-[0.18em] text-black font-normal">{t('header.brands', { defaultValue: 'Brendlər' })}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-black/55 transition-transform duration-300 ${mobileProductsOpen ? 'rotate-180 text-black' : ''}`} strokeWidth={1.5} />
                    </button>
                    {/* Smooth accordion (CSS grid-rows trick) */}
                    <div
                      className="grid transition-[grid-template-rows] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
                      style={{ gridTemplateRows: mobileProductsOpen ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden min-h-0">
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
                                  <span>{cat.displayName}</span>
                                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.25} />
                                </button>
                                {/* Smooth nested accordion */}
                                <div
                                  className="grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
                                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                                >
                                  <div className="overflow-hidden min-h-0">
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
                                              <span>{sub.name}</span>
                                              <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform duration-300 ${subOpen ? 'rotate-180' : ''}`} strokeWidth={1.25} />
                                            </button>
                                            <div
                                              className="grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
                                              style={{ gridTemplateRows: subOpen ? '1fr' : '0fr' }}
                                            >
                                              <div className="overflow-hidden min-h-0">
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
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Birbaşa brendlər (alt-kategoriyaya aid olmayan) */}
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
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="dv-menu-item px-4 py-3 border-b border-black/[0.06]" style={{ ['--dv-i' as any]: 1 }}>
                    <Link
                      to="/gift-cards"
                      className="dv-giftcard-btn group relative inline-flex items-center justify-center gap-2.5 w-full px-4 py-3 border border-[#8B0000]/80 hover:border-[#8B0000] hover:shadow-[0_6px_20px_-6px_rgba(139,0,0,0.4)] transition-all duration-300 overflow-hidden text-[#8B0000]"
                      onClick={closeMobileMenu}
                      data-testid="mobile-gift-cards-link"
                    >
                      <span
                        aria-hidden="true"
                        className="dv-giftcard-shine pointer-events-none absolute inset-y-0 -left-3/4 w-3/4 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-0 group-hover:opacity-100"
                      />
                      <Gift className="relative h-[15px] w-[15px] transition-transform duration-300 group-hover:rotate-[-8deg]" strokeWidth={1.4} />
                      <span className="relative text-[12px] uppercase tracking-[0.18em] font-medium font-futura">
                        {t('header.giftCards', { defaultValue: 'Hədiyyə Kartı' })}
                      </span>
                    </Link>
                  </div>

                  {/* Dillər — akardeon */}
                  <div className="dv-menu-item" style={{ ['--dv-i' as any]: 2 }}>
                    <button
                      onClick={() => setMobileLangOpen(v => !v)}
                      className="group w-full flex items-center justify-between px-4 py-4 hover:bg-black/[0.03] transition-colors text-left border-b border-black/[0.06]"
                      data-testid="mobile-lang-toggle"
                    >
                      <span className="inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.18em] text-black font-normal">
                        {t('header.language', { defaultValue: 'Dillər' })}
                        <span className="text-black/45 text-[11px] tracking-normal normal-case">({getLanguageLabel()})</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-black/55 transition-transform duration-300 ${mobileLangOpen ? 'rotate-180 text-black' : ''}`} strokeWidth={1.5} />
                    </button>
                    {mobileLangOpen && (
                      <div className="dv-accordion-open px-4 py-3 border-b border-black/[0.06] bg-black/[0.015]">
                        <div className="flex gap-1.5">
                          {(['az', 'ru', 'en'] as const).map((lng) => (
                            <button
                              key={lng}
                              onClick={() => {
                                i18n.changeLanguage(lng);
                                setMobileLangOpen(false);
                              }}
                              className={`flex-1 h-9 text-[11px] uppercase tracking-[0.18em] border transition-all ${
                                i18n.language === lng
                                  ? 'bg-black text-white border-black'
                                  : 'bg-white text-black/60 border-black/15 hover:border-black/45 hover:text-black'
                              }`}
                              data-testid={`mobile-lang-option-${lng}`}
                            >
                              {lng}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Giriş — akardeon (Müştəri Girişi + B2B Giriş) */}
                  {!isLoggedIn ? (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 3 }}>
                      <button
                        onClick={() => setMobileLoginOpen(v => !v)}
                        className="group w-full flex items-center justify-between px-4 py-4 hover:bg-black/[0.03] transition-colors text-left border-b border-black/[0.06]"
                        data-testid="mobile-login-toggle"
                      >
                        <span className="inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.18em] text-black font-normal">
                          <User className="h-4 w-4 text-black/70 group-hover:text-black transition-colors" strokeWidth={1.5} />
                          {t('header.login', { defaultValue: 'Giriş' })}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-black/55 transition-transform duration-300 ${mobileLoginOpen ? 'rotate-180 text-black' : ''}`} strokeWidth={1.5} />
                      </button>
                      {mobileLoginOpen && (
                        <div className="dv-accordion-open px-4 py-3 space-y-2 border-b border-black/[0.06] bg-black/[0.015]">
                          <button
                            onClick={() => {
                              setShowLoginModal(true);
                              setMobileLoginOpen(false);
                              closeMobileMenu();
                            }}
                            className="w-full h-11 inline-flex items-center justify-center gap-2 bg-black text-white text-[11px] uppercase tracking-[0.22em] hover:bg-black/85 transition-colors"
                            data-testid="mobile-customer-login"
                          >
                            <User className="h-4 w-4" strokeWidth={1.5} />
                            <span>Müştəri Girişi</span>
                          </button>
                          <Link
                            to="/b2b-login"
                            onClick={() => { setMobileLoginOpen(false); closeMobileMenu(); }}
                            className="w-full h-11 inline-flex items-center justify-center gap-2 bg-white text-black border border-black text-[11px] uppercase tracking-[0.22em] hover:bg-black hover:text-white transition-colors"
                            data-testid="mobile-b2b-login"
                          >
                            <span>B2B Girişi</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 3 }}>
                      <button
                        onClick={() => setMobileLoginOpen(v => !v)}
                        className="group w-full flex items-center justify-between px-4 py-4 hover:bg-black/[0.03] transition-colors text-left border-b border-black/[0.06]"
                        data-testid="mobile-login-toggle"
                      >
                        <span className="inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.18em] text-black font-normal">
                          <User className="h-4 w-4 text-black/70 group-hover:text-black transition-colors" strokeWidth={1.5} />
                          <span className="max-w-[180px] truncate normal-case tracking-normal text-[13px]">{userName}</span>
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-black/55 transition-transform duration-300 ${mobileLoginOpen ? 'rotate-180 text-black' : ''}`} strokeWidth={1.5} />
                      </button>
                      {mobileLoginOpen && (
                        <div className="dv-accordion-open px-4 py-3 space-y-2 border-b border-black/[0.06] bg-black/[0.015]">
                          {userRole !== 'b2b' && (
                            <Link
                              to="/change-password"
                              onClick={() => { setMobileLoginOpen(false); closeMobileMenu(); }}
                              className="w-full h-11 inline-flex items-center justify-center gap-2 bg-white text-black border border-black/30 text-[11px] uppercase tracking-[0.22em] hover:bg-black hover:text-white hover:border-black transition-colors"
                              data-testid="mobile-change-password"
                            >
                              <span>Şifrəni dəyiş</span>
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              handleLogout();
                              setMobileLoginOpen(false);
                              closeMobileMenu();
                            }}
                            className="w-full h-11 inline-flex items-center justify-center gap-2 bg-white text-black border border-black/30 text-[11px] uppercase tracking-[0.22em] hover:bg-black hover:text-white hover:border-black transition-colors"
                            data-testid="mobile-logout"
                          >
                            <LogOut className="h-4 w-4" strokeWidth={1.5} />
                            <span>{t('header.logout')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isLoggedIn && userRole === 'customer' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 8 }}>
                    <Link
                      to="/my-orders"
                      className="flex items-center justify-between px-4 py-4 text-[12px] uppercase tracking-[0.18em] text-black hover:bg-black/[0.03] transition-colors border-b border-black/[0.06]"
                      onClick={closeMobileMenu}
                    >
                      <span>Sifarişlərim</span>
                      <span className="text-black/40 text-sm">→</span>
                    </Link>
                    </div>
                  )}

                  {isLoggedIn && userRole === 'b2b' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 8 }}>
                    <Link
                      to="/b2b/orders"
                      className="flex items-center justify-between px-4 py-4 text-[12px] uppercase tracking-[0.18em] text-black hover:bg-black/[0.03] transition-colors border-b border-black/[0.06]"
                      onClick={closeMobileMenu}
                    >
                      <span>{t('header.myOrders')}</span>
                      <span className="text-black/40 text-sm">→</span>
                    </Link>
                    </div>
                  )}

                  {isLoggedIn && userRole === 'admin' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 9 }}>
                    <Link
                      to="/admin"
                      className="flex items-center justify-between px-4 py-4 text-[12px] uppercase tracking-[0.18em] text-black hover:bg-black/[0.03] transition-colors border-b border-black/[0.06]"
                      onClick={closeMobileMenu}
                    >
                      <span>{t('header.admin')}</span>
                      <span className="text-black/40 text-sm">→</span>
                    </Link>
                    </div>
                  )}
                </nav>
              </div>
            </div>
          </>
        )}

      <CartDrawer open={showCartDrawer} onClose={() => setShowCartDrawer(false)} />

      {showLoginModal && <CustomerLogin onClose={() => setShowLoginModal(false)} />}

      {showSearch && (
        <div className="fixed inset-0 bg-white z-[100] overflow-y-auto dv-light-reset" data-testid="header-search-overlay">
          {/* Top bar: logo center + close right */}
          <div className="relative flex items-center justify-center px-4 sm:px-8 py-5 border-b border-black/[0.05]">
            <img
              src="https://i.hizliresim.com/tmu65g6.png"
              alt="De Valeur"
              className="h-9 sm:h-10"
            />
            <button
              type="button"
              onClick={closeSearchModal}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-2 -m-2 text-black/60 hover:text-black transition-colors"
              data-testid="header-search-close-btn"
              aria-label="Close search"
            >
              <X className="h-5 w-5" strokeWidth={1.25} />
            </button>
          </div>

          {/* Search input — centered, pill */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-8">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/55" strokeWidth={1.25} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('header.searchPlaceholder', { defaultValue: 'Search for…' })}
                  className="w-full pl-14 pr-14 py-4 text-[15px] font-futura text-black placeholder-black/45 bg-white border border-black/35 rounded-full focus:border-black focus:outline-none transition-colors"
                  autoFocus
                  data-testid="header-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-5 top-1/2 -translate-y-1/2 p-1 text-black/45 hover:text-black"
                    aria-label="Clear"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </form>

            {/* Trending searches — only when no query */}
            {!searchQuery && categories.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3" data-testid="header-search-trending">
                <span className="font-futura text-[11px] uppercase tracking-[0.22em] text-black/55">
                  {t('header.trendingSearches', { defaultValue: 'Trend axtarışlar' })}
                </span>
                {categories.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSearchQuery(c)}
                    className="font-futura text-[13px] text-black/85 hover:text-black hover:underline underline-offset-4 transition-colors"
                    data-testid={`header-search-trending-${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results / Default grid */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pb-16">
            {(() => {
              const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
              const isQuery = !!searchQuery.trim();

              // Default grid — top bestsellers + newest (visible only). Capped at 12.
              const defaultGrid = !isQuery
                ? allProducts
                    .filter((p) => p.isEnabled !== false && !p.comingSoon)
                    .sort((a, b) => {
                      const aScore = (a.isBestseller ? 2 : 0) + ((a.stock ?? 0) > 0 ? 1 : 0);
                      const bScore = (b.isBestseller ? 2 : 0) + ((b.stock ?? 0) > 0 ? 1 : 0);
                      return bScore - aScore;
                    })
                    .slice(0, 12)
                : [];

              if (isQuery && searchResults.length === 0) {
                // Don't show "no results" while products are still loading
                if (allProducts.length === 0) return null;
                return (
                  <div className="text-center py-20" data-testid="header-search-no-results">
                    <p className="font-futura text-[14px] text-black/55">
                      {t('common.noResults', 'Nəticə tapılmadı')}
                    </p>
                  </div>
                );
              }

              const productsToShow = isQuery ? searchResults : defaultGrid;
              if (productsToShow.length === 0) return null;

              return (
                <>
                  <h3 className="font-futura text-[15px] sm:text-[16px] text-black mb-6 capitalize" data-testid="header-search-section-title">
                    {isQuery
                      ? t('header.searchResults', { defaultValue: 'Nəticələr' })
                      : t('header.featuredProducts', { defaultValue: 'Seçilmiş məhsullar' })}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 sm:gap-x-5 gap-y-8" data-testid="header-search-results">
                    {productsToShow.map((p) => {
                      const displayName = p.name?.[lang] || p.name?.az || p.name?.en || '';
                      const price = p.salePrice ?? p.price;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => goToProduct(p)}
                          className="group text-left"
                          data-testid={`header-search-result-${p.id}`}
                        >
                          <div className="relative w-full aspect-square bg-white overflow-hidden mb-3">
                            {p.images?.[0] ? (
                              <img
                                src={p.images[0]}
                                alt={displayName}
                                className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-black/30">N/A</div>
                            )}
                          </div>
                          <p className="font-futura text-[11px] uppercase tracking-[0.14em] text-black/55 mb-1 truncate">
                            {p.brand}
                          </p>
                          <p className="font-futura text-[13px] text-black leading-tight line-clamp-2 mb-1.5 group-hover:underline underline-offset-4">
                            {displayName}
                          </p>
                          <p className="font-futura text-[13px] text-black/75">
                            {price?.toFixed(2)} AZN
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
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
