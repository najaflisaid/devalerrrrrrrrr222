import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

const Partners: React.FC = () => {
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

  if (loading) {
    return null;
  }

  if (partners.length === 0) {
    return null;
  }

  return (
    <section className="py-10 bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-light tracking-wide text-gray-900 mb-2">
            {t('header.partners')}
          </h2>
          <p className="text-base font-semibold text-gray-700">
            {t('partners.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {partners.map((partner) => (
            <a
              key={partner.id}
              href={partner.website || '#'}
              target={partner.website ? '_blank' : undefined}
              rel={partner.website ? 'noopener noreferrer' : undefined}
              className="group bg-white rounded-2xl p-3 hover:shadow-lg transition-all duration-300 flex items-center justify-center border border-gray-200"
            >
              <div className="w-full aspect-square flex items-center justify-center">
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-gray-900 font-semibold text-center text-xs">
                    {partner.name}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Partners;
