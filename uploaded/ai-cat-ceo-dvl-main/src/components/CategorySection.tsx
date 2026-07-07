import React from 'react';
import { useTranslation } from 'react-i18next';

const CategorySection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Watches */}
          <div className="group relative overflow-hidden rounded-lg">
            <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200">
              <img 
                src="https://www.rosefieldwatches.com/cdn/shop/files/0013673_octagon-xs-gold-engraved_d1d5b792-1a04-4ecd-a86b-39727a9a698c.jpg?v=1733751886?auto=compress&cs=tinysrgb&w=800"
                alt="Watches"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
              <div className="text-center text-white">
                <h3 className="text-3xl font-light tracking-wide mb-4">
                  {t('header.watches').toUpperCase()}
                </h3>
                <div className="w-12 h-px bg-white mx-auto"></div>
              </div>
            </div>
          </div>

          {/* Jewelry */}
          <div className="group relative overflow-hidden rounded-lg">
            <div className="aspect-[4/3] bg-gradient-to-br from-yellow-100 to-yellow-200">
              <img 
                src="https://www.rosefieldwatches.com/cdn/shop/files/0012627_3b2d2100-5444-4644-932e-ae1d809f4aba.jpg?v=1722949308?auto=compress&cs=tinysrgb&w=800"
                alt="Jewelry"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
              <div className="text-center text-white">
                <h3 className="text-3xl font-light tracking-wide mb-4">
                  {t('header.jewelry').toUpperCase()}
                </h3>
                <div className="w-12 h-px bg-white mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategorySection;