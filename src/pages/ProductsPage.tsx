import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';
import { productService } from '../services/productService';
import type { Product } from '../types';

const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [currentMinPrice, setCurrentMinPrice] = useState<number>(0);
  const [currentMaxPrice, setCurrentMaxPrice] = useState<number>(1000);
  const [priceInitialized, setPriceInitialized] = useState(false);
  const [comingSoonFilter, setComingSoonFilter] = useState<string>('all');
  const [discountFilter, setDiscountFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [isB2BUser, setIsB2BUser] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [columnsPerRow, setColumnsPerRow] = useState<number>(3);
  // Show the bottom-left floating filter button only when the inline top
  // filter button is scrolled out of view (mobile only).
  const [showFloatingFilter, setShowFloatingFilter] = useState(false);

  useEffect(() => {
    const handle = () => {
      // Top inline filter button sits roughly within first ~200px of the page
      setShowFloatingFilter(window.scrollY > 240);
    };
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // Function to update URL with all current filters
  const updateURLParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    setSearchParams(newParams, { replace: true });
  };

  // Function to clear search when filter is selected
  const clearSearchOnFilterChange = () => {
    if (searchQuery) {
      setSearchQuery('');
    }
  };

  // Scroll products list back to top when any filter changes
  // Also close filter drawer on mobile so user immediately sees the filtered products
  const scrollToTop = () => {
    // Close mobile filter panel after selection
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsFilterOpen(false);
    }
    // Scroll window to top — use requestAnimationFrame to ensure DOM update first
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
      // Fallback for some mobile browsers
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  };

  // Handler for category change - auto-resets incompatible brand/gender so products are always visible
  const handleCategoryChange = (category: string) => {
    clearSearchOnFilterChange();
    setSelectedCategory(category);
    // Clear discount filter when category is selected
    setDiscountFilter('all');

    const updates: Record<string, string | null> = {
      category: category === 'all' ? null : category,
      search: null,
      discount: null,
    };

    if (category !== 'all') {
      // If current brand has no product in this category → reset brand
      if (selectedBrand !== 'all') {
        const brandMatches = products.some(
          (p) => p.category === category && p.brand === selectedBrand
        );
        if (!brandMatches) {
          setSelectedBrand('all');
          updates.brand = null;
        }
      }
      // If current gender has no product in this category → reset gender
      if (selectedGender !== 'all') {
        const genderMatches = products.some(
          (p) => p.category === category && p.gender === selectedGender
        );
        if (!genderMatches) {
          setSelectedGender('all');
          updates.gender = null;
        }
      }
    }

    updateURLParams(updates);
    scrollToTop();
  };

  // Handler for brand change - auto-resets incompatible category/gender so products are always visible
  const handleBrandChange = (brand: string) => {
    clearSearchOnFilterChange();
    setSelectedBrand(brand);
    setDiscountFilter('all');

    const updates: Record<string, string | null> = {
      brand: brand === 'all' ? null : brand,
      search: null,
      discount: null,
    };

    if (brand !== 'all') {
      // If current category has no product in this brand → reset category
      if (selectedCategory !== 'all') {
        const categoryMatches = products.some(
          (p) => p.brand === brand && p.category === selectedCategory
        );
        if (!categoryMatches) {
          setSelectedCategory('all');
          updates.category = null;
        }
      }
      // If current gender has no product in this brand → reset gender
      if (selectedGender !== 'all') {
        const genderMatches = products.some(
          (p) => p.brand === brand && p.gender === selectedGender
        );
        if (!genderMatches) {
          setSelectedGender('all');
          updates.gender = null;
        }
      }
    }

    updateURLParams(updates);
    scrollToTop();
  };

  // Handler for gender change - auto-resets incompatible category/brand so products are always visible
  const handleGenderChange = (gender: string) => {
    clearSearchOnFilterChange();
    setSelectedGender(gender);
    setDiscountFilter('all');

    const updates: Record<string, string | null> = {
      gender: gender === 'all' ? null : gender,
      search: null,
      discount: null,
    };

    if (gender !== 'all') {
      // If current category has no product for this gender → reset category
      if (selectedCategory !== 'all') {
        const categoryMatches = products.some(
          (p) => p.gender === gender && p.category === selectedCategory
        );
        if (!categoryMatches) {
          setSelectedCategory('all');
          updates.category = null;
        }
      }
      // If current brand has no product for this gender → reset brand
      if (selectedBrand !== 'all') {
        const brandMatches = products.some(
          (p) => p.gender === gender && p.brand === selectedBrand
        );
        if (!brandMatches) {
          setSelectedBrand('all');
          updates.brand = null;
        }
      }
    }

    updateURLParams(updates);
    scrollToTop();
  };

  // Handler for discount filter change - clears all filters and updates URL
  const handleDiscountFilterChange = (checked: boolean) => {
    clearSearchOnFilterChange();
    const value = checked ? 'discounted' : 'all';
    setDiscountFilter(value);
    
    // When discount filter is enabled, reset all other filters to "All"
    if (checked) {
      setSelectedCategory('all');
      setSelectedBrand('all');
      setSelectedGender('all');
      setCurrentMinPrice(minPrice);
      setCurrentMaxPrice(maxPrice);
      setComingSoonFilter('all');
      setStockFilter('all');
      // Clear all params and set only discount
      const newParams = new URLSearchParams();
      newParams.set('discount', 'true');
      setSearchParams(newParams, { replace: true });
    } else {
      updateURLParams({ 
        discount: null,
        search: null 
      });
    }
    scrollToTop();
  };

  // Handler for coming soon filter change - clears search and updates URL
  const handleComingSoonFilterChange = (checked: boolean) => {
    clearSearchOnFilterChange();
    const value = checked ? 'comingSoon' : 'all';
    setComingSoonFilter(value);
    updateURLParams({ 
      comingSoon: checked ? 'true' : null,
      search: null 
    });
    scrollToTop();
  };

  // Handler for sort change - updates URL
  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    updateURLParams({ sort: sort === 'name-asc' ? null : sort });
  };

  // Update URL when price changes (with slight delay to avoid too many updates)
  useEffect(() => {
    if (!priceInitialized) return;
    
    const timer = setTimeout(() => {
      const minChanged = currentMinPrice !== minPrice;
      const maxChanged = currentMaxPrice !== maxPrice;
      
      updateURLParams({
        minPrice: minChanged ? currentMinPrice.toString() : null,
        maxPrice: maxChanged ? currentMaxPrice.toString() : null
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [currentMinPrice, currentMaxPrice, priceInitialized]);

  // Read filters from URL on mount and when URL changes
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    setIsB2BUser(userRole === 'b2b' || userRole === 'admin');

    // Read search parameter
    const search = searchParams.get('search');
    setSearchQuery(search || '');

    // Read category parameter
    const category = searchParams.get('category');
    setSelectedCategory(category || 'all');

    // Read brand parameter
    const brand = searchParams.get('brand');
    setSelectedBrand(brand || 'all');

    // Read gender parameter
    const gender = searchParams.get('gender');
    setSelectedGender(gender || 'all');

    // Read discount parameter
    const discount = searchParams.get('discount');
    setDiscountFilter(discount === 'true' ? 'discounted' : 'all');

    // Read comingSoon parameter
    const comingSoon = searchParams.get('comingSoon');
    setComingSoonFilter(comingSoon === 'true' ? 'comingSoon' : 'all');

    // Read sort parameter
    const sort = searchParams.get('sort');
    setSortBy(sort || 'name-asc');
  }, [searchParams]);

  // Load products only on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Read price params after products are loaded
  useEffect(() => {
    if (products.length > 0 && !priceInitialized) {
      const prices = products
        .map(p => {
          if (isB2BUser) {
            return p.b2bSalePrice || p.b2bPrice || p.salePrice || p.price;
          }
          return p.salePrice || p.price;
        })
        .filter(price => typeof price === 'number' && price > 0);

      const min = prices.length > 0 ? Math.max(0, Math.floor(Math.min(...prices))) : 0;
      const max = prices.length > 0 ? Math.max(min, Math.ceil(Math.max(...prices))) : 1000;
      setMinPrice(min);
      setMaxPrice(max);

      // Read price params from URL or use defaults
      const urlMinPrice = searchParams.get('minPrice');
      const urlMaxPrice = searchParams.get('maxPrice');
      
      setCurrentMinPrice(urlMinPrice ? Number(urlMinPrice) : min);
      setCurrentMaxPrice(urlMaxPrice ? Number(urlMaxPrice) : max);
      
      setPriceInitialized(true);
    }
  }, [products, isB2BUser, priceInitialized, searchParams]);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, selectedBrand, selectedGender, currentMinPrice, currentMaxPrice, comingSoonFilter, discountFilter, stockFilter, searchQuery, sortBy]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const nameAz = typeof p.name === 'object' ? p.name.az : p.name;
        const nameRu = typeof p.name === 'object' ? p.name.ru : '';
        const nameEn = typeof p.name === 'object' ? p.name.en : '';
        const descAz = typeof p.description === 'object' ? p.description.az : p.description;
        const descRu = typeof p.description === 'object' ? p.description.ru : '';
        const descEn = typeof p.description === 'object' ? p.description.en : '';

        return nameAz?.toLowerCase().includes(query) ||
          nameRu?.toLowerCase().includes(query) ||
          nameEn?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query) ||
          descAz?.toLowerCase().includes(query) ||
          descRu?.toLowerCase().includes(query) ||
          descEn?.toLowerCase().includes(query);
      });
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (selectedBrand !== 'all') {
      filtered = filtered.filter(p => p.brand === selectedBrand);
    }

    if (selectedGender !== 'all') {
      filtered = filtered.filter(p => p.gender === selectedGender);
    }

    filtered = filtered.filter(p => {
      const productPrice = isB2BUser
        ? (p.b2bSalePrice || p.b2bPrice || p.salePrice || p.price)
        : (p.salePrice || p.price);
      return productPrice >= currentMinPrice && productPrice <= currentMaxPrice;
    });

    if (comingSoonFilter === 'comingSoon') {
      filtered = filtered.filter(p => p.comingSoon === true);
    } else {
      filtered = filtered.filter(p => p.comingSoon !== true);
    }

    if (discountFilter === 'discounted') {
      filtered = filtered.filter(p => {
        if (isB2BUser) {
          return p.b2bSalePrice && p.b2bSalePrice < (p.b2bPrice || p.price);
        } else {
          return p.salePrice && p.salePrice < p.price;
        }
      });
    }

    // Stock filter - only for B2B users
    if (stockFilter === 'inStock') {
      filtered = filtered.filter(p => p.stock > 0);
    }

    filtered.sort((a, b) => {
      const getProductName = (p: Product) => {
        return typeof p.name === 'object' ? p.name.az || p.name.ru || p.name.en : p.name;
      };

      const getProductPrice = (p: Product) => {
        return isB2BUser
          ? (p.b2bSalePrice || p.b2bPrice || p.salePrice || p.price)
          : (p.salePrice || p.price);
      };

      switch (sortBy) {
        case 'name-asc':
          return getProductName(a).localeCompare(getProductName(b));
        case 'name-desc':
          return getProductName(b).localeCompare(getProductName(a));
        case 'brand-asc':
          return (a.brand || '').localeCompare(b.brand || '');
        case 'brand-desc':
          return (b.brand || '').localeCompare(a.brand || '');
        case 'price-asc':
          return getProductPrice(a) - getProductPrice(b);
        case 'price-desc':
          return getProductPrice(b) - getProductPrice(a);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const brands = ['all', ...Array.from(new Set(products.map(p => p.brand)))];

  // Count of currently-active filters (anything that narrows results from "all")
  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedBrand !== 'all' ? 1 : 0) +
    (selectedGender !== 'all' ? 1 : 0) +
    (discountFilter === 'discounted' ? 1 : 0) +
    (comingSoonFilter === 'comingSoon' ? 1 : 0) +
    (stockFilter === 'inStock' ? 1 : 0) +
    (priceInitialized && (currentMinPrice !== minPrice || currentMaxPrice !== maxPrice) ? 1 : 0) +
    (searchQuery ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Floating filter button (mobile only) — appears when scrolled past top inline button */}
      <button
        onClick={() => {
          setIsFilterOpen((open) => !open);
          if (!isFilterOpen) {
            // When opening, scroll to top so filters are immediately visible
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        aria-label={isFilterOpen ? t('common.closeFilters') : t('common.filter')}
        data-testid="mobile-floating-filter-btn"
        className={`lg:hidden fixed bottom-5 left-5 z-[9997] flex items-center gap-1.5 pl-2.5 pr-3 py-2 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.3)] border border-amber-400/20 active:scale-95 transition-all duration-300 ${
          showFloatingFilter
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <Filter className="h-4 w-4" />
        <span className="text-[11px] font-semibold tracking-wide">
          {isFilterOpen ? t('common.closeFilters') : t('common.filter')}
        </span>
        {activeFilterCount > 0 && !isFilterOpen && (
          <span
            className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[#D4AF37] text-gray-900 text-[10px] font-bold rounded-full"
            data-testid="mobile-floating-filter-count"
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Filter className="h-5 w-5" />
            <span>{isFilterOpen ? t('common.closeFilters') : t('common.filter')}</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className={`lg:col-span-1 ${isFilterOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-24 bg-gray-50 rounded-lg p-6 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="h-5 w-5" />
                <h2 className="font-semibold text-lg">{t('common.filter')}</h2>
              </div>

              <div>
                <h3 className="font-medium mb-3">{t('common.priceRange')}</h3>
                <div className="space-y-3">
                  <div className="relative pt-2 pb-2">
                    <div className="relative h-2 bg-gray-200 rounded-lg">
                      <div
                        className="absolute h-2 bg-gray-900 rounded-lg"
                        style={{
                          left: `${((currentMinPrice - minPrice) / (maxPrice - minPrice)) * 100}%`,
                          right: `${100 - ((currentMaxPrice - minPrice) / (maxPrice - minPrice)) * 100}%`
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      value={currentMinPrice}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value < currentMaxPrice) {
                          setCurrentMinPrice(value);
                        }
                      }}
                      className="absolute w-full h-2 top-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:bg-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md"
                    />
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      value={currentMaxPrice}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value > currentMinPrice) {
                          setCurrentMaxPrice(value);
                        }
                      }}
                      className="absolute w-full h-2 top-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:bg-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md"
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-gray-900">{currentMinPrice}₼</span>
                    <span className="text-gray-400">-</span>
                    <span className="font-semibold text-gray-900">{currentMaxPrice}₼</span>
                  </div>
                </div>
              </div>

              {/* Stock Filter - Only for B2B users */}
              {isB2BUser && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium mb-3">Stok</h3>
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="stock"
                        value="all"
                        checked={stockFilter === 'all'}
                        onChange={() => { setStockFilter('all'); scrollToTop(); }}
                        className="mr-2"
                      />
                      <span className="text-sm">{t('common.all')}</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="stock"
                        value="inStock"
                        checked={stockFilter === 'inStock'}
                        onChange={() => { setStockFilter('inStock'); scrollToTop(); }}
                        className="mr-2"
                      />
                      <span className="text-sm">Mövcud məhsullar</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium mb-3">{t('product.category')}</h3>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <label key={category} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        value={category}
                        checked={selectedCategory === category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">
                        {category === 'all' ? t('common.all') : category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium mb-3">{t('product.brand')}</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {brands.map((brand) => (
                    <label key={brand} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="brand"
                        value={brand}
                        checked={selectedBrand === brand}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {brand === 'all' ? t('common.all') : brand}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium mb-3">{t('category.filterByGender')}</h3>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="all"
                      checked={selectedGender === 'all'}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('common.all')}</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="men"
                      checked={selectedGender === 'men'}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('category.men')}</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="women"
                      checked={selectedGender === 'women'}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('category.women')}</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="unisex"
                      checked={selectedGender === 'unisex'}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('category.unisex')}</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountFilter === 'discounted'}
                    onChange={(e) => handleDiscountFilterChange(e.target.checked)}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-red-600">{t('common.discountedProducts')}</span>
                </label>
              </div>

              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedBrand('all');
                  setSelectedGender('all');
                  setCurrentMinPrice(minPrice);
                  setCurrentMaxPrice(maxPrice);
                  setComingSoonFilter('all');
                  setDiscountFilter('all');
                  setSearchQuery('');
                  setSortBy('name-asc');
                  setSearchParams({}, { replace: true });
                  scrollToTop();
                }}
                className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                {t('common.clearFilters')}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {searchQuery && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-blue-800">
                  <strong>"{searchQuery}"</strong> {t('common.searchResults')}: {filteredProducts.length} {t('common.productCount')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchParams({}, { replace: true });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>✕</span>
                  {t('common.clearSearch')}
                </button>
              </div>
            )}

            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-gray-600">
                {filteredProducts.length} {t('common.productsFound')}
              </p>
              <div className="flex items-center gap-4">
                {/* Column selector - only visible on desktop */}
                <div className="hidden lg:flex items-center gap-2">
                  <label className="text-sm text-gray-600">Sıra:</label>
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    {[3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setColumnsPerRow(num)}
                        className={`px-3 py-2 text-sm ${columnsPerRow === num ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Sırala:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  >
                    <option value="name-asc">Ad: A-Z</option>
                    <option value="name-desc">Ad: Z-A</option>
                    <option value="brand-asc">Brend: A-Z</option>
                    <option value="brand-desc">Brend: Z-A</option>
                    <option value="price-asc">Qiymət: Aşağıdan yuxarı</option>
                    <option value="price-desc">Qiymət: Yuxarıdan aşağı</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className={`grid grid-cols-2 gap-4 md:gap-6 ${
                columnsPerRow === 3 ? 'lg:grid-cols-3' : 
                columnsPerRow === 4 ? 'lg:grid-cols-4' : 
                columnsPerRow === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
              }`}>
                {filteredProducts.map((product) => (
                  <Link key={product.id} to={`/product/${product.id}`}>
                    <ProductCard product={product} showB2BPrice={isB2BUser} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-600 text-lg">{t('common.noProductsFound')}</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedBrand('all');
                    setSelectedGender('all');
                    setSearchQuery('');
                    setDiscountFilter('all');
                    setComingSoonFilter('all');
                    setSortBy('name-asc');
                    setCurrentMinPrice(minPrice);
                    setCurrentMaxPrice(maxPrice);
                    setSearchParams({}, { replace: true });
                  }}
                  className="mt-4 text-gray-900 underline hover:no-underline"
                >
                  {t('common.showAllProducts')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
