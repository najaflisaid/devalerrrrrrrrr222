import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    loadCategoriesAndBrands();
  }, []);

  const loadCategoriesAndBrands = async () => {
    try {
      const products = await productService.getAll();
      const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).slice(0, 6);
      const uniqueBrands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean).slice(0, 6);
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Error loading categories and brands:', error);
    }
  };

  const getCategoryTranslation = (category: string) => {
    const categoryKey = category.toLowerCase().replace(/\s+/g, '');
    const translationKey = `category.${categoryKey}`;
    const translated = t(translationKey);
    return translated === translationKey ? category : translated;
  };

  return (
    <footer className="bg-white text-gray-900 border-t border-gray-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div>
            <img src="https://customer-assets.emergentagent.com/job_f1f83b6e-f511-4a6e-994f-1249c8d1bae5/artifacts/dcu3bp0c_tmu65g6__1_-removebg-preview.png" alt="De Valeur" className="h-12 mb-4" />
            <p className="text-gray-700 text-sm font-medium mb-3">
              {t('footer.followUs')}
            </p>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/devaleur.az?igsh=MTVsd2Fwd3JvbTE3dA==" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.tiktok.com/@devaleur.az" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 transition-colors" aria-label="TikTok">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t('footer.menu')}</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.home')}
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.products')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.about')}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.blog')}
                </Link>
              </li>
              <li>
                <Link to="/partners" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.partners')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                  {t('header.contact')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t('header.categories')}</h4>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category}>
                  <button
                    onClick={() => navigate(`/products?category=${encodeURIComponent(category)}`)}
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm text-left capitalize"
                  >
                    {getCategoryTranslation(category)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t('header.brands')}</h4>
            <ul className="space-y-2">
              {brands.map((brand) => (
                <li key={brand}>
                  <button
                    onClick={() => navigate(`/products?brand=${encodeURIComponent(brand)}`)}
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm text-left"
                  >
                    {brand}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t('header.contact')}</h4>
            <ul className="space-y-3">
              <li className="flex items-start text-gray-600 text-sm">
                <MapPin className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <a
                  href="https://maps.app.goo.gl/JPzZU7hrHU5BcW587"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors"
                >
                  {t('footer.location')}
                </a>
              </li>
              <li className="flex items-center text-gray-600 text-sm">
                <Phone className="h-5 w-5 mr-2 flex-shrink-0" />
                <a href="tel:+994777577277" className="hover:text-gray-900 transition-colors">
                  {t('contact.phoneNumber')}
                </a>
              </li>
              <li className="flex items-center text-gray-600 text-sm">
                <Mail className="h-5 w-5 mr-2 flex-shrink-0" />
                <a href="mailto:info@devaleur.az" className="hover:text-gray-900 transition-colors">
                  {t('footer.emailAddress')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfXakvFB55U0jCrrGeSSbXuQ1BOmpF2MbkTQZ5fmytaRfHVLdvBQEAL_r-0s3l-jvXY6I&usqp=CAU"
              alt="TamKart"
              className="h-5 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
              title="TamKart"
            />
            <img
              src="https://qarant.az/storage/news/9gxISSjvnBtPO4TaKfOgR2xxVfKPO859ewJ5C4ua.png"
              alt="BirKart"
              className="h-5 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
              title="BirKart"
            />
            <img
              src="https://leobank.az/_next/static/media/card.4a2221fa.svg"
              alt="LeoKart"
              className="h-5 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
              title="LeoKart"
            />
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Visa_2021.svg/1200px-Visa_2021.svg.png"
              alt="Visa"
              className="h-4 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
              title="Visa"
            />
            <img
              src="https://financialit.net/sites/default/files/1609314895logo-mastercard-mobile_1_4.png"
              alt="Mastercard"
              className="h-5 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
              title="Mastercard"
            />
          </div>
          <div className="text-center text-gray-600 text-sm">
            <p>&copy; 2025 De Valeur. {t('footer.allRightsReserved')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
