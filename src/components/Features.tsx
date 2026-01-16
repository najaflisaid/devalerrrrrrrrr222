import React from 'react';
import { Award, Shield, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Features: React.FC = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Award,
      title: t('features.quality'),
      description: t('features.qualityDesc')
    },
    {
      icon: Shield,
      title: t('features.authentic'),
      description: t('features.authenticDesc')
    },
    {
      icon: CheckCircle,
      title: t('features.service'),
      description: t('features.serviceDesc')
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <div key={index} className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-full mb-2">
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;