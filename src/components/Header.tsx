import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, ShoppingBag, Menu, X, LogOut, ChevronDown, Bell, Heart, Gift, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import CustomerLogin from './auth/CustomerLogin';
import CartDrawer from './CartDrawer';
import { productService } from '../services/productService';
import { expandTokenSynonyms } from '../utils/searchSynonyms';
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
  const [searchRandomSeed, setSearchRandomSeed] = useState(0);
  useEffect(() => {
    // Hər dəfə axtarış modalı açıldıqda "default grid" üçün random seed yenilənsin
    // ki, göstərilən məhsullar hər dəfə fərqli olsun (əvvəlki eyni siyahı deyil).
    if (showSearch) setSearchRandomSeed(Date.now());
  }, [showSearch]);
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
  // Hər kateqoriya adı (istənilən dildə) → həmin kateqoriyanın bütün 3 dil variantları.
  // Axtarış üçün istifadə olunur ki, "watches" yazanda "Saat" kateqoriyalı məhsullar gəlsin.
  const [categoryLangMap, setCategoryLangMap] = useState<Record<string, string[]>>({});
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

  // B2B son sifariş statusu — "Sifarişlərim" linki altında kiçik bildiriş üçün
  const [lastOrderStatus, setLastOrderStatus] = useState<string | null>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

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

            // Hər login dəyişiminde səbət təmizlənsin — AMMA YALNIZ bir
            // login-li rol başqa rola keçəndə (məs: b2b → customer və ya
            // admin → customer). Qonaqdan (previousRole=null) yeni hesaba
            // keçəndə qonaqkən əlavə edilmiş səbət SAXLANILMALIDIR — əks
            // halda checkout zamanı qeydiyyatdan dərhal sonra səbət boşalır
            // və müştəri "Səbətiniz boşdur" səhifəsi görür.
            if (previousRole && previousRole !== newRole) {
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
              loadB2BNotifications(newRole);
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

  // B2B son sifariş statusunu yüklə (yalnız B2B istifadəçilər üçün)
  useEffect(() => {
    if (!isLoggedIn || userRole !== 'b2b') {
      setLastOrderStatus(null);
      setLastOrderNumber(null);
      return;
    }
    const email = localStorage.getItem('userEmail');
    if (!email) return;

    let cancelled = false;
    const fetchLast = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'b2bOrders'), where('customerEmail', '==', email)));
        if (cancelled || snap.empty) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        const latest = docs[0];
        if (latest) {
          // Müştəri öz imzası ilə təhvili təsdiqləyibsə, status badge gizlədilir.
          if (latest.signature) {
            setLastOrderStatus(null);
            setLastOrderNumber(null);
          } else {
            setLastOrderStatus(latest.status || 'pending');
            setLastOrderNumber(latest.orderNumber ? `#${latest.orderNumber}` : `#${String(latest.id).slice(0, 6)}`);
          }
        }
      } catch (e) {
        console.warn('Last B2B order fetch failed:', e);
      }
    };
    fetchLast();
    // 30 saniyədən bir yenilə — admin status dəyişdirsə müştəri tez görsün
    const id = setInterval(fetchLast, 30000);
    // Müştəri imza atan kimi dərhal yenilə
    const onSigned = () => fetchLast();
    window.addEventListener('b2bOrderSigned', onSigned);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('b2bOrderSigned', onSigned);
    };
  }, [isLoggedIn, userRole]);

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

      // Hər kateqoriya üçün bütün 3 dildə adları toplayıb tək map-ə yığ —
      // axtarış "watches" yazanda "Saat" kateqoriyalı məhsulları da tapsın.
      // Həmçinin i18n tərcümə açarlarını sinonim kimi əlavə edirik
      // (məs. Firestore-dakı "Saat" → i18n "Saatlar/Watches/Часы" də uyğunlaşsın).
      const langMap: Record<string, string[]> = {};
      const i18nCategoryKeys = ['perfume', 'skincare', 'haircare', 'makeup', 'bodycare', 'accessories', 'watches', 'jewelry', 'bags', 'sunglasses', 'gifts', 'sale'];
      // i18n.store-dan birbaşa götür ki, dil parametri keçərkən düzgün dəyər gəlsin
      const tForLng = (key: string, lng: 'az' | 'ru' | 'en'): string => {
        try {
          const res = i18n.getResource(lng, 'translation', key) || i18n.getResource(lng, 'common', key);
          if (typeof res === 'string' && res.trim()) return res;
        } catch { /* noop */ }
        return '';
      };
      const i18nSynonyms = i18nCategoryKeys.map((k) => {
        const az = tForLng(`category.${k}`, 'az') || tForLng(`header.${k}`, 'az');
        const ru = tForLng(`category.${k}`, 'ru') || tForLng(`header.${k}`, 'ru');
        const en = tForLng(`category.${k}`, 'en') || tForLng(`header.${k}`, 'en');
        return [az, ru, en].map((x) => x.trim()).filter(Boolean);
      }).filter((arr) => arr.length > 0);

      // Hardcoded fallback synonyms — i18n resurslar yüklənməyibsə də işləsin
      const fallbackSyn = [
        ['Saat', 'Saatlar', 'Часы', 'Watch', 'Watches'],
        ['Zərgərlik', 'Zergerlik', 'Украшения', 'Jewelry', 'Jewellery'],
        ['Çanta', 'Çantalar', 'Сумки', 'Сумка', 'Bag', 'Bags'],
        ['Eynək', 'Günəş Eynəkləri', 'Очки', 'Sunglasses', 'Glasses'],
        ['Ətir', 'Ətirlər', 'Парфюм', 'Perfume', 'Fragrance'],
        ['Aksesuar', 'Aksesuarlar', 'Аксессуары', 'Accessories', 'Accessory'],
        ['Hədiyyə', 'Подарок', 'Подарки', 'Gift', 'Gifts'],
      ];
      fallbackSyn.forEach((set) => {
        const exists = i18nSynonyms.some((s) => s.some((v) => set.some((f) => f.toLowerCase() === v.toLowerCase())));
        if (!exists) i18nSynonyms.push(set);
      });

      const findI18nSynonyms = (name: string): string[] => {
        const n = name.toLowerCase().trim();
        for (const synSet of i18nSynonyms) {
          if (synSet.some((s) => {
            const sl = s.toLowerCase();
            return sl === n || sl.includes(n) || n.includes(sl);
          })) {
            return synSet;
          }
        }
        return [];
      };

      const walkCatLang = (node: CategoryNode) => {
        const baseNames = [node.nameAz, node.nameRu, node.nameEn, node.name].filter(Boolean);
        // İlk uyğun i18n sinonim qrupunu da əlavə et — "Saat" → "Saatlar / Watches / Часы"
        const i18nExtra = baseNames.flatMap(findI18nSynonyms);
        const allNames = Array.from(new Set([...baseNames, ...i18nExtra]));
        baseNames.forEach((n) => {
          langMap[n.toLowerCase()] = allNames;
        });
        node.children.forEach(walkCatLang);
      };
      tree.forEach(walkCatLang);

      // Eyni zamanda yalnız products-da olan kateqoriyalar üçün də i18n sinonimləri qur
      uniqueCategories.forEach((catName) => {
        const key = catName.toLowerCase();
        if (langMap[key]) return;
        const syn = findI18nSynonyms(catName);
        langMap[key] = syn.length > 0 ? Array.from(new Set([catName, ...syn])) : [catName];
      });
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
      setProductsByCategory(byCat);
      setCategoryTree(tree);
      setCategoryLangMap(langMap);
    } catch (error) {
      console.error('Error loading categories and brands:', error);
    }
  };

  // B2B bildirişləri yüklə
  const loadB2BNotifications = async (role?: string) => {
    try {
      const notifs = await getActiveB2BNotifications();
      setB2bNotifications(notifs);
      
      // Oxunub-oxunmadığını yoxla
      const readKey = `b2b_notif_read_${new Date().toDateString()}`;
      if (sessionStorage.getItem(readKey)) {
        setNotificationsRead(true);
      }
      
      // Giriş edən kimi modal göstər — YALNIZ B2B müştərilər üçün.
      // Admin bu bildirişləri özü yaradır, ona görə hər dəfə admin daxil olanda
      // avtomatik modal açılması lazımsızdır (zınqırov ikonundan baxa bilər).
      if (role === 'b2b' && notifs.length > 0) {
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

  // Kateqoriya sıralaması — istifadəçi tələbi:
  // 1. Saat  2. Gümüş  3. Dəri  … sonra qalanları admin paneldəki sıra ilə saxla.
  const getCategoryPriority = (names: (string | undefined)[]): number => {
    const groups: string[][] = [
      ['saat', 'watch', 'watches', 'часы', 'час'], // 0 → Saat
      ['gümüş', 'gumus', 'silver', 'серебро', 'серебр'], // 1 → Gümüş
      ['dəri', 'deri', 'leather', 'кожа', 'кож'], // 2 → Dəri
    ];
    for (const name of names) {
      if (!name) continue;
      const n = name.toLowerCase().trim();
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].some((k) => n === k || n.startsWith(k) || n.includes(k))) {
          return i;
        }
      }
    }
    return 999;
  };
  const sortCategoriesByPriority = <T extends { nameAz?: string; nameRu?: string; nameEn?: string; name?: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const pa = getCategoryPriority([a.nameAz, a.name, a.nameEn, a.nameRu]);
      const pb = getCategoryPriority([b.nameAz, b.name, b.nameEn, b.nameRu]);
      if (pa !== pb) return pa - pb;
      return 0; // Priority-siz kateqoriyalar üçün admin sırasını qoru (stable sort)
    });
  };
  const sortStringCategoriesByPriority = (arr: string[]): string[] => {
    return [...arr].sort((a, b) => {
      const pa = getCategoryPriority([a]);
      const pb = getCategoryPriority([b]);
      if (pa !== pb) return pa - pb;
      return 0;
    });
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

  // ═══ Search-able pages ═══
  // Ana səhifə + bütün "content" səhifələr — brend/kateqoriya ilə eyni səviyyədə
  // axtarış nəticəsi kimi göstərilir. Sinonimlər searchSynonyms.ts-də təyin edilir.
  interface SearchPage { key: string; path: string; title: { az: string; ru: string; en: string }; keywords: string[]; }
  const SEARCHABLE_PAGES: SearchPage[] = [
    { key: 'about',    path: '/about',         title: { az: 'Haqqımızda',            ru: 'О нас',                en: 'About Us' },        keywords: ['about', 'haqqinda', 'haqqımızda', 'kim', 'story', 'hekaye', 'о нас'] },
    { key: 'contact',  path: '/contact',       title: { az: 'Əlaqə',                 ru: 'Контакты',             en: 'Contact' },         keywords: ['contact', 'elaqe', 'əlaqə', 'kontakt', 'telefon', 'ünvan', 'ünvanımız', 'контакт'] },
    { key: 'blog',     path: '/blog',          title: { az: 'Bloq',                  ru: 'Блог',                 en: 'Blog' },            keywords: ['blog', 'bloq', 'yazi', 'yazılar', 'article', 'news', 'блог', 'статьи'] },
    { key: 'delivery', path: '/delivery',      title: { az: 'Çatdırılma',            ru: 'Доставка',             en: 'Delivery' },        keywords: ['delivery', 'catdirilma', 'catdirma', 'çatdırılma', 'shipping', 'доставка'] },
    { key: 'return',   path: '/return-policy', title: { az: 'Qaytarma qaydaları',    ru: 'Возврат',              en: 'Return Policy' },   keywords: ['return', 'qaytarma', 'refund', 'geri', 'возврат'] },
    { key: 'privacy',  path: '/privacy-policy',title: { az: 'Məxfilik siyasəti',     ru: 'Конфиденциальность',   en: 'Privacy Policy' },  keywords: ['privacy', 'mexfilik', 'məxfilik', 'siyaset', 'siyasət', 'конфиденциальность'] },
    { key: 'careers',  path: '/careers',       title: { az: 'Karyera',               ru: 'Карьера',              en: 'Careers' },         keywords: ['careers', 'karyera', 'is', 'iş', 'vakans', 'work', 'карьера', 'работа'] },
    { key: 'partners', path: '/partners',      title: { az: 'Partnyorlar',           ru: 'Партнёры',             en: 'Partners' },        keywords: ['partners', 'partnyor', 'brand', 'brendler', 'partnership', 'партнёры'] },
    { key: 'giftcards',path: '/gift-cards',    title: { az: 'Hədiyyə kartları',      ru: 'Подарочные карты',     en: 'Gift Cards' },      keywords: ['giftcard', 'gift card', 'hediyye', 'hədiyyə', 'kart', 'подарочная', 'подарок'] },
    { key: 'wishlist', path: '/wishlist',      title: { az: 'Sevimlilər',            ru: 'Избранное',            en: 'Wishlist' },        keywords: ['wishlist', 'sevimli', 'istek', 'istək', 'favorite', 'избранное'] },
    { key: 'b2b',      path: '/b2b',           title: { az: 'B2B / Topdan',          ru: 'B2B / Опт',            en: 'B2B / Wholesale' }, keywords: ['b2b', 'toptan', 'topdan', 'wholesale', 'корпоративный', 'опт'] },
  ];



  // Azərbaycan diakritiklərini normallaşdır — istifadəçi "eynek" yazsa
  // belə "EYNƏK" və ya "Eynəklər" tapılsın. Eyni ilə ş→s, ç→c, ı→i, ö→o, ü→u, ğ→g.
  const normalizeAz = (s: string): string => {
    return (s || '')
      .toLowerCase()
      .replace(/ə/g, 'e')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ğ/g, 'g')
      // Rus/İngilis mübadiləsi (transliterasiya) — часы→chasy, seat→saat kimi hallar üçün
      .replace(/й/g, 'y').replace(/ы/g, 'y').replace(/ю/g, 'yu').replace(/я/g, 'ya')
      .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'sh').replace(/ц/g, 'ts')
      .replace(/ж/g, 'zh').replace(/х/g, 'h').replace(/ъ/g, '').replace(/ь/g, '')
      .replace(/[аaа]/g, 'a').replace(/[еeэ]/g, 'e').replace(/[оoо]/g, 'o')
      .trim();
  };

  // Levenshtein — 1 hərf fərqinə icazə (yazı səhvləri: "saat" ↔ "sat", "seat" ↔ "saat")
  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 2) return 99;
    const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[b.length];
  };

  // Fuzzy uyğunluq — yazı səhvləri üçün.
  // • 4-5 hərfli söz: 1 hərf toleransı
  // • 6+ hərfli söz: 2 hərf toleransı ("pulqabi" ↔ "pulbagi", "kaselok")
  // Ayrıca prefix-only uyğunluğu da yoxlayır ki, tam yazılmamış kök də tutulsun.
  const fuzzyIncludes = (haystack: string, needle: string): boolean => {
    if (!needle || !haystack) return false;
    if (haystack.includes(needle)) return true;
    if (needle.length < 4) return false;
    const tolerance = needle.length >= 6 ? 2 : 1;
    const words = haystack.split(/[\s\-_.,/]+/).filter(Boolean);
    return words.some((w) => {
      // Prefix uyğunluğu — "pulq" istifadəçinin yarım yazılmış sözünə uyğun gəlir
      if (needle.length >= 4 && w.startsWith(needle.slice(0, Math.min(needle.length, 4)))) {
        if (Math.abs(w.length - needle.length) <= tolerance + 1) return true;
      }
      if (w.length < needle.length - tolerance || w.length > needle.length + tolerance + 1) return false;
      return levenshtein(w, needle) <= tolerance;
    });
  };

  // Filter products as user types + analytics tracking (debounced)
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setHighlightIndex(-1);
      return;
    }
    const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

    // Aqresiv axtarış: brend → həmin brendin BÜTÜN modelləri,
    // kateqoriya → həmin kateqoriyaya aid bütün məhsullar (hər 3 dildə).
    // Axtarış sözünü split edib hər birinin uyğunlaşmasını tələb edirik (multi-word).
    const tokens = q.split(/\s+/).filter(Boolean);
    const qNorm = normalizeAz(q);
    const tokensNorm = qNorm.split(/\s+/).filter(Boolean);

    const matchesToken = (p: Product, token: string, tokenNorm: string): boolean => {
      const nameAz = p.name?.az?.toLowerCase() || '';
      const nameRu = p.name?.ru?.toLowerCase() || '';
      const nameEn = p.name?.en?.toLowerCase() || '';
      const brand = (p.brand || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const sku = ((p as any).sku || '').toLowerCase();
      const barcode = ((p as any).barcode || '').toLowerCase();
      // Diakritiksiz variantlar (Azərbaycan klaviaturasız istifadəçilər üçün)
      const nameAzN = normalizeAz(nameAz);
      const nameRuN = normalizeAz(nameRu);
      const nameEnN = normalizeAz(nameEn);
      const brandN = normalizeAz(brand);
      const categoryN = normalizeAz(category);
      // Kateqoriyanın bütün 3 dildə adları (Firestore-dan) — "watches" yazanda "Saat" kateqoriyalı məhsullar gəlsin
      const catVariants = categoryLangMap[category] || [];
      const catVariantsMatch = catVariants.some((c) => {
        const cl = c.toLowerCase();
        return cl.includes(token) || normalizeAz(cl).includes(tokenNorm);
      });
      // Cins kütləvi sözləri də nəzərə al — "kişi" → men, "qadın" → women
      const gender = (p.gender || '').toLowerCase();
      const genderHints =
        (token === 'kişi' || token === 'kisi' || token === 'мужской' || token === 'муж' || token === 'men' || token === 'male')
          ? gender === 'men' || gender === 'unisex'
          : (token === 'qadın' || token === 'qadin' || token === 'женский' || token === 'жен' || token === 'women' || token === 'female')
          ? gender === 'women' || gender === 'unisex'
          : false;
      // Sinonim genişlənməsi — "pulbagi" → "pulqabi", "wallet", "cuzdan", "кошелёк" və s.
      // Hər sinonimə görə də field-ları yoxla (təkcə fuzzy-yə güvənmirik).
      const synonyms = expandTokenSynonyms(tokenNorm);
      const synonymMatch = synonyms.length > 1 && synonyms.some((s) => {
        if (s === tokenNorm) return false; // əslində istifadəçinin yazdığı — aşağıda ayrıca yoxlanır
        return (
          nameAzN.includes(s) || nameRuN.includes(s) || nameEnN.includes(s) ||
          brandN.includes(s) || categoryN.includes(s) ||
          catVariants.some((c) => normalizeAz(c.toLowerCase()).includes(s))
        );
      });
      return (
        nameAz.includes(token) || nameAzN.includes(tokenNorm) ||
        nameRu.includes(token) || nameRuN.includes(tokenNorm) ||
        nameEn.includes(token) || nameEnN.includes(tokenNorm) ||
        brand.includes(token) || brandN.includes(tokenNorm) ||
        category.includes(token) || categoryN.includes(tokenNorm) ||
        catVariantsMatch ||
        (sku && sku.includes(token)) ||
        (barcode && barcode.includes(token)) ||
        genderHints ||
        synonymMatch ||
        // Fuzzy — 1-2 hərf fərqinə icazə (yazı səhvləri üçün)
        fuzzyIncludes(nameAzN, tokenNorm) ||
        fuzzyIncludes(nameRuN, tokenNorm) ||
        fuzzyIncludes(nameEnN, tokenNorm) ||
        fuzzyIncludes(brandN, tokenNorm) ||
        fuzzyIncludes(categoryN, tokenNorm)
      );
    };

    const matches = allProducts.filter((p) => tokens.every((t, idx) => matchesToken(p, t, tokensNorm[idx] || normalizeAz(t))));

    // Brend / kateqoriya tam uyğunluğunda olan məhsullar üst-də göstərilsin.
    // Sonra ad uyğunluqları. Müsadirə üçün stok və bestseller balansı.
    // Brend və ya kateqoriya adına DƏQIQ uyğunluq varsa — bütün məhsulları göstər.
    // Yoxsa 60 ilə məhdudlaşdır (ümumi axtarış üçün UI performansı).
    const qCat = (categoryLangMap && Object.keys(categoryLangMap)) || [];
    const hasBrandExact = matches.some((p) => (p.brand || '').toLowerCase() === q);
    const hasCategoryExact = matches.some((p) => {
      const c = (p.category || '').toLowerCase();
      if (c === q) return true;
      const variants = categoryLangMap[c] || [];
      return variants.some((v) => v.toLowerCase() === q);
    });
    // "Partial" — sorğu brend/kateqoriya adının bir hissəsidir (min 3 hərf, ambiquity yoxdur)
    const hasBrandPartial = q.length >= 3 && matches.some((p) => (p.brand || '').toLowerCase().startsWith(q));
    const hasCategoryPartial = q.length >= 3 && matches.some((p) => (p.category || '').toLowerCase().startsWith(q));
    void qCat;
    const showAll = hasBrandExact || hasCategoryExact || hasBrandPartial || hasCategoryPartial;
    const LIMIT = showAll ? 500 : 60; // Brend/kateqoriya seçildikdə praktiki olaraq bütün nəticələr

    const scored = matches
      .map((p) => {
        const brand = (p.brand || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const catVariants = categoryLangMap[category] || [];
        let score = 0;
        if (brand === q || tokens.every((t) => brand === t)) score += 100;
        else if (brand.includes(q)) score += 60;
        if (category === q || catVariants.some((c) => c.toLowerCase() === q)) score += 80;
        else if (category.includes(q) || catVariants.some((c) => c.toLowerCase().includes(q))) score += 40;
        if (p.isBestseller) score += 5;
        if ((p.stock ?? 0) > 0) score += 3;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      .slice(0, LIMIT);

    setSearchResults(scored);
    setHighlightIndex(scored.length > 0 ? 0 : -1);
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
  }, [searchQuery, allProducts, i18n.language, categoryLangMap]);

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
                  src="https://customer-assets-m6fa6gv7.emergentagent.net/job_44f0704f-1da0-4748-83a9-feaea0a882af/artifacts/60f44qqe_IMG_1279.JPG-removebg-preview.png"
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
                  className={`flex items-center gap-2 font-normal text-[11px] tracking-wide whitespace-nowrap transition-opacity duration-200 font-futura uppercase ${
                    transparentMode ? 'text-white hover:text-white/80' : 'text-black hover:text-gray-700'
                  } ${showDropdown ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                  data-testid="header-brands-link"
                  aria-expanded={showDropdown}
                  aria-haspopup="menu"
                >
                  <Menu className="h-[16px] w-[16px]" strokeWidth={1.25} />
                  <span>{t('header.menu', { defaultValue: 'Menu' })}</span>
                </button>

                {showDropdown && (
                  <>
                    {/* Backdrop overlay — dims & blurs rest of the page (LV-style) */}
                    <div
                      className={`fixed inset-0 z-[60] bg-black/45 backdrop-blur-md transition-opacity duration-300 ${isDropdownClosing ? 'opacity-0' : 'opacity-100'}`}
                      onClick={handleDropdownLeave}
                      aria-hidden="true"
                    />
                    <div
                      className={`fixed left-0 top-0 bottom-0 z-[70] dv-megamenu dv-light-reset${isDropdownClosing ? ' is-closing' : ''}`}
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleDropdownLeave}
                    >
                      <div className="bg-white shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)] h-screen overflow-y-auto scrollbar-hide">
                        {/* Close button at the top of the panel */}
                        <button
                          onClick={handleDropdownLeave}
                          className="flex items-center gap-2 px-10 pt-7 pb-4 text-[12px] tracking-wide text-gray-700 hover:text-black transition-colors uppercase font-futura"
                          data-testid="menu-close-btn"
                          aria-label="Close menu"
                        >
                          <X className="h-[16px] w-[16px]" strokeWidth={1.4} />
                          <span>{t('header.close', { defaultValue: 'Bağla' })}</span>
                        </button>
                      {(() => {
                        const categoryItems = categoryTree.length > 0
                          ? sortCategoriesByPriority(categoryTree).map(n => ({ key: n.id, displayName: n.name, lookupName: n.nameAz || n.name, node: n }))
                          : sortStringCategoriesByPriority(categories).map(c => ({ key: c, displayName: getCategoryTranslation(c), lookupName: c, node: null as CategoryNode | null }));

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
                              <h3 className="dv-mega-col-title text-[10px] uppercase tracking-[0.22em] text-black/50 font-medium pb-3 mb-3 border-b border-black/[0.07]" data-testid="menu-col-title-categories">
                                {t('header.categories', { defaultValue: 'Kateqoriyalar' })}
                              </h3>
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
                                <h3 className="dv-mega-col-title text-[10px] uppercase tracking-[0.22em] text-black/50 font-medium pb-3 mb-3 border-b border-black/[0.07]" data-testid="menu-col-title-col2">
                                  {hasSubcats
                                    ? t('header.subcategories', { defaultValue: 'Alt Kateqoriyalar' })
                                    : t('header.brands', { defaultValue: 'Brendlər' })}
                                </h3>
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
                                            navigate(`/products?brand=${encodeURIComponent(brand)}`);
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
                                <h3 className="dv-mega-col-title text-[10px] uppercase tracking-[0.22em] text-black/50 font-medium pb-3 mb-3 border-b border-black/[0.07]" data-testid="menu-col-title-brands">
                                  {t('header.brands', { defaultValue: 'Brendlər' })}
                                </h3>
                                <ul className="space-y-1">
                                  {brandsForSubcategory.map((brand, idx) => (
                                    <li key={`${hoveredSubcategory}-${brand}`}>
                                      <button
                                        onClick={() => {
                                          navigate(`/products?brand=${encodeURIComponent(brand)}`);
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
                className={`flex items-center gap-2 font-normal text-[11px] tracking-wide whitespace-nowrap transition-opacity duration-200 font-futura uppercase ${
                  transparentMode ? 'text-white hover:text-white/80' : 'text-black hover:text-gray-700'
                } ${showDropdown ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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
                } ${showDropdown ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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
                <span className="relative dv-giftcard-script text-[17px] leading-none -mt-[1px]">
                  {t('header.giftCards', { defaultValue: 'Hədiyyə' })}
                </span>
              </Link>

              {isLoggedIn && userRole === 'customer' && (
                <Link to="/warranty" className="dv-navlink text-gray-900 hover:text-gray-600 font-normal text-[11px] tracking-wide whitespace-nowrap font-futura uppercase transition-colors" data-testid="header-warranty-link">
                  {t('header.warranty', { defaultValue: 'Zəmanət xidməti' })}
                </Link>
              )}
              {isLoggedIn && userRole === 'b2b' && (
                <div className="relative flex flex-col items-start leading-none">
                  <Link to="/b2b/orders" className="text-gray-900 hover:text-gray-600 font-normal text-[11px] tracking-wide whitespace-nowrap font-futura uppercase transition-colors">
                    {t('header.myOrders')}
                  </Link>
                  {lastOrderStatus && (
                    <Link
                      to="/b2b/orders"
                      className="absolute top-full left-0 mt-0.5 flex items-center gap-1 whitespace-nowrap text-[9px] font-medium uppercase tracking-wide hover:opacity-80 transition-opacity"
                      data-testid="header-last-order-status"
                      title={`Son sifariş ${lastOrderNumber || ''}`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                        lastOrderStatus === 'delivered' ? 'bg-gray-400' :
                        lastOrderStatus === 'delivering' ? 'bg-purple-500 animate-pulse' :
                        lastOrderStatus === 'ready' ? 'bg-green-500' :
                        lastOrderStatus === 'preparing' ? 'bg-orange-500 animate-pulse' :
                        lastOrderStatus === 'accepted' ? 'bg-blue-500' :
                        'bg-yellow-500 animate-pulse'
                      }`} />
                      <span className={
                        lastOrderStatus === 'delivered' ? 'text-gray-500' :
                        lastOrderStatus === 'delivering' ? 'text-purple-600' :
                        lastOrderStatus === 'ready' ? 'text-green-600' :
                        lastOrderStatus === 'preparing' ? 'text-orange-600' :
                        lastOrderStatus === 'accepted' ? 'text-blue-600' :
                        'text-yellow-600'
                      }>
                        {lastOrderStatus === 'pending' ? 'Gözləyir' :
                         lastOrderStatus === 'accepted' ? 'Qəbul edildi' :
                         lastOrderStatus === 'preparing' ? 'Hazırlanır' :
                         lastOrderStatus === 'ready' ? 'Hazırdır' :
                         lastOrderStatus === 'delivering' ? 'Çatdırılır' :
                         lastOrderStatus === 'delivered' ? 'Çatdırıldı' :
                         lastOrderStatus}
                      </span>
                    </Link>
                  )}
                </div>
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
                        to={userRole === 'b2b' ? '/b2b/orders' : '/my-orders'}
                        onClick={() => setShowLoginDropdown(false)}
                        className="block w-full text-left px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors"
                        data-testid="account-my-orders"
                      >
                        Sifarişlərim
                      </Link>
                      {userRole === 'customer' && (
                        <Link
                          to="/warranty"
                          onClick={() => setShowLoginDropdown(false)}
                          className="block w-full text-left px-4 py-2.5 text-[13px] text-black/80 hover:bg-black/[0.04] hover:text-black transition-colors border-t border-black/[0.07]"
                          data-testid="account-warranty"
                        >
                          Zəmanət xidməti
                        </Link>
                      )}
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
              className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-md dv-menu-backdrop ${isMobileMenuClosing ? 'is-closing' : ''}`}
              onClick={closeMobileMenu}
            ></div>

            <div
              className={`dv-light-reset fixed top-0 left-0 h-full w-full z-50 bg-white dv-menu-panel ${isMobileMenuClosing ? 'is-closing' : ''}`}
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
                <img src="https://customer-assets-m6fa6gv7.emergentagent.net/job_44f0704f-1da0-4748-83a9-feaea0a882af/artifacts/60f44qqe_IMG_1279.JPG-removebg-preview.png" alt="De Valeur" className="h-9 absolute left-1/2 -translate-x-1/2" />
                <div className="w-7" aria-hidden="true" />
              </div>

              <div className="flex flex-col h-[calc(100%-89px)] overflow-y-auto">
                <div data-testid="mobile-menu-stack">
                  {/* Mobil menyu — akkordeon üslubu: hər kateqoriyanın yanında +/×.
                      + basanda alt-kateqoriya / brendlər AŞAĞI genişlənir. */}
                  {(() => {
                    const rawCategoryItems = categoryTree.length > 0
                      ? categoryTree.map((node) => ({
                          key: node.id,
                          name: node.name,
                          nameAz: node.nameAz,
                          nameRu: node.nameRu,
                          nameEn: node.nameEn,
                          displayName: node.name,
                          lookupName: node.nameAz || node.name,
                          lookupNames: [node.nameAz, node.nameRu, node.nameEn].filter(Boolean),
                          children: node.children,
                        }))
                      : categories.map((c) => ({
                          key: c,
                          name: c,
                          nameAz: c,
                          nameRu: undefined,
                          nameEn: undefined,
                          displayName: getCategoryTranslation(c),
                          lookupName: c,
                          lookupNames: [c],
                          children: [] as CategoryNode[],
                        }));
                    const categoryItems = sortCategoriesByPriority(rawCategoryItems);

                    return (
                      <ul className="px-6 pt-2 pb-4">
                        {categoryItems.map((cat) => {
                          const isOpen = mobileCategoryOpen === cat.key;
                          const hasChildren = (cat.children?.length || 0) > 0;
                          const catBrands = Array.from(new Set(cat.lookupNames.flatMap((n: string) => productsByCategory[n] || [])))
                            .sort((a: string, b: string) => a.localeCompare(b, 'az'));
                          const hasContent = hasChildren || catBrands.length > 0;

                          return (
                            <li key={cat.key} className={`relative dv-mobile-cat ${isOpen ? 'is-open' : ''}`}>
                              <button
                                onClick={() => {
                                  if (!hasContent) {
                                    navigate(`/products?category=${encodeURIComponent(cat.lookupName)}`);
                                    closeMobileMenu();
                                    window.scrollTo({ top: 0, behavior: 'auto' });
                                    return;
                                  }
                                  setMobileCategoryOpen(isOpen ? null : cat.key);
                                  setMobileSubCategoryOpen(null);
                                }}
                                className={`w-full flex items-center justify-between gap-3 py-3 pl-3 -ml-3 text-left text-[15px] uppercase tracking-[0.08em] font-medium transition-colors ${isOpen ? 'text-black' : 'text-black hover:opacity-70'}`}
                                data-testid={`mobile-category-toggle-${cat.name}`}
                                aria-expanded={isOpen}
                              >
                                <span>{cat.displayName}</span>
                                {hasContent && (
                                  isOpen
                                    ? <X className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                                    : <Plus className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                                )}
                              </button>

                              {isOpen && hasContent && (
                                <div className="dv-accordion-open pb-3 pl-4 ml-1 border-l border-black/[0.08]">
                                  {/* Hamısına bax */}
                                  <button
                                    onClick={() => {
                                      navigate(`/products?category=${encodeURIComponent(cat.lookupName)}`);
                                      closeMobileMenu();
                                      window.scrollTo({ top: 0, behavior: 'auto' });
                                    }}
                                    className="block w-full text-left text-[12px] uppercase tracking-[0.14em] text-black/60 hover:text-black py-2 mb-1"
                                    data-testid={`mobile-category-all-${cat.name}`}
                                  >
                                    {t('header.viewAll', { defaultValue: 'Hamısına bax' })} →
                                  </button>

                                  {hasChildren ? (
                                    <ul className="space-y-0">
                                      {cat.children.map((sub: CategoryNode) => {
                                        const subOpen = mobileSubCategoryOpen === sub.id;
                                        const sLookups = [sub.nameAz, sub.nameRu, sub.nameEn].filter(Boolean);
                                        const sBrands = Array.from(new Set(sLookups.flatMap((n: string) => productsByCategory[n] || [])))
                                          .sort((a: string, b: string) => a.localeCompare(b, 'az'));
                                        const sHasBrands = sBrands.length > 0;

                                        return (
                                          <li key={sub.id} className="border-t border-black/[0.05]">
                                            <button
                                              onClick={() => {
                                                if (!sHasBrands) {
                                                  navigate(`/products?category=${encodeURIComponent(sub.nameAz || sub.name)}`);
                                                  closeMobileMenu();
                                                  window.scrollTo({ top: 0, behavior: 'auto' });
                                                  return;
                                                }
                                                setMobileSubCategoryOpen(subOpen ? null : sub.id);
                                              }}
                                              className="w-full flex items-center justify-between gap-3 py-3.5 text-left text-[14px] text-gray-800 hover:text-black transition-colors"
                                              data-testid={`mobile-subcategory-toggle-${sub.name}`}
                                              aria-expanded={subOpen}
                                            >
                                              <span>{sub.name}</span>
                                              {sHasBrands && (
                                                subOpen
                                                  ? <X className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} />
                                                  : <Plus className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} />
                                              )}
                                            </button>
                                            {subOpen && sHasBrands && (
                                              <div className="pb-3 pl-3">
                                                <button
                                                  onClick={() => {
                                                    navigate(`/products?category=${encodeURIComponent(sub.nameAz || sub.name)}`);
                                                    closeMobileMenu();
                                                    window.scrollTo({ top: 0, behavior: 'auto' });
                                                  }}
                                                  className="block w-full text-left text-[11px] uppercase tracking-[0.14em] text-black/55 hover:text-black py-1.5 mb-1"
                                                  data-testid={`mobile-sub-all-${sub.name}`}
                                                >
                                                  {t('header.viewAll', { defaultValue: 'Hamısına bax' })} →
                                                </button>
                                                <ul>
                                                  {sBrands.map((b: string) => (
                                                    <li key={`${sub.id}-${b}`}>
                                                      <button
                                                        onClick={() => {
                                                          navigate(`/products?brand=${encodeURIComponent(b)}`);
                                                          closeMobileMenu();
                                                          window.scrollTo({ top: 0, behavior: 'auto' });
                                                        }}
                                                        className="block w-full text-left text-[13px] py-2 text-gray-700 hover:text-black transition-colors"
                                                        data-testid={`mobile-sub-brand-${b}`}
                                                      >
                                                        {b}
                                                      </button>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <ul>
                                      {catBrands.map((b: string) => (
                                        <li key={`${cat.key}-${b}`}>
                                          <button
                                            onClick={() => {
                                              navigate(`/products?brand=${encodeURIComponent(b)}`);
                                              closeMobileMenu();
                                              window.scrollTo({ top: 0, behavior: 'auto' });
                                            }}
                                            className="block w-full text-left text-[14px] py-2.5 text-gray-700 hover:text-black transition-colors"
                                            data-testid={`mobile-brand-${b}`}
                                          >
                                            {b}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
                {/* Alt menyu — Hədiyyə Kartı, Dillər, Giriş */}
                <nav className="flex-shrink-0 border-t border-black/[0.06]">
                  <div className="px-4 pt-4"></div>

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
                      <span className="relative dv-giftcard-script text-[20px] leading-none -mt-[1px]">
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

                  {isLoggedIn && userRole === 'customer' && (
                    <div className="dv-menu-item" style={{ ['--dv-i' as any]: 8 }}>
                    <Link
                      to="/warranty"
                      className="flex items-center justify-between px-4 py-4 text-[12px] uppercase tracking-[0.18em] text-black hover:bg-black/[0.03] transition-colors border-b border-black/[0.06]"
                      onClick={closeMobileMenu}
                      data-testid="mobile-warranty-link"
                    >
                      <span>Zəmanət xidməti</span>
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
              src="https://customer-assets-m6fa6gv7.emergentagent.net/job_44f0704f-1da0-4748-83a9-feaea0a882af/artifacts/60f44qqe_IMG_1279.JPG-removebg-preview.png"
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
                  className="w-full pl-14 pr-14 py-4 text-[15px] text-black placeholder-black/45 bg-white border border-black/35 rounded-full focus:border-black focus:outline-none transition-colors"
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

            {/* Category quick-picks — admin-in qoyduğu kateqoriyalar (məhsullardakı köhnə dəyərlər deyil) */}
            {!searchQuery && (categoryTree.length > 0 || categories.length > 0) && (() => {
              // Bütün kateqoriyalar (əsas + alt) — düz siyahı halında
              const fromAdmin: string[] = [];
              const walk = (n: CategoryNode) => {
                const display = n.name || n.nameAz || n.nameEn || n.nameRu;
                if (display && !fromAdmin.includes(display)) fromAdmin.push(display);
                n.children.forEach(walk);
              };
              categoryTree.forEach(walk);
              const rawList = fromAdmin.length > 0 ? fromAdmin : categories;
              // İstifadəçi tələbi: Saat → Gümüş → Dəri → qalanları
              const trendingList = sortStringCategoriesByPriority(rawList);
              if (trendingList.length === 0) return null;
              return (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 max-w-4xl mx-auto" data-testid="header-search-trending">
                  {trendingList.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSearchQuery(c)}
                      className="text-[12.5px] text-black/80 hover:text-black hover:underline underline-offset-4 transition-colors"
                      data-testid={`header-search-trending-${c}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Results / Default grid */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pb-16">
            {/* ═══ Kateqoriya / Brend uyğunluqları — istifadəçi axtardığı söz ilə üst-üstə düşənlər ═══ */}
            {searchQuery.trim() && (() => {
              const qLower = searchQuery.trim().toLowerCase();
              const qNorm = normalizeAz(qLower);

              // Bütün kateqoriyalar (əsas + alt) — həm admin tree, həm də düz siyahı
              const allCategoryNames: Array<{ name: string; lookupName: string }> = [];
              const walkCat = (n: CategoryNode) => {
                const display = n.name || n.nameAz || n.nameEn || n.nameRu;
                if (display) allCategoryNames.push({ name: display, lookupName: n.nameAz || display });
                n.children.forEach(walkCat);
              };
              categoryTree.forEach(walkCat);
              if (allCategoryNames.length === 0) {
                categories.forEach((c) => allCategoryNames.push({ name: c, lookupName: c }));
              }

              // Uyğun kateqoriyalar — söz və ya normal (diakritiksiz) uyğunluq. Digər dillərin adları da yoxlanır.
              const matchedCategoriesRaw = allCategoryNames.filter(({ name }) => {
                const lc = name.toLowerCase();
                const nc = normalizeAz(lc);
                if (lc.includes(qLower) || nc.includes(qNorm)) return true;
                if (fuzzyIncludes(nc, qNorm)) return true;
                // Kateqoriyanın digər dildəki variantları (categoryLangMap-dən)
                const variants = categoryLangMap[lc] || [];
                return variants.some((v) => {
                  const vl = v.toLowerCase();
                  const vn = normalizeAz(vl);
                  return vl.includes(qLower) || vn.includes(qNorm) || fuzzyIncludes(vn, qNorm);
                });
              });
              // Saat → Gümüş → Dəri prioriteti
              const matchedCategories = sortCategoriesByPriority(matchedCategoriesRaw).slice(0, 8);

              // Uyğun brendlər — məhsullardan çıxarılır (unikal, sıralanmış)
              const brandSet = new Set<string>();
              allProducts.forEach((p) => {
                const b = (p.brand || '').trim();
                if (!b) return;
                const bl = b.toLowerCase();
                const bn = normalizeAz(bl);
                if (bl.includes(qLower) || bn.includes(qNorm) || fuzzyIncludes(bn, qNorm)) brandSet.add(b);
              });
              const matchedBrands = Array.from(brandSet).sort((a, b) => a.localeCompare(b, 'az')).slice(0, 10);

              // ═══ Uyğun səhifələr (Haqqımızda, Bloq, Əlaqə, Çatdırılma və s.) ═══
              const currentLang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
              const matchesPage = (p: SearchPage): boolean => {
                const haystack = [
                  p.title.az, p.title.ru, p.title.en,
                  ...p.keywords,
                ].map((s) => normalizeAz(s.toLowerCase()));
                if (haystack.some((h) => h.includes(qNorm) || fuzzyIncludes(h, qNorm))) return true;
                // Sinonim uyğunluğu: istifadəçinin sözü hər hansı bir kateqoriyada varsa
                const synonyms = expandTokenSynonyms(qNorm);
                if (synonyms.length > 1 && haystack.some((h) => synonyms.some((s) => h.includes(s)))) return true;
                return false;
              };
              const matchedPages = SEARCHABLE_PAGES.filter(matchesPage).slice(0, 6);

              if (matchedCategories.length === 0 && matchedBrands.length === 0 && matchedPages.length === 0) return null;

              return (
                <div className="mb-8 space-y-4" data-testid="header-search-suggestions">
                  {matchedPages.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/50 mb-2.5 font-medium">
                        {t('header.pages', { defaultValue: 'Səhifələr' })}
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {matchedPages.map((p) => (
                          <button
                            key={`pg-${p.key}`}
                            type="button"
                            onClick={() => {
                              navigate(p.path);
                              closeSearchModal();
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className="dv-shine-chip group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black text-[12.5px] font-semibold rounded-full shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border border-amber-500/70"
                            data-testid={`header-search-suggest-page-${p.key}`}
                          >
                            <span className="relative z-10">{p.title[currentLang] || p.title.az}</span>
                            <span className="relative z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/10 text-[10px] transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {matchedCategories.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/50 mb-2.5 font-medium">
                        {t('header.categories', { defaultValue: 'Kateqoriyalar' })}
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {matchedCategories.map((c) => (
                          <button
                            key={`cat-${c.name}`}
                            type="button"
                            onClick={() => {
                              navigate(`/products?category=${encodeURIComponent(c.lookupName)}`);
                              closeSearchModal();
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className="dv-shine-chip group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[12.5px] font-medium rounded-full shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                            data-testid={`header-search-suggest-category-${c.name}`}
                          >
                            <span className="relative z-10">{c.name}</span>
                            <span className="relative z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/15 text-[10px] transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {matchedBrands.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/50 mb-2.5 font-medium">
                        {t('header.brands', { defaultValue: 'Brendlər' })}
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {matchedBrands.map((b) => (
                          <button
                            key={`br-${b}`}
                            type="button"
                            onClick={() => {
                              navigate(`/products?brand=${encodeURIComponent(b)}`);
                              closeSearchModal();
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className="dv-shine-chip group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 bg-white border border-black/25 text-black text-[12.5px] font-medium rounded-full shadow-sm hover:bg-black hover:text-white hover:border-black hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                            data-testid={`header-search-suggest-brand-${b}`}
                          >
                            <span className="relative z-10">{b}</span>
                            <span className="relative z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/8 group-hover:bg-white/20 text-[10px] transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {(() => {
              const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
              const isQuery = !!searchQuery.trim();

              // Default grid (istifadəçi hələ heç nə yazmayıb) — RANDOM qarışıq.
              // Ana səhifə seksiyalarındakı kimi hər kateqoriyadan balanslı nümunə
              // götürüb qarışdırırıq ki, saat + eynək + pulqabı + hədiyyə hamısı görsənsin.
              // `searchRandomSeed` dəyişəndə (yeni modal açılışı) bütün siyahı yenilənir.
              const defaultGrid: Product[] = !isQuery
                ? (() => {
                    // Faktiki dəyişən: `searchRandomSeed` (silinməsin — dependency yerinə keçir)
                    void searchRandomSeed;
                    const pool = allProducts.filter((p) => p.isEnabled !== false && !p.comingSoon);
                    if (pool.length === 0) return [];
                    // Kateqoriya üzrə qruplaşdır
                    const byCat: Record<string, Product[]> = {};
                    for (const p of pool) {
                      const key = (p.category || '_none').toLowerCase();
                      (byCat[key] ??= []).push(p);
                    }
                    // Fisher-Yates
                    const shuffle = <T,>(arr: T[]): T[] => {
                      const a = arr.slice();
                      for (let i = a.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [a[i], a[j]] = [a[j], a[i]];
                      }
                      return a;
                    };
                    // Hər kateqoriyadan 3-ə qədər random məhsul + qalanı poolun random qarışığından
                    const bucketPicks: Product[] = [];
                    for (const cat of Object.keys(byCat)) {
                      const shuffled = shuffle(byCat[cat]);
                      bucketPicks.push(...shuffled.slice(0, 3));
                    }
                    const remaining = shuffle(pool.filter((p) => !bucketPicks.includes(p)));
                    const mixed = shuffle([...bucketPicks, ...remaining]);
                    return mixed.slice(0, 24);
                  })()
                : [];

              if (isQuery && searchResults.length === 0) {
                // Don't show "no results" while products are still loading
                if (allProducts.length === 0) return null;
                // Kateqoriya/brend təklifləri varsa "nəticə tapılmadı" göstərməyək —
                // istifadəçi hələ də chip-lərə klik edə bilər.
                const q2 = searchQuery.trim().toLowerCase();
                const q2Norm = normalizeAz(q2);
                const anyCatMatch = (categoryTree.length > 0 || categories.length > 0) &&
                  ((() => {
                    const check = (name: string) => {
                      const lc = name.toLowerCase();
                      const nc = normalizeAz(lc);
                      return lc.includes(q2) || nc.includes(q2Norm) || fuzzyIncludes(nc, q2Norm);
                    };
                    const walkAny = (n: CategoryNode): boolean =>
                      check(n.name || n.nameAz || n.nameEn || n.nameRu || '') || n.children.some(walkAny);
                    return categoryTree.some(walkAny) || categories.some(check);
                  })());
                const anyBrandMatch = allProducts.some((p) => {
                  const b = (p.brand || '').toLowerCase();
                  const bn = normalizeAz(b);
                  return b && (b.includes(q2) || bn.includes(q2Norm) || fuzzyIncludes(bn, q2Norm));
                });
                // Səhifə uyğunluğu var — heç bir məhsul yoxdursa da səhifə linkləri işə yarayır
                const anyPageMatch = SEARCHABLE_PAGES.some((p) => {
                  const hs = [p.title.az, p.title.ru, p.title.en, ...p.keywords]
                    .map((s) => normalizeAz(s.toLowerCase()));
                  if (hs.some((h) => h.includes(q2Norm) || fuzzyIncludes(h, q2Norm))) return true;
                  const syns = expandTokenSynonyms(q2Norm);
                  return syns.length > 1 && hs.some((h) => syns.some((s) => h.includes(s)));
                });
                if (anyCatMatch || anyBrandMatch || anyPageMatch) return null;
                return (
                  <div className="text-center py-20" data-testid="header-search-no-results">
                    <p className="text-[14px] text-black/55">
                      {t('common.noResults', 'Nəticə tapılmadı')}
                    </p>
                  </div>
                );
              }

              const productsToShow = isQuery ? searchResults : defaultGrid;
              if (productsToShow.length === 0) return null;

              return (
                <>
                  <h3 className="text-[15px] sm:text-[16px] text-black mb-6 font-medium" data-testid="header-search-section-title">
                    {isQuery
                      ? t('header.searchResults', { defaultValue: 'Nəticələr' })
                      : t('header.discover', { defaultValue: 'Kəşf edin' })}
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
                          <p className="text-[11px] uppercase tracking-[0.14em] text-black/55 mb-1 truncate">
                            {p.brand}
                          </p>
                          <p className="text-[13px] text-black leading-tight line-clamp-2 mb-1.5 group-hover:underline underline-offset-4">
                            {displayName}
                          </p>
                          <p className="text-[13px] text-black/75">
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
