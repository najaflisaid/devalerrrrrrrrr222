import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Brand {
  id: string;
  name: string;
}

const BrandSlider: React.FC = () => {
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'brands'));
      const brandsData = querySnapshot.docs.map(doc => doc.data().name);
      setBrands(brandsData);
    } catch (error) {
      console.error('Error loading brands:', error);
      setBrands(['DE VALEUR', 'PREMIUM', 'FASHION', 'LIFESTYLE', 'QUALITY', 'STYLE']);
    }
  };

  if (brands.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-t border-gray-100 py-8 overflow-hidden">
      <div className="relative">
        <div className="flex animate-scroll whitespace-nowrap">
          {[...brands, ...brands].map((brand, index) => (
            <div
              key={index}
              className="inline-flex items-center justify-center px-12 text-gray-400 font-light text-lg tracking-wider"
            >
              {brand}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default BrandSlider;
