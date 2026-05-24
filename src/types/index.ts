export interface Product {
  id: string;
  name: {
    az: string;
    ru: string;
    en: string;
  };
  description: {
    az: string;
    ru: string;
    en: string;
  };
  price: number;
  salePrice?: number;
  b2bPrice?: number;
  b2bSalePrice?: number;
  images: string[];
  category: string;
  brand: string;
  gender: 'men' | 'women' | 'unisex';
  isEnabled: boolean;
  isBestseller?: boolean;
  isGiftCard?: boolean;
  comingSoon?: boolean;
  stock: number;
  visibleTo?: 'all' | 'b2b' | 'customer';
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone?: string;
  role: 'customer' | 'b2b' | 'admin';
  status?: 'active' | 'inactive';
  isB2BApproved?: boolean;
  createdAt: Date;
}

export interface B2BRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
}

export interface Category {
  id: string;
  name: {
    az: string;
    ru: string;
  };
}

export interface Brand {
  id: string;
  name: string;
  logo?: string;
  categoryNames?: string[];
  createdAt?: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  };
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt: Date;
  userId?: string;
}