import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Package, Users, Tag, FileText, Building2, LogOut, Loader2, Info, Mail, Edit, ShoppingBag, Image as ImageIcon, Search, Settings, Bell, Briefcase, ShieldCheck, Lock, BarChart3, MessageSquare, Sparkles, Ticket } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productService } from '../../services/productService';
import { userService } from '../../services/userService';
import B2BOrdersTab from './B2BOrdersTab';
import CustomerOrdersTab from './CustomerOrdersTab';
import EpointSettingsTab from './EpointSettingsTab';
import DeliveryMethodsTab from './DeliveryMethodsTab';
import AnalyticsTab from './AnalyticsTab';
import ReviewsTab from './ReviewsTab';
import AiKnowledgeTab from './AiKnowledgeTab';
import B2BNotificationsTab from './B2BNotificationsTab';
import BannerManagementTab from './BannerManagementTab';
import AboutManagementTab from './AboutManagementTab';
import PrivacyPolicyTab from './PrivacyPolicyTab';
import ReturnPolicyTab from './ReturnPolicyTab';
import CareersTab from './CareersTab';
import DeliveryPolicyTab from './DeliveryPolicyTab';
import ProductBannersTab from './ProductBannersTab';
import PasswordProtectedSection from './PasswordProtectedSection';
import AdminToggleModal from './AdminToggleModal';
import ConfirmModal from './ConfirmModal';
import { siteConfirm } from '../ui/NotificationProvider';
import { playNewOrderSound, unlockAudio } from '../../utils/notificationSound';
import ContactMessagesTab from './ContactMessagesTab';
import SiteSettingsTab from './SiteSettingsTab';
import PasswordsManagementTab from './PasswordsManagementTab';
import PromoCodesTab from './PromoCodesTab';
import HomeSectionsTab from './HomeSectionsTab';
import WorkersTab from './WorkersTab';
const ProductExcelImport = React.lazy(() => import('./ProductExcelImport'));
import type { Product, User, B2BRequest, Brand } from '../../types';

interface BlogPost {
  id?: string;
  title: { az: string; ru: string };
  content: { az: string; ru: string };
  image: string;
  createdAt?: Date;
}

interface Partner {
  id?: string;
  name: string;
  logo: string;
  website?: string;
  createdAt?: Date;
}

interface AboutData {
  id?: string;
  title: { az: string; ru: string };
  content: { az: string; ru: string };
  mission: { az: string; ru: string };
  vision: { az: string; ru: string };
}

interface ContactData {
  id?: string;
  phone: string;
  email: string;
  address: { az: string; ru: string };
  workingHours: { az: string; ru: string };
}

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [b2bRequests, setB2bRequests] = useState<B2BRequest[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; nameAz?: string; nameRu?: string; nameEn?: string; parentId?: string | null }[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [productBanners, setProductBanners] = useState<any[]>([]);
  const [about, setAbout] = useState<AboutData | null>(null);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // B2B sifariş bildirişi: pending sifarişlərin sayı (real-vaxt)
  const [pendingB2BOrdersCount, setPendingB2BOrdersCount] = useState(0);
  // Müştəri sifariş bildirişi: yeni (oxunmamış) ödənilmiş sifarişlərin sayı
  const [pendingCustomerOrdersCount, setPendingCustomerOrdersCount] = useState(0);
  // Müraciətlər bildirişi: yeni (oxunmamış) əlaqə mesajları sayı
  const [newContactMessagesCount, setNewContactMessagesCount] = useState(0);
  // Track previous counts to play sound only on increase (new order arrives)
  const prevCustomerOrdersCountRef = useRef<number>(0);
  const prevB2BOrdersCountRef = useRef<number>(0);
  const audioUnlockedRef = useRef<boolean>(false);

  // Beep helper — artıq qlobal `playNewOrderSound` istifadə olunur (TTS + custom MP3 fallback).
  // AdminPanel mount olduqda da sayğacı izləyir, amma SƏS qlobal listener tərəfindən çalınır
  // (`/app/src/components/AdminGlobalNotifications.tsx`) ki, admin /admin səhifəsində olmasa belə eşitsin.
  // Bu funksiya yalnız "Sayt parametrləri" tab-ından test düyməsi üçün saxlanılır.
  const playOrderSound = () => {
    void playNewOrderSound();
  };

  // Mark audio as unlocked on first user gesture so subsequent beeps
  // can play without triggering autoplay-policy warnings.
  useEffect(() => {
    const unlock = () => {
      audioUnlockedRef.current = true;
      unlockAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);
  // Yalnız bu vaxtdan SONRA yaradılmış pending sifarişlər badge-də sayılır.
  // Admin şifrə ilə bölməyə girəndə bu vaxt yenilənir və localStorage-də saxlanır.
  const B2B_ACK_KEY = 'admin_b2b_orders_last_seen_ms';
  const CUSTOMER_ORDERS_ACK_KEY = 'admin_customer_orders_last_seen_ms';
  const CONTACT_ACK_KEY = 'admin_contact_messages_last_seen_ms';
  const B2B_REQ_ACK_KEY = 'admin_b2b_requests_last_seen_ms';
  const [b2bLastSeen, setB2bLastSeen] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(B2B_ACK_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  });
  const [customerOrdersLastSeen, setCustomerOrdersLastSeen] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_ORDERS_ACK_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  });
  const [contactLastSeen, setContactLastSeen] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(CONTACT_ACK_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  });
  const [b2bReqLastSeen, setB2bReqLastSeen] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(B2B_REQ_ACK_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  });
  const [pendingB2BRequestsCount, setPendingB2BRequestsCount] = useState(0);

  // Real-vaxt: yalnız b2bLastSeen-dan sonra yaradılmış pending sifarişləri say
  useEffect(() => {
    const q = query(collection(db, 'b2bOrders'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data: any = d.data();
        const ms = data?.createdAt?.toMillis ? data.createdAt.toMillis()
          : (typeof data?.createdAt === 'number' ? data.createdAt
            : data?.createdAt instanceof Date ? data.createdAt.getTime() : 0);
        if (ms > b2bLastSeen) count += 1;
      });
      // Play sound when count INCREASES — see comment above for rationale.
      // NOT: Səs artıq `AdminGlobalNotifications` qlobal komponenti tərəfindən çalınır
      // (admin başqa səhifədə olsa belə eşidilsin deyə). Bu listener yalnız badge sayğacını izləyir.
      void playOrderSound; // saxlanılır ki, lint xəta verməsin və test üçün lazım olduqda istifadə oluna bilsin
      prevB2BOrdersCountRef.current = count;
      setPendingB2BOrdersCount(count);
    }, (err) => {
      console.error('B2B orders snapshot error:', err);
    });
    prevB2BOrdersCountRef.current = -1;
    return () => unsub();
  }, [b2bLastSeen]);

  // Real-vaxt: yalnız customerOrdersLastSeen-dan sonra yaradılmış aktiv müştəri sifarişləri
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customer_orders'), (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data: any = d.data();
        // Yalnız ödənilmiş və ya hazırlanan, oxunmamış sifarişlər
        if (data.status === 'pending_payment' || data.status === 'cancelled' || data.status === 'payment_failed') return;
        if (data.isReadByAdmin) return;
        const ms = data?.createdAt?.toMillis ? data.createdAt.toMillis()
          : (typeof data?.createdAt === 'number' ? data.createdAt
            : data?.createdAt instanceof Date ? data.createdAt.getTime() : 0);
        if (ms > customerOrdersLastSeen) count += 1;
      });
      // Play sound when count INCREASES (new order arrived). Skip the very
      // first set (initial mount snapshot, prev=-1).
      // NOT: Səs `AdminGlobalNotifications`-də verilir; burada yalnız badge sayğacı yenilənir.
      prevCustomerOrdersCountRef.current = count;
      setPendingCustomerOrdersCount(count);
    }, (err) => {
      console.error('Customer orders snapshot error:', err);
    });
    // Initialize ref to -1 so the first snapshot does not trigger the sound
    prevCustomerOrdersCountRef.current = -1;
    return () => unsub();
  }, [customerOrdersLastSeen]);

  // Yeni əlaqə mesajları (müraciətlər) — real-vaxt
  // Yalnız contactLastSeen-dan sonra gələn mesajlar badge-də sayılır.
  useEffect(() => {
    const q = query(collection(db, 'contact_messages'));
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data: any = d.data();
        const ms = data?.createdAt?.toMillis ? data.createdAt.toMillis()
          : (typeof data?.createdAt === 'number' ? data.createdAt
            : data?.createdAt instanceof Date ? data.createdAt.getTime() : 0);
        if (ms > contactLastSeen) count += 1;
      });
      setNewContactMessagesCount(count);
    }, (err) => {
      console.error('Contact messages snapshot error:', err);
    });
    return () => unsub();
  }, [contactLastSeen]);

  const acknowledgeContactMessages = () => {
    const now = Date.now();
    setContactLastSeen(now);
    try { localStorage.setItem(CONTACT_ACK_KEY, String(now)); } catch { /* ignore */ }
    setNewContactMessagesCount(0);
  };

  // Yeni B2B sorğuları — real-vaxt
  useEffect(() => {
    const q = query(collection(db, 'b2bRequests'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data: any = d.data();
        const raw = data?.created_at;
        const ms = raw?.toMillis ? raw.toMillis()
          : (typeof raw === 'number' ? raw
            : raw instanceof Date ? raw.getTime()
              : (raw?.seconds ? raw.seconds * 1000 : 0));
        if (ms > b2bReqLastSeen) count += 1;
      });
      setPendingB2BRequestsCount(count);
    }, (err) => {
      console.error('B2B requests snapshot error:', err);
    });
    return () => unsub();
  }, [b2bReqLastSeen]);

  const acknowledgeB2BRequests = () => {
    const now = Date.now();
    setB2bReqLastSeen(now);
    try { localStorage.setItem(B2B_REQ_ACK_KEY, String(now)); } catch { /* ignore */ }
    setPendingB2BRequestsCount(0);
  };

  const acknowledgeB2bOrders = () => {
    const now = Date.now();
    setB2bLastSeen(now);
    try { localStorage.setItem(B2B_ACK_KEY, String(now)); } catch { /* ignore */ }
    setPendingB2BOrdersCount(0);
    // Qlobal listener ack edildiyini bilsin və prev sayğacını sıfırlasın
    try { window.dispatchEvent(new Event('adminOrdersAcknowledged')); } catch { /* ignore */ }
  };
  const acknowledgeCustomerOrders = () => {
    const now = Date.now();
    setCustomerOrdersLastSeen(now);
    try { localStorage.setItem(CUSTOMER_ORDERS_ACK_KEY, String(now)); } catch { /* ignore */ }
    setPendingCustomerOrdersCount(0);
    try { window.dispatchEvent(new Event('adminOrdersAcknowledged')); } catch { /* ignore */ }
  };
  const b2bBadgeCount = pendingB2BOrdersCount;
  const customerBadgeCount = pendingCustomerOrdersCount;

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showEditBrand, setShowEditBrand] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddB2BUser, setShowAddB2BUser] = useState(false);
  const [showAddBlog, setShowAddBlog] = useState(false);
  const [showEditBlog, setShowEditBlog] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('all');
  const [adminBrandFilter, setAdminBrandFilter] = useState('all');
  const [adminStockFilter, setAdminStockFilter] = useState('all');

  // Admin role toggle modal state
  const [adminToggleTarget, setAdminToggleTarget] = useState<{
    userId: string; userName: string; newRole: 'admin' | 'customer';
  } | null>(null);
  // Generic confirm-delete state
  const [deleteUserTarget, setDeleteUserTarget] = useState<{
    userId: string; userName: string;
  } | null>(null);
  // Sayt-içi toast bildirişi (browser alert əvəzinə)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  // Strip leading minus and any "-" so value cannot go below zero.
  // Empty string is allowed so the input can be cleared.
  const sanitizeNonNegative = (v: string) => v.replace(/-/g, '');
  // Block scroll-wheel from inadvertently changing number inputs (worker hands).
  const blockWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.currentTarget as HTMLInputElement).blur();
  };
  // Block keyboard "-" and arrow-up/down from changing the value.
  const blockMinusKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  const [newProduct, setNewProduct] = useState({
    nameAz: '',
    nameRu: '',
    nameEn: '',
    descAz: '',
    descRu: '',
    descEn: '',
    price: '',
    salePrice: '',
    b2bPrice: '',
    b2bSalePrice: '',
    brand: '',
    category: '',
    gender: 'unisex' as 'men' | 'women' | 'unisex',
    images: [''],
    isBestseller: false,
    stock: '0',
    visibleTo: 'all' as 'all' | 'b2b' | 'customer',
  });

  const [editProduct, setEditProduct] = useState({
    nameAz: '',
    nameRu: '',
    nameEn: '',
    descAz: '',
    descRu: '',
    descEn: '',
    price: '',
    salePrice: '',
    b2bPrice: '',
    b2bSalePrice: '',
    stock: '0',
    brand: '',
    category: '',
    gender: 'unisex' as 'men' | 'women' | 'unisex',
    images: [''],
    isBestseller: false,
    comingSoon: false,
    visibleTo: 'all' as 'all' | 'b2b' | 'customer',
  });

  const [newBrand, setNewBrand] = useState({ name: '', logo: '' });
  const [newCategory, setNewCategory] = useState({ nameAz: '', nameRu: '', nameEn: '', parentId: '' });
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [newB2BUser, setNewB2BUser] = useState({
    email: '',
    password: '',
    name: '',
    surname: '',
    phone: '',
    companyName: ''
  });

  const [newBlog, setNewBlog] = useState({
    titleAz: '',
    titleRu: '',
    contentAz: '',
    contentRu: '',
    image: ''
  });

  const [newPartner, setNewPartner] = useState({
    name: '',
    logo: '',
    website: ''
  });

  const [aboutData, setAboutData] = useState({
    titleAz: '',
    titleRu: '',
    contentAz: '',
    contentRu: '',
    missionAz: '',
    missionRu: '',
    visionAz: '',
    visionRu: ''
  });

  const [contactData, setContactData] = useState({
    phone: '',
    email: '',
    addressAz: '',
    addressRu: '',
    workingHoursAz: '',
    workingHoursRu: ''
  });

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');

    if (userRole !== 'admin') {
      navigate('/');
      return;
    }
    loadData();
  }, [navigate]);

  const loadBrands = async (): Promise<Brand[]> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'brands'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const name = typeof data.name === 'object' ? data.name.az || data.name.ru || data.name.en || '' : data.name;
        return {
          id: doc.id,
          name: name,
          logo: data.logo,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date())
        };
      }) as Brand[];
    } catch (error) {
      console.error('Error loading brands:', error);
      return [];
    }
  };

  const loadCategories = async (): Promise<any[]> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'categories'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const parentId = data.parentId || null;
        if (typeof data.name === 'object') {
          return {
            id: doc.id,
            name: data.name.az || data.name.ru || data.name.en || '',
            nameAz: data.name.az || '',
            nameRu: data.name.ru || '',
            nameEn: data.name.en || '',
            nameObj: data.name,
            parentId,
          };
        } else {
          return {
            id: doc.id,
            name: data.name,
            nameAz: data.name,
            nameRu: data.name,
            nameEn: data.name,
            nameObj: { az: data.name, ru: data.name, en: data.name },
            parentId,
          };
        }
      });
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  };

  const loadBlogs = async (): Promise<BlogPost[]> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'blog_posts'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date())
        };
      }) as BlogPost[];
    } catch (error) {
      console.error('Error loading blogs:', error);
      return [];
    }
  };

  const loadPartners = async (): Promise<Partner[]> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'partners'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date())
        };
      }) as Partner[];
    } catch (error) {
      console.error('Error loading partners:', error);
      return [];
    }
  };

  const loadProductBanners = async (): Promise<any[]> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'home_product_banners'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error loading product banners:', error);
      return [];
    }
  };

  const loadAbout = async (): Promise<AboutData | null> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'about'));
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as AboutData;
      }
      return null;
    } catch (error) {
      console.error('Error loading about:', error);
      return null;
    }
  };

  const loadContact = async (): Promise<ContactData | null> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const querySnapshot = await getDocs(collection(db, 'contact'));
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as ContactData;
      }
      return null;
    } catch (error) {
      console.error('Error loading contact:', error);
      return null;
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Admin Panel - Loading data...');
      console.log('Admin Panel - userRole from localStorage:', localStorage.getItem('userRole'));

      const [productsData, usersData, b2bData, brandsData, categoriesData, blogsData, partnersData, productBannersData, aboutData, contactData] = await Promise.all([
        productService.getAll(),
        userService.getAllUsers(),
        userService.getB2BRequests(),
        loadBrands(),
        loadCategories(),
        loadBlogs(),
        loadPartners(),
        loadProductBanners(),
        loadAbout(),
        loadContact()
      ]);

      console.log('Admin Panel - Products loaded:', productsData.length, productsData);
      console.log('Admin Panel - Brands loaded:', brandsData.length);
      console.log('Admin Panel - Categories loaded:', categoriesData.length);

      setProducts(productsData);
      setUsers(usersData);
      setB2bRequests(b2bData);
      setBrands(brandsData);
      setCategories(categoriesData);
      setBlogs(blogsData);
      setPartners(partnersData);
      setProductBanners(productBannersData);
      setAbout(aboutData);
      setContact(contactData);

      if (aboutData) {
        setAboutData({
          titleAz: aboutData.title?.az || '',
          titleRu: aboutData.title?.ru || '',
          contentAz: aboutData.content?.az || '',
          contentRu: aboutData.content?.ru || '',
          missionAz: aboutData.mission?.az || '',
          missionRu: aboutData.mission?.ru || '',
          visionAz: aboutData.vision?.az || '',
          visionRu: aboutData.vision?.ru || ''
        });
      }

      if (contactData) {
        setContactData({
          phone: contactData.phone || '',
          email: contactData.email || '',
          addressAz: contactData.address?.az || '',
          addressRu: contactData.address?.ru || '',
          workingHoursAz: contactData.workingHours?.az || '',
          workingHoursRu: contactData.workingHours?.ru || ''
        });
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.nameAz || !newProduct.price || !newProduct.brand || !newProduct.category) {
      alert('Bütün zorunlu sahələri doldurun');
      return;
    }

    const existingProduct = products.find(p =>
      p.name.az.toLowerCase().trim() === newProduct.nameAz.toLowerCase().trim()
    );

    if (existingProduct) {
      alert('Bu adda məhsul artıq mövcuddur!');
      return;
    }

    if (submitting) return;

    try {
      setSubmitting(true);
      const validImages = newProduct.images.filter(img => img.trim() !== '');
      const product = {
        name: {
          az: newProduct.nameAz,
          ru: newProduct.nameRu || newProduct.nameAz,
          en: newProduct.nameEn || newProduct.nameAz
        },
        description: {
          az: newProduct.descAz,
          ru: newProduct.descRu || newProduct.descAz,
          en: newProduct.descEn || newProduct.descAz
        },
        price: Math.max(0, parseFloat(newProduct.price) || 0),
        salePrice: newProduct.salePrice ? Math.max(0, parseFloat(newProduct.salePrice)) : null,
        b2bPrice: newProduct.b2bPrice ? Math.max(0, parseFloat(newProduct.b2bPrice)) : null,
        b2bSalePrice: newProduct.b2bSalePrice ? Math.max(0, parseFloat(newProduct.b2bSalePrice)) : null,
        images: validImages,
        brand: newProduct.brand,
        category: newProduct.category,
        gender: newProduct.gender,
        isEnabled: true,
        isBestseller: newProduct.isBestseller,
        stock: Math.max(0, parseInt(newProduct.stock) || 0),
        visibleTo: newProduct.visibleTo,
        createdAt: new Date()
      };

      await productService.add(product);
      await loadData();

      setNewProduct({
        nameAz: '',
        nameRu: '',
        nameEn: '',
        descAz: '',
        descRu: '',
        descEn: '',
        price: '',
        salePrice: '',
        b2bPrice: '',
        b2bSalePrice: '',
        brand: '',
        category: '',
        gender: 'unisex',
        images: [''],
        isBestseller: false,
        stock: '0',
        visibleTo: 'all',
      });
      setShowAddProduct(false);
      alert('Məhsul uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setEditProduct({
      nameAz: product.name.az,
      nameRu: product.name.ru,
      nameEn: product.name.en || product.name.az,
      descAz: product.description.az,
      descRu: product.description.ru,
      descEn: product.description.en || product.description.az,
      price: product.price.toString(),
      salePrice: product.salePrice ? product.salePrice.toString() : '',
      b2bPrice: product.b2bPrice ? product.b2bPrice.toString() : '',
      b2bSalePrice: product.b2bSalePrice ? product.b2bSalePrice.toString() : '',
      brand: product.brand,
      category: product.category,
      gender: product.gender,
      images: product.images.length > 0 ? product.images : [''],
      isBestseller: product.isBestseller || false,
      comingSoon: (product as any).comingSoon || false,
      stock: product.stock?.toString() || '0',
      visibleTo: product.visibleTo || 'all',
    });
    setShowEditProduct(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !editProduct.nameAz || !editProduct.price || !editProduct.brand || !editProduct.category) {
      alert('Bütün zorunlu sahələri doldurun');
      return;
    }

    const existingProduct = products.find(p =>
      p.name.az.toLowerCase().trim() === editProduct.nameAz.toLowerCase().trim() &&
      p.id !== editingProduct.id
    );

    if (existingProduct) {
      alert('Bu adda başqa məhsul artıq mövcuddur!');
      return;
    }

    if (submitting) return;

    try {
      setSubmitting(true);
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const validImages = editProduct.images.filter(img => img.trim() !== '');
      const updatedProduct = {
        name: {
          az: editProduct.nameAz,
          ru: editProduct.nameRu || editProduct.nameAz,
          en: editProduct.nameEn || editProduct.nameAz
        },
        description: {
          az: editProduct.descAz,
          ru: editProduct.descRu || editProduct.descAz,
          en: editProduct.descEn || editProduct.descAz
        },
        price: Math.max(0, parseFloat(editProduct.price) || 0),
        salePrice: editProduct.salePrice ? Math.max(0, parseFloat(editProduct.salePrice)) : null,
        b2bPrice: editProduct.b2bPrice ? Math.max(0, parseFloat(editProduct.b2bPrice)) : null,
        b2bSalePrice: editProduct.b2bSalePrice ? Math.max(0, parseFloat(editProduct.b2bSalePrice)) : null,
        images: validImages,
        brand: editProduct.brand,
        category: editProduct.category,
        gender: editProduct.gender,
        isBestseller: editProduct.isBestseller,
        comingSoon: editProduct.comingSoon,
        stock: Math.max(0, parseInt(editProduct.stock) || 0),
        visibleTo: editProduct.visibleTo,
      };

      await updateDoc(doc(db, 'products', editingProduct.id), updatedProduct);
      await loadData();

      setEditingProduct(null);
      setShowEditProduct(false);
      alert('Məhsul uğurla yeniləndi!');
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrand.name.trim()) {
      alert('Markanın adını daxil edin');
      return;
    }

    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await addDoc(collection(db, 'brands'), {
        name: newBrand.name.trim(),
        logo: newBrand.logo.trim() || null,
        createdAt: new Date()
      });

      await loadData();
      setNewBrand({ name: '', logo: '' });
      setShowAddBrand(false);
      alert('Marka uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding brand:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.nameAz.trim()) {
      alert('Kateqoriyanın adını (Az) daxil edin');
      return;
    }

    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await addDoc(collection(db, 'categories'), {
        name: {
          az: newCategory.nameAz.trim(),
          ru: newCategory.nameRu.trim() || newCategory.nameAz.trim(),
          en: newCategory.nameEn.trim() || newCategory.nameAz.trim()
        },
        parentId: newCategory.parentId || null,
        createdAt: new Date()
      });

      await loadData();
      setNewCategory({ nameAz: '', nameRu: '', nameEn: '', parentId: '' });
      setShowAddCategory(false);
      alert('Kateqoriya uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleAddBlog = async () => {
    if (!newBlog.titleAz || !newBlog.contentAz || !newBlog.image) {
      alert('Bütün zorunlu sahələri doldurun');
      return;
    }

    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await addDoc(collection(db, 'blog_posts'), {
        title: { az: newBlog.titleAz, ru: newBlog.titleRu || newBlog.titleAz },
        content: { az: newBlog.contentAz, ru: newBlog.contentRu || newBlog.contentAz },
        image: newBlog.image,
        createdAt: new Date()
      });

      await loadData();
      setNewBlog({ titleAz: '', titleRu: '', contentAz: '', contentRu: '', image: '' });
      setShowAddBlog(false);
      alert('Bloq yazısı uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding blog:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.logo) {
      alert('Ad və loqo daxil edin');
      return;
    }

    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await addDoc(collection(db, 'partners'), {
        name: newPartner.name,
        logo: newPartner.logo,
        website: newPartner.website || null,
        createdAt: new Date()
      });

      await loadData();
      setNewPartner({ name: '', logo: '', website: '' });
      setShowAddPartner(false);
      alert('Tərəfdaş uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding partner:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleSaveAbout = async () => {
    if (!aboutData.titleAz || !aboutData.contentAz) {
      alert('Bütün zorunlu sahələri doldurun');
      return;
    }

    try {
      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const data = {
        title: { az: aboutData.titleAz, ru: aboutData.titleRu || aboutData.titleAz },
        content: { az: aboutData.contentAz, ru: aboutData.contentRu || aboutData.contentAz },
        mission: { az: aboutData.missionAz, ru: aboutData.missionRu || aboutData.missionAz },
        vision: { az: aboutData.visionAz, ru: aboutData.visionRu || aboutData.visionAz }
      };

      if (about?.id) {
        await updateDoc(doc(db, 'about', about.id), data);
      } else {
        await addDoc(collection(db, 'about'), data);
      }

      await loadData();
      alert('Haqqımızda bölməsi yeniləndi!');
    } catch (error) {
      console.error('Error saving about:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleSaveContact = async () => {
    if (!contactData.phone || !contactData.email) {
      alert('Telefon və email daxil edin');
      return;
    }

    try {
      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const data = {
        phone: contactData.phone,
        email: contactData.email,
        address: { az: contactData.addressAz, ru: contactData.addressRu || contactData.addressAz },
        workingHours: { az: contactData.workingHoursAz, ru: contactData.workingHoursRu || contactData.workingHoursAz }
      };

      if (contact?.id) {
        await updateDoc(doc(db, 'contact', contact.id), data);
      } else {
        await addDoc(collection(db, 'contact'), data);
      }

      await loadData();
      alert('Əlaqə məlumatları yeniləndi!');
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (await siteConfirm('Bu markanı silmək istədiyinizdən əminsiniz?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await deleteDoc(doc(db, 'brands', id));
        await loadData();
        alert('Marka silindi!');
      } catch (error) {
        console.error('Error deleting brand:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.nameAz) {
      alert('Kateqoriyanın adını (Az) daxil edin');
      return;
    }

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await updateDoc(doc(db, 'categories', editingCategory.id), {
        name: {
          az: editingCategory.nameAz.trim(),
          ru: editingCategory.nameRu.trim() || editingCategory.nameAz.trim(),
          en: editingCategory.nameEn.trim() || editingCategory.nameAz.trim()
        },
        parentId: editingCategory.parentId || null
      });

      await loadData();
      setShowEditCategory(false);
      setEditingCategory(null);
      alert('Kateqoriya uğurla yeniləndi!');
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (await siteConfirm('Bu kateqoriyanı silmək istədiyinizdən əminsiniz?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await deleteDoc(doc(db, 'categories', id));
        await loadData();
        alert('Kateqoriya silindi!');
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if (await siteConfirm('Bu bloq yazısını silmək istədiyinizdən əminsiniz?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await deleteDoc(doc(db, 'blog_posts', id));
        await loadData();
        alert('Bloq yazısı silindi!');
      } catch (error) {
        console.error('Error deleting blog:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleEditBlog = (blog: BlogPost) => {
    setEditingBlog(blog);
    setNewBlog({
      titleAz: blog.title.az,
      titleRu: blog.title.ru || '',
      contentAz: blog.content.az,
      contentRu: blog.content.ru || '',
      image: blog.image
    });
    setShowEditBlog(true);
    setShowAddBlog(false);
  };

  const handleUpdateBlog = async () => {
    if (!editingBlog || !newBlog.titleAz || !newBlog.contentAz || !newBlog.image) {
      alert('Zəhmət olmasa bütün sahələri doldurun');
      return;
    }

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      await updateDoc(doc(db, 'blog_posts', editingBlog.id!), {
        title: { az: newBlog.titleAz, ru: newBlog.titleRu || newBlog.titleAz },
        content: { az: newBlog.contentAz, ru: newBlog.contentRu || newBlog.contentAz },
        image: newBlog.image
      });

      setNewBlog({ titleAz: '', titleRu: '', contentAz: '', contentRu: '', image: '' });
      setShowEditBlog(false);
      setEditingBlog(null);
      await loadData();
      alert('Bloq yazısı yeniləndi!');
    } catch (error) {
      console.error('Error updating blog:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (await siteConfirm('Bu tərəfdaşı silmək istədiyinizdən əminsiniz?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await deleteDoc(doc(db, 'partners', id));
        await loadData();
        alert('Tərəfdaş silindi!');
      } catch (error) {
        console.error('Error deleting partner:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (await siteConfirm('Bu məhsulu silmək istədiyinizdən əminsiniz?')) {
      try {
        await productService.delete(id);
        await loadData();
        alert('Məhsul silindi!');
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleAddB2BUser = async () => {
    if (!newB2BUser.email || !newB2BUser.password || !newB2BUser.name || !newB2BUser.companyName) {
      alert('Bütün zorunlu sahələri doldurun');
      return;
    }

    try {
      await userService.register(newB2BUser.email, newB2BUser.password, {
        name: newB2BUser.name,
        surname: newB2BUser.surname,
        phone: newB2BUser.phone,
        companyName: newB2BUser.companyName,
        role: 'b2b',
        status: 'active'
      });

      await loadData();
      setNewB2BUser({ email: '', password: '', name: '', surname: '', phone: '', companyName: '' });
      setShowAddB2BUser(false);
      alert('B2B istifadəçi uğurla əlavə edildi!');
    } catch (error) {
      console.error('Error adding B2B user:', error);
      alert('Xəta baş verdi: ' + (error as Error).message);
    }
  };

  const handleApproveB2B = async (requestId: string, request: B2BRequest) => {
    if (await siteConfirm('Bu müraciəti təsdiq edib B2B istifadəçi yaratmaq istəyirsiniz?')) {
      try {
        const { collection, query, where, getDocs, doc, updateDoc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');

        const requestDoc = await getDoc(doc(db, 'b2bRequests', requestId));
        if (!requestDoc.exists()) {
          alert('Müraciət tapılmadı');
          return;
        }

        const requestData = requestDoc.data();
        const password = requestData.password;

        if (!password) {
          alert('Şifrə tapılmadı. Müraciətdə şifrə qeyd edilməyib.');
          return;
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', request.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            role: 'b2b',
            status: 'active',
            companyName: request.company_name
          });
          alert('İstifadəçi artıq mövcuddur. Rolü B2B olaraq yeniləndi.');
        } else {
          await userService.registerForAdmin(request.email, password, {
            name: request.first_name,
            surname: request.last_name,
            phone: request.phone,
            companyName: request.company_name,
            role: 'b2b',
            status: 'active'
          });
          alert('B2B istifadəçi yaradıldı! İstifadəçi müraciətdə qeyd etdiyi şifrə ilə giriş edə bilər.');
        }

        await updateDoc(doc(db, 'b2bRequests', requestId), {
          status: 'approved',
          approvedAt: new Date()
        });

        await loadData();
      } catch (error) {
        console.error('Error approving B2B request:', error);
        alert('Xəta baş verdi: ' + (error as Error).message);
      }
    }
  };

  const handleRejectB2B = async (requestId: string) => {
    if (await siteConfirm('Bu müraciəti rədd etmək istədiyinizdən əminsiniz?')) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await updateDoc(doc(db, 'b2bRequests', requestId), {
          status: 'rejected',
          rejectedAt: new Date()
        });
        await loadData();
      } catch (error) {
        console.error('Error rejecting B2B request:', error);
      }
    }
  };

  const handleToggleB2BStatus = async (userId: string, currentStatus: string) => {
    try {
      await userService.toggleB2BStatus(userId, currentStatus === 'active' ? 'inactive' : 'active');
      loadData();
    } catch (error) {
      console.error('Error toggling B2B status:', error);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setDeleteUserTarget({ userId, userName });
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const { userId, userName } = deleteUserTarget;
    try {
      await userService.deleteUser(userId);
      await loadData();
      showToast(`${userName} silindi`, 'success');
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Silinmədi: ' + (error as Error).message, 'error');
      throw error;
    }
  };

  const handleToggleAdmin = (
    userId: string,
    userName: string,
    newRole: 'admin' | 'customer'
  ) => {
    setAdminToggleTarget({ userId, userName, newRole });
  };

  const confirmAdminToggle = async () => {
    if (!adminToggleTarget) return;
    const { userId, userName, newRole } = adminToggleTarget;
    await userService.setUserRole(userId, newRole);
    await loadData();
    showToast(
      newRole === 'admin' ? `${userName} artıq admindir` : `${userName} artıq müştəridir`,
      'success'
    );
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gray-900 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Yüklənir...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'products', label: t('admin.products'), icon: Package },
    { id: 'customerOrders', label: 'Müştəri Sifarişləri', icon: ShoppingBag, badge: customerBadgeCount },
    { id: 'deliveryMethods', label: 'Çatdırılma Üsulları', icon: Briefcase },
    { id: 'analytics', label: 'Analitika', icon: BarChart3 },
    { id: 'promoCodes', label: 'Promo Kodlar', icon: Ticket },
    { id: 'reviews', label: 'Müştəri Rəyləri', icon: MessageSquare },
    { id: 'aiKnowledge', label: 'AI Bilik Bazası', icon: Sparkles },
    { id: 'epointSettings', label: 'Epoint Açarları', icon: Lock },
    { id: 'b2bOrders', label: t('admin.b2bOrders'), icon: ShoppingBag, badge: b2bBadgeCount },
    { id: 'banners', label: 'Bannerlər', icon: ImageIcon },
    { id: 'productBanners', label: 'Məhsul Bannerləri', icon: ImageIcon },
    { id: 'homeSections', label: 'Ana Səhifə Bölmələri', icon: Edit },
    { id: 'about', label: 'Haqqımızda', icon: Info },
    { id: 'privacy', label: 'Məxfilik Siyasəti', icon: ShieldCheck },
    { id: 'return', label: 'Qaytarılma', icon: FileText },
    { id: 'delivery', label: 'Çatdırılma', icon: ShoppingBag },
    { id: 'careers', label: 'Karyera', icon: Briefcase },
    { id: 'brands', label: t('admin.brands'), icon: Tag },
    { id: 'categories', label: t('admin.categories'), icon: Tag },
    { id: 'blogs', label: t('admin.blog'), icon: FileText },
    { id: 'partners', label: t('admin.partners'), icon: Building2 },
    { id: 'contactMessages', label: 'Müraciətlər', icon: Mail, badge: newContactMessagesCount },
    { id: 'siteSettings', label: 'Sayt Parametrləri', icon: Info },
    { id: 'b2b', label: t('admin.b2bRequests'), icon: Users, badge: pendingB2BRequestsCount },
    { id: 'b2bUsers', label: 'B2B İstifadəçilər', icon: Users },
    { id: 'b2bNotifications', label: 'B2B Bildirişlər', icon: Bell },
    { id: 'workers', label: 'İşçilər', icon: Briefcase },
    { id: 'users', label: t('admin.users'), icon: Users },
    { id: 'passwords', label: 'Şifrələr', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              <LogOut className="h-4 w-4" />
              Çıxış
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex space-x-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const badgeCount = (tab as any).badge || 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'contactMessages') acknowledgeContactMessages();
                    if (tab.id === 'b2bOrders') acknowledgeB2bOrders();
                    if (tab.id === 'b2b') acknowledgeB2BRequests();
                    if (tab.id === 'customerOrders') acknowledgeCustomerOrders();
                  }}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  data-testid={`admin-tab-${tab.id}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {badgeCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow animate-pulse"
                      data-testid={`tab-badge-${tab.id}`}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === 'products' && (
          <PasswordProtectedSection sectionName="products">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Məhsullar ({(() => {
                  return products.filter(p => {
                    const matchesSearch = !productSearchQuery || (() => {
                      const query = productSearchQuery.toLowerCase();
                      return (
                        p.name.az.toLowerCase().includes(query) ||
                        p.name.ru.toLowerCase().includes(query) ||
                        (p.name.en && p.name.en.toLowerCase().includes(query)) ||
                        p.brand.toLowerCase().includes(query) ||
                        p.category.toLowerCase().includes(query)
                      );
                    })();
                    const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1];
                    const matchesCategory = adminCategoryFilter === 'all' || p.category === adminCategoryFilter;
                    const matchesBrand = adminBrandFilter === 'all' || p.brand === adminBrandFilter;
                    const matchesStock = adminStockFilter === 'all' || 
                      (adminStockFilter === 'inStock' && p.stock > 0) ||
                      (adminStockFilter === 'outOfStock' && p.stock === 0) ||
                      (adminStockFilter === 'lowStock' && p.stock > 0 && p.stock <= 5);
                    return matchesSearch && matchesPrice && matchesCategory && matchesBrand && matchesStock;
                  }).length;
                })()})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddProduct(!showAddProduct)}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
                  data-testid="admin-add-product-btn"
                >
                  <Plus className="h-5 w-5" />
                  Məhsul əlavə et
                </button>
                <button
                  onClick={() => setShowMigration(!showMigration)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                    showMigration
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                  data-testid="admin-migration-toggle"
                  title="Excel ilə məhsul miqrasiyası"
                >
                  <FileText className="h-4 w-4" />
                  Miqrasiya et
                </button>
              </div>
            </div>

            {/* Excel ilə stok miqrasiyası — yalnız düymə basıldıqda göstərilir */}
            {showMigration && (
              <div className="mb-6">
                <React.Suspense fallback={<div className="p-4 text-sm text-gray-500">Miqrasiya paneli yüklənir...</div>}>
                  <ProductExcelImport products={products} onDone={loadData} />
                </React.Suspense>
              </div>
            )}

            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Məhsul axtar (ad, brend, kateqoriya)..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Qiymət aralığı: {priceRange[0]} AZN - {priceRange[1]} AZN
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Math.max(0, parseFloat(e.target.value) || 0), priceRange[1]])}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                    placeholder="Min"
                  />
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={priceRange[0]}
                      onChange={(e) => setPriceRange([parseFloat(e.target.value), priceRange[1]])}
                      className="w-full"
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Math.max(0, parseFloat(e.target.value) || 1000)])}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                    placeholder="Max"
                  />
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], parseFloat(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Category, Brand, Stock Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriya</label>
                  <select
                    value={adminCategoryFilter}
                    onChange={(e) => setAdminCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">Hamısı</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brend</label>
                  <select
                    value={adminBrandFilter}
                    onChange={(e) => setAdminBrandFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">Hamısı</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.name}>{brand.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stok</label>
                  <select
                    value={adminStockFilter}
                    onChange={(e) => setAdminStockFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">Hamısı</option>
                    <option value="inStock">Mövcud</option>
                    <option value="outOfStock">Bitdi</option>
                    <option value="lowStock">Az qalıb (≤5)</option>
                  </select>
                </div>
              </div>
            </div>

            {showAddProduct && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Yeni Məhsul</h3>
                  <button onClick={() => setShowAddProduct(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad (Az) *</label>
                    <input
                      type="text"
                      value={newProduct.nameAz}
                      onChange={(e) => setNewProduct({ ...newProduct, nameAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Məhsulun adı"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad (Ru)</label>
                    <input
                      type="text"
                      value={newProduct.nameRu}
                      onChange={(e) => setNewProduct({ ...newProduct, nameRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Название продукта"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad (En)</label>
                    <input
                      type="text"
                      value={newProduct.nameEn}
                      onChange={(e) => setNewProduct({ ...newProduct, nameEn: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Product Name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (Az)</label>
                    <textarea
                      value={newProduct.descAz}
                      onChange={(e) => setNewProduct({ ...newProduct, descAz: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Məhsulun təsviri"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (Ru)</label>
                    <textarea
                      value={newProduct.descRu}
                      onChange={(e) => setNewProduct({ ...newProduct, descRu: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Описание продукта"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (En)</label>
                    <textarea
                      value={newProduct.descEn}
                      onChange={(e) => setNewProduct({ ...newProduct, descEn: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Product Description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Normal Qiymət ( AZN) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: sanitizeNonNegative(e.target.value) })}
                      onWheel={blockWheel}
                      onKeyDown={blockMinusKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Endirimli Qiymət ( AZN)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.salePrice}
                      onChange={(e) => setNewProduct({ ...newProduct, salePrice: sanitizeNonNegative(e.target.value) })}
                      onWheel={blockWheel}
                      onKeyDown={blockMinusKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">B2B Qiymət ( AZN)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.b2bPrice}
                      onChange={(e) => setNewProduct({ ...newProduct, b2bPrice: sanitizeNonNegative(e.target.value) })}
                      onWheel={blockWheel}
                      onKeyDown={blockMinusKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">B2B Endirimli Qiymət ( AZN)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.b2bSalePrice}
                      onChange={(e) => setNewProduct({ ...newProduct, b2bSalePrice: sanitizeNonNegative(e.target.value) })}
                      onWheel={blockWheel}
                      onKeyDown={blockMinusKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Stok Sayı *</label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: sanitizeNonNegative(e.target.value) })}
                      onWheel={blockWheel}
                      onKeyDown={blockMinusKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Brend *
                      <button
                        type="button"
                        onClick={() => setShowAddBrand(true)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        + Yeni Əlavə Et
                      </button>
                    </label>
                    <select
                      value={newProduct.brand}
                      onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="">Brend seçin</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.name}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Kateqoriya *
                      <button
                        type="button"
                        onClick={() => setShowAddCategory(true)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        + Yeni Əlavə Et
                      </button>
                    </label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="">Kateqoriya seçin</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cins *</label>
                    <select
                      value={newProduct.gender}
                      onChange={(e) => setNewProduct({ ...newProduct, gender: e.target.value as 'men' | 'women' | 'unisex' })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="unisex">Unisex</option>
                      <option value="men">Kişi</option>
                      <option value="women">Qadın</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Şəkillər URL</label>
                    {newProduct.images.map((img, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={img}
                          onChange={(e) => {
                            const newImages = [...newProduct.images];
                            newImages[index] = e.target.value;
                            setNewProduct({ ...newProduct, images: newImages });
                          }}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                          placeholder={`Şəkil ${index + 1} URL`}
                        />
                        {index > 0 && (
                          <button
                            onClick={() => {
                              const newImages = newProduct.images.filter((_, i) => i !== index);
                              setNewProduct({ ...newProduct, images: newImages });
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setNewProduct({ ...newProduct, images: [...newProduct.images, ''] })}
                      className="mt-2 text-sm text-gray-700 hover:text-gray-900 font-medium"
                    >
                      + Şəkil əlavə et
                    </button>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProduct.isBestseller}
                        onChange={(e) => setNewProduct({ ...newProduct, isBestseller: e.target.checked })}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                      <span className="text-sm font-medium text-gray-700">Ən çox satılanlar siyahısına əlavə et</span>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Məhsul görünəcək istifadəçilər</label>
                    <select
                      value={newProduct.visibleTo}
                      onChange={(e) => setNewProduct({ ...newProduct, visibleTo: e.target.value as 'all' | 'b2b' | 'customer' })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="all">Hamısı (B2B və Müştərilər)</option>
                      <option value="b2b">Yalnız B2B</option>
                      <option value="customer">Yalnız Müştərilər</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddProduct}
                  disabled={submitting}
                  className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Əlavə edilir...
                    </>
                  ) : (
                    'Məhsul əlavə et'
                  )}
                </button>
              </div>
            )}

            {showEditProduct && editingProduct && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-white rounded-xl p-6 my-8 border-2 border-blue-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Məhsulu Redaktə Et</h3>
                    <button onClick={() => { setShowEditProduct(false); setEditingProduct(null); }} className="text-gray-400 hover:text-gray-600">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Ad (Az) *</label><input type="text" value={editProduct.nameAz} onChange={(e) => setEditProduct({ ...editProduct, nameAz: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Məhsulun adı" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Ad (Ru)</label><input type="text" value={editProduct.nameRu} onChange={(e) => setEditProduct({ ...editProduct, nameRu: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Название продукта" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Ad (En)</label><input type="text" value={editProduct.nameEn} onChange={(e) => setEditProduct({ ...editProduct, nameEn: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Product Name" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (Az)</label><textarea value={editProduct.descAz} onChange={(e) => setEditProduct({ ...editProduct, descAz: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Məhsulun təsviri" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (Ru)</label><textarea value={editProduct.descRu} onChange={(e) => setEditProduct({ ...editProduct, descRu: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Описание продукта" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Təsvir (En)</label><textarea value={editProduct.descEn} onChange={(e) => setEditProduct({ ...editProduct, descEn: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="Product Description" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Normal Qiymət ( AZN) *</label><input type="number" step="0.01" min="0" value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: sanitizeNonNegative(e.target.value) })} onWheel={blockWheel} onKeyDown={blockMinusKey} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="0.00" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Endirimli Qiymət ( AZN)</label><input type="number" step="0.01" min="0" value={editProduct.salePrice} onChange={(e) => setEditProduct({ ...editProduct, salePrice: sanitizeNonNegative(e.target.value) })} onWheel={blockWheel} onKeyDown={blockMinusKey} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="0.00" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">B2B Qiymət ( AZN)</label><input type="number" step="0.01" min="0" value={editProduct.b2bPrice} onChange={(e) => setEditProduct({ ...editProduct, b2bPrice: sanitizeNonNegative(e.target.value) })} onWheel={blockWheel} onKeyDown={blockMinusKey} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="0.00" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">B2B Endirimli Qiymət ( AZN)</label><input type="number" step="0.01" min="0" value={editProduct.b2bSalePrice} onChange={(e) => setEditProduct({ ...editProduct, b2bSalePrice: sanitizeNonNegative(e.target.value) })} onWheel={blockWheel} onKeyDown={blockMinusKey} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="0.00" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Stok Sayı *</label><input type="number" min="0" value={editProduct.stock} onChange={(e) => setEditProduct({ ...editProduct, stock: sanitizeNonNegative(e.target.value) })} onWheel={blockWheel} onKeyDown={blockMinusKey} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder="0" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">Brend * <button type="button" onClick={() => setShowAddBrand(true)} className="text-xs text-blue-600 hover:text-blue-700">+ Yeni Əlavə Et</button></label><select value={editProduct.brand} onChange={(e) => setEditProduct({ ...editProduct, brand: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"><option value="">Brend seçin</option>{brands.map(brand => (<option key={brand.id} value={brand.name}>{brand.name}</option>))}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">Kateqoriya * <button type="button" onClick={() => setShowAddCategory(true)} className="text-xs text-blue-600 hover:text-blue-700">+ Yeni Əlavə Et</button></label><select value={editProduct.category} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"><option value="">Kateqoriya seçin</option>{categories.map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Cins *</label><select value={editProduct.gender} onChange={(e) => setEditProduct({ ...editProduct, gender: e.target.value as 'men' | 'women' | 'unisex' })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"><option value="unisex">Unisex</option><option value="men">Kişi</option><option value="women">Qadın</option></select></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Şəkillər URL</label>{editProduct.images.map((img, index) => (<div key={index} className="flex gap-2 mb-2"><input type="text" value={img} onChange={(e) => { const newImages = [...editProduct.images]; newImages[index] = e.target.value; setEditProduct({ ...editProduct, images: newImages }); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent" placeholder={`Şəkil ${index + 1} URL`} />{index > 0 && (<button onClick={() => { const newImages = editProduct.images.filter((_, i) => i !== index); setEditProduct({ ...editProduct, images: newImages }); }} className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"><X className="h-5 w-5" /></button>)}</div>))}<button onClick={() => setEditProduct({ ...editProduct, images: [...editProduct.images, ''] })} className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"><Plus className="h-4 w-4 inline mr-1" /> Şəkil əlavə et</button></div>
                  <div className="md:col-span-2 flex gap-6"><label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.isBestseller} onChange={(e) => setEditProduct({ ...editProduct, isBestseller: e.target.checked })} className="w-4 h-4" /><span className="text-sm font-medium text-gray-700">Ən çox satılan</span></label><label className="flex items-center gap-2"><input type="checkbox" checked={editProduct.comingSoon || false} onChange={(e) => setEditProduct({ ...editProduct, comingSoon: e.target.checked })} className="w-4 h-4" /><span className="text-sm font-medium text-gray-700">Tezliklə gələcək</span></label></div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Məhsul görünəcək istifadəçilər</label>
                    <select
                      value={editProduct.visibleTo}
                      onChange={(e) => setEditProduct({ ...editProduct, visibleTo: e.target.value as 'all' | 'b2b' | 'customer' })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="all">Hamısı (B2B və Müştərilər)</option>
                      <option value="b2b">Yalnız B2B</option>
                      <option value="customer">Yalnız Müştərilər</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleUpdateProduct}
                  disabled={submitting}
                  className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Yenilənir...
                    </>
                  ) : (
                    'Məhsulu Yenilə'
                  )}
                </button>
                </div>
              </div>
              </div>
            )}

            <div className="grid gap-4">
              {products.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Məhsul yoxdur</p>
                </div>
              ) : (() => {
                const filteredProducts = products
                  .filter((product) => {
                    const matchesSearch = !productSearchQuery || (() => {
                      const query = productSearchQuery.toLowerCase();
                      return (
                        product.name.az.toLowerCase().includes(query) ||
                        product.name.ru.toLowerCase().includes(query) ||
                        (product.name.en && product.name.en.toLowerCase().includes(query)) ||
                        product.brand.toLowerCase().includes(query) ||
                        product.category.toLowerCase().includes(query)
                      );
                    })();

                    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
                    const matchesCategory = adminCategoryFilter === 'all' || product.category === adminCategoryFilter;
                    const matchesBrand = adminBrandFilter === 'all' || product.brand === adminBrandFilter;
                    const matchesStock = adminStockFilter === 'all' || 
                      (adminStockFilter === 'inStock' && product.stock > 0) ||
                      (adminStockFilter === 'outOfStock' && product.stock === 0) ||
                      (adminStockFilter === 'lowStock' && product.stock > 0 && product.stock <= 5);

                    return matchesSearch && matchesPrice && matchesCategory && matchesBrand && matchesStock;
                  })
                  .sort((a, b) => {
                    const brandCompare = a.brand.localeCompare(b.brand);
                    if (brandCompare !== 0) return brandCompare;
                    return a.name.az.localeCompare(b.name.az);
                  });

                if (filteredProducts.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Axtarış üzrə nəticə tapılmadı</p>
                      {productSearchQuery && (
                        <p className="text-sm mt-2">"{productSearchQuery}" sorğusu üzrə məhsul yoxdur</p>
                      )}
                    </div>
                  );
                }

                return filteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <img src={product.images[0]} alt={product.name.az} className="w-16 h-16 object-cover rounded-lg" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{product.name.az}</h3>
                      <p className="text-sm text-gray-600">{product.brand} · {product.category}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium text-gray-900">{product.price} AZN</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${product.stock === 0 ? 'bg-red-100 text-red-700' : product.stock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {product.stock === 0 ? 'Bitdi' : `Mövcud: ${product.stock}`}
                        </span>
                      </div>
                      {product.isBestseller && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                          Ən çox satılan
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditProductClick(product)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'brands' && (
          <PasswordProtectedSection sectionName="brands">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Markalar ({brands.length})</h2>
              <button
                onClick={() => setShowAddBrand(!showAddBrand)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus className="h-5 w-5" />
                Marka əlavə et
              </button>
            </div>

            {showAddBrand && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Yeni Marka</h3>
                  <button onClick={() => setShowAddBrand(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Markanın adı *</label>
                    <input
                      type="text"
                      placeholder="Markanın adı"
                      value={newBrand.name}
                      onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/logo.jpg"
                      value={newBrand.logo}
                      onChange={(e) => setNewBrand({ ...newBrand, logo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddBrand}
                  className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Marka əlavə et
                </button>
              </div>
            )}

            {showEditBrand && editingBrand && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Markanı Redaktə Et</h3>
                  <button onClick={() => {
                    setShowEditBrand(false);
                    setEditingBrand(null);
                  }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Markanın adı *</label>
                    <input
                      type="text"
                      placeholder="Markanın adı"
                      value={editingBrand.name || ''}
                      onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/logo.png"
                      value={editingBrand.logo || ''}
                      onChange={(e) => setEditingBrand({ ...editingBrand, logo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    {editingBrand.logo && (
                      <img src={editingBrand.logo} alt="Preview" className="mt-2 w-16 h-16 object-contain rounded border" />
                    )}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!editingBrand.name) {
                      alert('Markanın adını daxil edin');
                      return;
                    }
                    try {
                      const { updateDoc, doc } = await import('firebase/firestore');
                      const { db } = await import('../../lib/firebase');
                      await updateDoc(doc(db, 'brands', editingBrand.id), {
                        name: editingBrand.name,
                        logo: editingBrand.logo || ''
                      });
                      setShowEditBrand(false);
                      setEditingBrand(null);
                      loadData();
                      alert('Marka yeniləndi!');
                    } catch (error) {
                      console.error('Error updating brand:', error);
                      alert('Xəta baş verdi');
                    }
                  }}
                  className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Markanı Yenilə
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {brands.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Marka yoxdur</p>
                </div>
              ) : (
                brands.map((brand) => (
                  <div key={brand.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <div className="flex items-center gap-3">
                      {brand.logo && (
                        <img src={brand.logo} alt={brand.name} className="w-10 h-10 object-contain rounded" />
                      )}
                      <span className="font-medium text-gray-900">{brand.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingBrand(brand);
                          setShowEditBrand(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBrand(brand.id!)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'categories' && (
          <PasswordProtectedSection sectionName="categories">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Kateqoriyalar ({categories.length})</h2>
              <button
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus className="h-5 w-5" />
                Kateqoriya əlavə et
              </button>
            </div>

            {showAddCategory && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Yeni Kateqoriya</h3>
                  <button onClick={() => setShowAddCategory(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (Az) *</label>
                    <input
                      type="text"
                      placeholder="Kateqoriyanın adı"
                      value={newCategory.nameAz}
                      onChange={(e) => setNewCategory({ ...newCategory, nameAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (Ru)</label>
                    <input
                      type="text"
                      placeholder="Название категории"
                      value={newCategory.nameRu}
                      onChange={(e) => setNewCategory({ ...newCategory, nameRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (En)</label>
                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCategory.nameEn}
                      onChange={(e) => setNewCategory({ ...newCategory, nameEn: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ana kateqoriya <span className="text-gray-400 font-normal">(seçim — alt-kateqoriya yaratmaq üçün)</span>
                    </label>
                    <select
                      value={newCategory.parentId}
                      onChange={(e) => setNewCategory({ ...newCategory, parentId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      data-testid="new-category-parent-select"
                    >
                      <option value="">— Yoxdur (ana kateqoriya kimi yaradılsın) —</option>
                      {categories.filter(c => !c.parentId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Məsələn: "Çantalar"-ı "Dəri Aksesuarlar" altında saxlamaq üçün burada "Dəri Aksesuarlar"-ı seçin.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleAddCategory}
                  className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Kateqoriya əlavə et
                </button>
              </div>
            )}

            {showEditCategory && editingCategory && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Kateqoriyanı Redaktə Et</h3>
                  <button onClick={() => {
                    setShowEditCategory(false);
                    setEditingCategory(null);
                  }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (Az) *</label>
                    <input
                      type="text"
                      placeholder="Kateqoriyanın adı"
                      value={editingCategory.nameAz || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, nameAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (Ru)</label>
                    <input
                      type="text"
                      placeholder="Название категории"
                      value={editingCategory.nameRu || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, nameRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kateqoriyanın adı (En)</label>
                    <input
                      type="text"
                      placeholder="Category name"
                      value={editingCategory.nameEn || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, nameEn: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ana kateqoriya <span className="text-gray-400 font-normal">(seçim — alt-kateqoriya yaratmaq üçün)</span>
                    </label>
                    <select
                      value={editingCategory.parentId || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, parentId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      data-testid="edit-category-parent-select"
                    >
                      <option value="">— Yoxdur (ana kateqoriya) —</option>
                      {categories.filter(c => !c.parentId && c.id !== editingCategory.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleUpdateCategory}
                  className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Kateqoriyanı Yenilə
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Kateqoriya yoxdur</p>
                </div>
              ) : (
                categories.map((category) => {
                  const parent = (category as any).parentId
                    ? categories.find(c => c.id === (category as any).parentId)
                    : null;
                  return (
                  <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <div className="flex-1">
                      {parent && (
                        <span className="inline-block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
                          ↳ {parent.name} altında
                        </span>
                      )}
                      <span className="font-medium text-gray-900 block">{category.name}</span>
                      {category.nameAz && category.nameRu && (
                        <span className="text-xs text-gray-500 mt-1 block">
                          Az: {category.nameAz} | Ru: {category.nameRu} {category.nameEn ? `| En: ${category.nameEn}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCategory(category);
                          setShowEditCategory(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'blogs' && (
          <PasswordProtectedSection sectionName="blogs">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Bloq Yazıları ({blogs.length})</h2>
              <button
                onClick={() => setShowAddBlog(!showAddBlog)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus className="h-5 w-5" />
                Yazı əlavə et
              </button>
            </div>

            {showAddBlog && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Yeni Bloq Yazısı</h3>
                  <button onClick={() => setShowAddBlog(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (Az) *</label>
                    <input
                      type="text"
                      value={newBlog.titleAz}
                      onChange={(e) => setNewBlog({ ...newBlog, titleAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Başlıq"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (Ru)</label>
                    <input
                      type="text"
                      value={newBlog.titleRu}
                      onChange={(e) => setNewBlog({ ...newBlog, titleRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Заголовок"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mətn (Az) *</label>
                    <textarea
                      value={newBlog.contentAz}
                      onChange={(e) => setNewBlog({ ...newBlog, contentAz: e.target.value })}
                      rows={5}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Mətn"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mətn (Ru)</label>
                    <textarea
                      value={newBlog.contentRu}
                      onChange={(e) => setNewBlog({ ...newBlog, contentRu: e.target.value })}
                      rows={5}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Текст"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Şəkil URL *</label>
                    <input
                      type="text"
                      value={newBlog.image}
                      onChange={(e) => setNewBlog({ ...newBlog, image: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddBlog}
                  className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Yazı əlavə et
                </button>
              </div>
            )}

            {/* Blog Düzəliş Formu */}
            {showEditBlog && editingBlog && (
              <div className="bg-blue-50 rounded-xl p-6 mb-6 border border-blue-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Bloq Yazısını Düzəlt</h3>
                  <button onClick={() => { setShowEditBlog(false); setEditingBlog(null); setNewBlog({ titleAz: '', titleRu: '', contentAz: '', contentRu: '', image: '' }); }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (AZ) *</label>
                    <input
                      type="text"
                      value={newBlog.titleAz}
                      onChange={(e) => setNewBlog({ ...newBlog, titleAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (RU)</label>
                    <input
                      type="text"
                      value={newBlog.titleRu}
                      onChange={(e) => setNewBlog({ ...newBlog, titleRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mətn (AZ) *</label>
                    <textarea
                      value={newBlog.contentAz}
                      onChange={(e) => setNewBlog({ ...newBlog, contentAz: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mətn (RU)</label>
                    <textarea
                      value={newBlog.contentRu}
                      onChange={(e) => setNewBlog({ ...newBlog, contentRu: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Şəkil URL *</label>
                    <input
                      type="text"
                      value={newBlog.image}
                      onChange={(e) => setNewBlog({ ...newBlog, image: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleUpdateBlog}
                  className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Yadda saxla
                </button>
              </div>
            )}

            <div className="grid gap-4">
              {blogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Bloq yazısı yoxdur</p>
                </div>
              ) : (
                blogs.map((blog) => (
                  <div key={blog.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <img src={blog.image} alt={blog.title.az} className="w-24 h-24 object-cover rounded-lg" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{blog.title.az}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{blog.content.az}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditBlog(blog)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBlog(blog.id!)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'partners' && (
          <PasswordProtectedSection sectionName="partners">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Tərəfdaşlar ({partners.length})</h2>
              <button
                onClick={() => setShowAddPartner(!showAddPartner)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus className="h-5 w-5" />
                Tərəfdaş əlavə et
              </button>
            </div>

            {showAddPartner && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Yeni Tərəfdaş</h3>
                  <button onClick={() => setShowAddPartner(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad *</label>
                    <input
                      type="text"
                      value={newPartner.name}
                      onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Tərəfdaşın adı"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL *</label>
                    <input
                      type="text"
                      value={newPartner.logo}
                      onChange={(e) => setNewPartner({ ...newPartner, logo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="https://example.com/logo.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vebsayt</label>
                    <input
                      type="text"
                      value={newPartner.website}
                      onChange={(e) => setNewPartner({ ...newPartner, website: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddPartner}
                  className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  Tərəfdaş əlavə et
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Tərəfdaş yoxdur</p>
                </div>
              ) : (
                partners.map((partner) => (
                  <div key={partner.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <div className="flex items-center gap-3">
                      <img src={partner.logo} alt={partner.name} className="w-12 h-12 object-contain rounded" />
                      <div>
                        <p className="font-medium text-gray-900">{partner.name}</p>
                        {partner.website && (
                          <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-700">
                            {partner.website}
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePartner(partner.id!)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {false && activeTab === 'about' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Haqqımızda Bölməsi</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (Az) *</label>
                  <input
                    type="text"
                    value={aboutData.titleAz}
                    onChange={(e) => setAboutData({ ...aboutData, titleAz: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Başlıq"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq (Ru)</label>
                  <input
                    type="text"
                    value={aboutData.titleRu}
                    onChange={(e) => setAboutData({ ...aboutData, titleRu: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Заголовок"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Məzmun (Az) *</label>
                <textarea
                  value={aboutData.contentAz}
                  onChange={(e) => setAboutData({ ...aboutData, contentAz: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Şirkət haqqında mətn"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Məzmun (Ru)</label>
                <textarea
                  value={aboutData.contentRu}
                  onChange={(e) => setAboutData({ ...aboutData, contentRu: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="О компании"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Missiya (Az)</label>
                  <textarea
                    value={aboutData.missionAz}
                    onChange={(e) => setAboutData({ ...aboutData, missionAz: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Missiyamız"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Missiya (Ru)</label>
                  <textarea
                    value={aboutData.missionRu}
                    onChange={(e) => setAboutData({ ...aboutData, missionRu: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Наша миссия"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vizyon (Az)</label>
                  <textarea
                    value={aboutData.visionAz}
                    onChange={(e) => setAboutData({ ...aboutData, visionAz: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Vizyonumuz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vizyon (Ru)</label>
                  <textarea
                    value={aboutData.visionRu}
                    onChange={(e) => setAboutData({ ...aboutData, visionRu: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Наше видение"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveAbout}
                className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
              >
                Yadda saxla
              </button>
            </div>
          </div>
        )}

        {false && activeTab === 'contact' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Əlaqə Məlumatları</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon *</label>
                  <input
                    type="text"
                    value={contactData.phone}
                    onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="+994 XX XXX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="info@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ünvan (Az)</label>
                  <textarea
                    value={contactData.addressAz}
                    onChange={(e) => setContactData({ ...contactData, addressAz: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Ünvan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ünvan (Ru)</label>
                  <textarea
                    value={contactData.addressRu}
                    onChange={(e) => setContactData({ ...contactData, addressRu: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Адрес"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İş Saatları (Az)</label>
                  <input
                    type="text"
                    value={contactData.workingHoursAz}
                    onChange={(e) => setContactData({ ...contactData, workingHoursAz: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="B.e - Cümə: 09:00 - 18:00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İş Saatları (Ru)</label>
                  <input
                    type="text"
                    value={contactData.workingHoursRu}
                    onChange={(e) => setContactData({ ...contactData, workingHoursRu: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Пн - Пт: 09:00 - 18:00"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveContact}
                className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
              >
                Yadda saxla
              </button>
            </div>
          </div>
        )}

        {activeTab === 'b2b' && (
          <PasswordProtectedSection sectionName="b2b">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Yeni B2B İstifadəçi Yarat</h2>
              </div>

              {!showAddB2BUser ? (
                <button
                  onClick={() => setShowAddB2BUser(true)}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="h-5 w-5" />
                  B2B İstifadəçi Əlavə Et
                </button>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Yeni B2B İstifadəçi</h3>
                    <button onClick={() => setShowAddB2BUser(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={newB2BUser.email}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Şifrə *</label>
                      <input
                        type="password"
                        value={newB2BUser.password}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, password: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ad *</label>
                      <input
                        type="text"
                        value={newB2BUser.name}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Soyad</label>
                      <input
                        type="text"
                        value={newB2BUser.surname}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, surname: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                      <input
                        type="text"
                        value={newB2BUser.phone}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, phone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Şirkət *</label>
                      <input
                        type="text"
                        value={newB2BUser.companyName}
                        onChange={(e) => setNewB2BUser({ ...newB2BUser, companyName: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddB2BUser}
                    className="mt-6 w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                  >
                    B2B İstifadəçi Yarat
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">B2B Müraciətləri ({b2bRequests.filter(r => r.status === 'pending').length})</h2>

              <div className="space-y-4">
                {b2bRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Yeni müraciət yoxdur</p>
                  </div>
                ) : (
                  b2bRequests
                    .filter((req) => req.status === 'pending')
                    .map((request) => (
                      <div key={request.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {request.first_name} {request.last_name}
                            </h3>
                            <p className="text-sm text-gray-600">{request.company_name}</p>
                          </div>
                          <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Gözləyir
                          </span>
                        </div>
                        <div className="space-y-1 mb-4">
                          <p className="text-sm text-gray-600">Email: {request.email}</p>
                          <p className="text-sm text-gray-600">Telefon: {request.phone}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveB2B(request.id, request)}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium"
                          >
                            Təsdiq et
                          </button>
                          <button
                            onClick={() => handleRejectB2B(request.id)}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium"
                          >
                            Rədd et
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Aktiv B2B Şirkətləri ({users.filter(u => u.role === 'b2b').length})</h2>

              <div className="space-y-3">
                {users.filter(u => u.role === 'b2b').length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Təsdiq edilmiş B2B şirkəti yoxdur</p>
                  </div>
                ) : (
                  users.filter(u => u.role === 'b2b').map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user.name} {user.surname}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                        {user.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'Aktiv' : 'Deaktiv'}
                        </span>
                        <button
                          onClick={() => handleToggleB2BStatus(user.id, user.status || 'active')}
                          className={`px-4 py-2 text-sm rounded-lg font-medium ${
                            user.status === 'active'
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {user.status === 'active' ? 'Deaktiv et' : 'Aktiv et'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, `${user.name} ${user.surname}`)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'customerOrders' && (
          <PasswordProtectedSection
            sectionName="customerOrders"
            onUnlock={acknowledgeCustomerOrders}
          >
            <CustomerOrdersTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'epointSettings' && (
          <PasswordProtectedSection sectionName="epointSettings">
            <EpointSettingsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'deliveryMethods' && (
          <PasswordProtectedSection sectionName="deliveryMethods">
            <DeliveryMethodsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'analytics' && (
          <PasswordProtectedSection sectionName="analytics">
            <AnalyticsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'reviews' && (
          <PasswordProtectedSection sectionName="reviews">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <ReviewsTab />
            </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'aiKnowledge' && (
          <PasswordProtectedSection sectionName="aiKnowledge">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <AiKnowledgeTab />
            </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'b2bOrders' && (
          <PasswordProtectedSection
            sectionName="b2bOrders"
            onUnlock={acknowledgeB2bOrders}
          >
            <B2BOrdersTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'promoCodes' && (
          <PasswordProtectedSection sectionName="promoCodes">
            <PromoCodesTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'banners' && (
          <PasswordProtectedSection sectionName="banners">
            <BannerManagementTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'productBanners' && (
          <PasswordProtectedSection sectionName="productBanners">
            <ProductBannersTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'homeSections' && (
          <PasswordProtectedSection sectionName="homeSections">
            <HomeSectionsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'about' && (
          <PasswordProtectedSection sectionName="about">
            <AboutManagementTab />
          </PasswordProtectedSection>
        )}
        {activeTab === 'privacy' && (
          <PasswordProtectedSection sectionName="privacy">
            <PrivacyPolicyTab />
          </PasswordProtectedSection>
        )}
        {activeTab === 'return' && (
          <PasswordProtectedSection sectionName="return">
            <ReturnPolicyTab />
          </PasswordProtectedSection>
        )}
        {activeTab === 'delivery' && (
          <PasswordProtectedSection sectionName="delivery">
            <DeliveryPolicyTab />
          </PasswordProtectedSection>
        )}
        {activeTab === 'careers' && (
          <PasswordProtectedSection sectionName="careers">
            <CareersTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'contactMessages' && (
          <PasswordProtectedSection sectionName="contactMessages">
            <ContactMessagesTab />
          </PasswordProtectedSection>
        )}
        {activeTab === 'workers' && (
          <PasswordProtectedSection sectionName="workers">
            <WorkersTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'siteSettings' && (
          <PasswordProtectedSection sectionName="siteSettings">
            <SiteSettingsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'passwords' && (
          <PasswordProtectedSection sectionName="passwordsAdmin">
            <PasswordsManagementTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'b2bNotifications' && (
          <PasswordProtectedSection sectionName="b2bNotifications">
            <B2BNotificationsTab />
          </PasswordProtectedSection>
        )}

        {activeTab === 'b2bUsers' && (
          <PasswordProtectedSection sectionName="b2bUsers">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">B2B İstifadəçilər ({users.filter(u => u.role === 'b2b').length})</h2>

            <div className="space-y-4">
              {users.filter(u => u.role === 'b2b').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>B2B istifadəçi yoxdur</p>
                </div>
              ) : (
                users.filter(u => u.role === 'b2b').map((user) => (
                  <div key={user.id} className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user.name} {user.surname}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                        {user.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
                        {user.companyName && (
                          <p className="text-sm text-blue-600 font-medium mt-1">
                            Şirkət: {user.companyName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteUser(user.id, `${user.name} ${user.surname}`)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="bg-white p-4 rounded-lg space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Endirim Faizi (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={user.discountPercentage || 0}
                            id={`discount-${user.id}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Endirim Növü
                          </label>
                          <select
                            defaultValue={user.discountUsageType || 'unlimited'}
                            id={`discount-type-${user.id}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                          >
                            <option value="unlimited">Limitsiz</option>
                            <option value="once">Bir dəfəlik</option>
                            <option value="time_limited">Müddətli</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bitmə Tarixi (yalnız müddətli endirim üçün)
                        </label>
                        <input
                          type="datetime-local"
                          defaultValue={user.discountExpiresAt ? new Date(user.discountExpiresAt).toISOString().slice(0, 16) : ''}
                          id={`discount-expires-${user.id}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                        />
                      </div>

                      {user.discountUsed && user.discountUsageType === 'once' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 font-medium">
                            ⚠️ Bu istifadəçi bir dəfəlik endirimi artıq istifadə edib
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const discount = parseFloat((document.getElementById(`discount-${user.id}`) as HTMLInputElement)?.value || '0');
                          const discountType = (document.getElementById(`discount-type-${user.id}`) as HTMLSelectElement)?.value || 'unlimited';
                          const expiresAt = (document.getElementById(`discount-expires-${user.id}`) as HTMLInputElement)?.value || null;

                          if (discount >= 0 && discount <= 100) {
                            userService.updateUserDiscount(user.id, discount, discountType, expiresAt)
                              .then(() => {
                                loadData();
                                alert('Endirim parametrləri yeniləndi!');
                              })
                              .catch((error) => {
                                console.error('Error updating discount:', error);
                                alert('Xəta baş verdi');
                              });
                          } else {
                            alert('Endirim faizi 0-100 arası olmalıdır');
                          }
                        }}
                        className="w-full bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Yadda Saxla
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}

        {activeTab === 'users' && (
          <PasswordProtectedSection sectionName="users">

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">İstifadəçilər ({users.filter(u => u.role !== 'b2b').length})</h2>

            <div className="space-y-3">
              {users.filter(u => u.role !== 'b2b').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>İstifadəçi yoxdur</p>
                </div>
              ) : (
                users.filter(u => u.role !== 'b2b').map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {user.name} {user.surname}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                      {user.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' ? 'bg-gray-900 text-white' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Müştəri'}
                      </span>
                      <button
                        onClick={() => handleToggleAdmin(
                          user.id,
                          `${user.name} ${user.surname}`,
                          user.role === 'admin' ? 'customer' : 'admin'
                        )}
                        title={user.role === 'admin' ? 'Adminliyi geri al' : 'Admin et'}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-all"
                        data-testid={`toggle-admin-${user.id}`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, `${user.name} ${user.surname}`)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </PasswordProtectedSection>
        )}
      </div>

      {/* Admin role toggle modal */}
      <AdminToggleModal
        open={!!adminToggleTarget}
        userName={adminToggleTarget?.userName || ''}
        newRole={adminToggleTarget?.newRole || 'customer'}
        onClose={() => setAdminToggleTarget(null)}
        onConfirm={confirmAdminToggle}
      />

      {/* Delete user confirm modal */}
      <ConfirmModal
        open={!!deleteUserTarget}
        title="İstifadəçini sil"
        message={`${deleteUserTarget?.userName || ''} istifadəçisini silmək istədiyinizə əminsiniz?\n\nBu əməliyyat geri qaytarıla bilməz.`}
        confirmLabel="Sil"
        variant="danger"
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={confirmDeleteUser}
      />

      {/* In-app toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[110] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-4 ${
            toast.tone === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
          data-testid="admin-toast"
        >
          <ShieldCheck className={`h-4 w-4 ${toast.tone === 'success' ? 'text-emerald-400' : 'text-white'}`} />
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
