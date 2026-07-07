import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { toBrandSlug } from '../utils/brandSlug';

interface Brand {
  id: string;
  name: string;
  logo?: string | null;
}

const BrandSlider: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const snap = await getDocs(collection(db, 'brands'));
      const data: Brand[] = snap.docs.map((d) => {
        const v = d.data() as { name?: string; logo?: string | null };
        return { id: d.id, name: v.name || d.id, logo: v.logo || null };
      });
      setBrands(data.filter((b) => !!b.name));
    } catch (error) {
      console.error('Error loading brands:', error);
      setBrands([
        { id: '1', name: 'DE VALEUR' },
        { id: '2', name: 'PREMIUM' },
        { id: '3', name: 'FASHION' },
        { id: '4', name: 'LIFESTYLE' },
        { id: '5', name: 'QUALITY' },
        { id: '6', name: 'STYLE' },
      ]);
    }
  };

  if (brands.length === 0) return null;

  const list = [...brands, ...brands];

  return (
    <div
      className="bg-white border-t border-gray-100 py-8 overflow-hidden"
      data-testid="brand-slider"
    >
      <div className="relative">
        <div className="flex animate-scroll whitespace-nowrap items-center">
          {list.map((b, index) => (
            <Link
              key={`${b.id}-${index}`}
              to={`/brand/${toBrandSlug(b.name)}`}
              className="inline-flex items-center justify-center gap-3 px-10 group"
              data-testid={`brand-slider-item-${b.name}`}
            >
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  className="h-7 md:h-8 w-auto max-w-[120px] object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                />
              ) : null}
              <span className="text-gray-400 group-hover:text-gray-900 transition-colors font-light text-base md:text-lg tracking-wider">
                {b.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 38s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default BrandSlider;
