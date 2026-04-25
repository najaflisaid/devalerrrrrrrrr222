import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

const PartnersPage: React.FC = () => {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'partners'));
      const partnersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Partner[];
      setPartners(partnersData);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    t('partners.benefit1'),
    t('partners.benefit2'),
    t('partners.benefit3'),
    t('partners.benefit4')
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <h1 className="font-playfair text-3xl md:text-4xl font-light text-black tracking-tight leading-none">
            {t('partners.pageTitle')}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="hidden md:inline-block w-8 h-[1px] flex-shrink-0" style={{ background: '#D4AF37' }} />
            <p className="text-gray-500 text-sm font-light leading-snug">
              {t('partners.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="font-playfair text-3xl md:text-4xl mb-4">{t('partners.ourBrands')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t('partners.brandsDescription')}
          </p>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('common.noProductsFound')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 mb-20">
            {partners.map((partner) => (
              <a
                key={partner.id}
                href={partner.website || '#'}
                target={partner.website ? '_blank' : undefined}
                rel={partner.website ? 'noopener noreferrer' : undefined}
                className="group bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                  {partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-gray-900 font-semibold text-center text-sm">
                      {partner.name}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="bg-gray-50 rounded-2xl p-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-playfair text-3xl text-center mb-8">{t('partners.whyUs')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 bg-gray-900 text-white rounded-2xl p-12 text-center">
          <h2 className="font-playfair text-3xl mb-4">{t('partners.b2bTitle')}</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            {t('partners.b2bDescription')}
          </p>
          <a
            href="/b2b-login"
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {t('partners.b2bButton')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PartnersPage;
