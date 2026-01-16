import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';
import { productService } from '../services/productService';
import type { Product } from '../types';

const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [currentMinPrice, setCurrentMinPrice] = useState<number>(0);
  const [currentMaxPrice, setCurrentMaxPrice] = useState<number>(1000);
  const [comingSoonFilter, setComingSoonFilter] = useState<string>('all');
  const [discountFilter, setDiscountFilter] = useState<string>('all');
  const [isB2BUser, setIsB2BUser] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name-asc');

  // Function to clear search when filter is selected
  const clearSearchOnFilterChange = () => {
    if (searchQuery) {
      setSearchQuery('');
      // Remove search param from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('search');
      setSearchParams(newParams, { replace: true });
    }
  };

  // Handler for category change - clears search
  const handleCategoryChange = (category: string) => {
    clearSearchOnFilterChange();
    setSelectedCategory(category);
  };

  // Handler for brand change - clears search
  const handleBrandChange = (brand: string) => {
    clearSearchOnFilterChange();
    setSelectedBrand(brand);
  };

  // Handler for gender change - clears search
  const handleGenderChange = (gender: string) => {
    clearSearchOnFilterChange();
    setSelectedGender(gender);
  };

  // Handler for discount filter change - clears search
  const handleDiscountFilterChange = (checked: boolean) => {
    clearSearchOnFilterChange();
    setDiscountFilter(checked ? 'discounted' : 'all');
  };

  // Handler for coming soon filter change - clears search
  const handleComingSoonFilterChange = (checked: boolean) => {
    clearSearchOnFilterChange();
    setComingSoonFilter(checked ? 'comingSoon' : 'all');
  };

  // Clear filters from localStorage when leaving the page
  useEffect(() => {
    return () => {
      // Clear all filter values from localStorage when component unmounts
      localStorage.removeItem('productFilterCategory');
      localStorage.removeItem('productFilterBrand');
      localStorage.removeItem('productFilterGender');
      localStorage.removeItem('productFilterMinPrice');
      localStorage.removeItem('productFilterMaxPrice');
      localStorage.removeItem('productFilterComingSoon');
      localStorage.removeItem('productFilterDiscount');
      localStorage.removeItem('productFilterSort');
    };
  }, []);

  useEffect(() => {
    loadProducts();
    const userRole = localStorage.getItem('userRole');
    setIsB2BUser(userRole === 'b2b' || userRole === 'admin');

    // Read search parameter
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    } else {
      setSearchQuery('');
    }

    // Read category parameter from URL only
    const category = searchParams.get('category');
    if (category) {
      setSelectedCategory(category);
    } else {
      setSelectedCategory('all');
    }

    // Read brand parameter from URL only
    const brand = searchParams.get('brand');
    if (brand) {
      setSelectedBrand(brand);
    } else {
      setSelectedBrand('all');
    }

    // Reset other filters to defaults
    setSelectedGender('all');
    setComingSoonFilter('all');
    setDiscountFilter('all');
    setSortBy('name-asc');
  }, [searchParams]);

  useEffect(() => {
    if (products.length > 0) {
      const prices = products.map(p => {
        if (isB2BUser) {
          return p.b2bSalePrice || p.b2bPrice || p.salePrice || p.price;
        }
        return p.salePrice || p.price;
      });
      const min = Math.floor(Math.min(...prices));
      const max = Math.ceil(Math.max(...prices));
      setMinPrice(min);
      setMaxPrice(max);
      setCurrentMinPrice(min);
      setCurrentMaxPrice(max);
    }
  }, [products, isB2BUser]);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, selectedBrand, selectedGender, currentMinPrice, currentMaxPrice, comingSoonFilter, discountFilter, searchQuery, sortBy]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-[400px] bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="font-playfair text-5xl md:text-6xl tracking-wide mb-4">
            {t('common.productsTitle')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto px-4">
            {t('common.productsSubtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12"></div>
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
          <div className={`lg:col-span-1 ${
            isFilterOpen ? 'block' : 'hidden lg:block'
          }`}>
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
                        onChange={(e) => setSelectedBrand(e.target.value)}
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
                      onChange={(e) => setSelectedGender(e.target.value)}
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
                      onChange={(e) => setSelectedGender(e.target.value)}
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
                      onChange={(e) => setSelectedGender(e.target.value)}
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
                      onChange={(e) => setSelectedGender(e.target.value)}
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
                    onChange={(e) => setDiscountFilter(e.target.checked ? 'discounted' : 'all')}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-red-600">{t('common.discountedProducts')}</span>
                </label>
              </div>

              {isB2BUser && (
                <div className="border-t border-gray-200 pt-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={comingSoonFilter === 'comingSoon'}
                      onChange={(e) => setComingSoonFilter(e.target.checked ? 'comingSoon' : 'all')}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-blue-600">{t('common.comingSoonProducts')}</span>
                  </label>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedBrand('all');
                  setSelectedGender('all');
                  setCurrentMinPrice(minPrice);
                  setCurrentMaxPrice(maxPrice);
                  setComingSoonFilter('all');
                  setDiscountFilter('all');
                }}
                className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                {t('common.clearFilters')}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {searchQuery && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>"{searchQuery}"</strong> {t('common.searchResults')}: {filteredProducts.length} {t('common.productCount')}
                </p>
              </div>
            )}

            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-gray-600">
                {filteredProducts.length} {t('common.productsFound')}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sırala:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
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

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
