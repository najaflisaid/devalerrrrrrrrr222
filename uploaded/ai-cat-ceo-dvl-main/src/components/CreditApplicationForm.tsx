import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CreditCard } from 'lucide-react';

interface CreditApplicationFormProps {
  productName: string;
  productPrice: number;
  onClose: () => void;
}

const CreditApplicationForm: React.FC<CreditApplicationFormProps> = ({
  productName,
  productPrice,
  onClose
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    phone: '',
    fullName: '',
    contactPhone1: '',
    contactName1: '',
    contactRelation1: '',
    contactPhone2: '',
    contactName2: '',
    contactRelation2: '',
    contactPhone3: '',
    contactName3: '',
    contactRelation3: '',
    workplace: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const message = `
🛍️ ${t('creditForm.title')}

${t('creditForm.productName')}: ${productName}
${t('creditForm.productPrice')}: ${productPrice} AZN

👤 ${t('creditForm.personalInfo')}:
${t('creditForm.phone')}: ${formData.phone}
${t('creditForm.name')} ${t('creditForm.surname')}: ${formData.fullName}

📞 ${t('creditForm.relative')}:
1. ${formData.contactName1} (${formData.contactRelation1}) - ${formData.contactPhone1}
2. ${formData.contactName2} (${formData.contactRelation2}) - ${formData.contactPhone2}
3. ${formData.contactName3} (${formData.contactRelation3}) - ${formData.contactPhone3}

${t('creditForm.workplace')}: ${formData.workplace || t('creditForm.relative')}
    `.trim();

    const whatsappURL = `https://wa.me/994777577277?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{t('creditForm.title')}</h3>
            <p className="text-sm text-gray-600">{productName} - {productPrice} AZN</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('creditForm.creditProvider')}
            </h4>
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4 text-center">
              <img
                src="https://www.bildir.az/media/company_logos/ferrum.png"
                alt="Ferrum Kapital"
                className="h-12 mx-auto mb-2 object-contain"
              />
              <p className="text-sm font-semibold text-gray-800">{t('creditForm.ferrumCapital')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">{t('creditForm.personalInfo')}</h4>

            <div>
              <label className="block text-sm font-medium mb-2">{t('creditForm.phone')} *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                placeholder="+994 XX XXX XX XX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('creditForm.name')} {t('creditForm.surname')} *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                placeholder={`${t('creditForm.name')} ${t('creditForm.surname')}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">{t('creditForm.relative')} (3) *</h4>

            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.name')} 1 *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactName1}
                    onChange={(e) => setFormData({ ...formData, contactName1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={`${t('creditForm.name')} ${t('creditForm.surname')}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.relative')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactRelation1}
                    onChange={(e) => setFormData({ ...formData, contactRelation1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={t('creditForm.relative')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.phone')} *</label>
                  <input
                    type="tel"
                    required
                    value={formData.contactPhone1}
                    onChange={(e) => setFormData({ ...formData, contactPhone1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder="+994 XX XXX XX XX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.name')} 2 *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactName2}
                    onChange={(e) => setFormData({ ...formData, contactName2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={`${t('creditForm.name')} ${t('creditForm.surname')}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.relative')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactRelation2}
                    onChange={(e) => setFormData({ ...formData, contactRelation2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={t('creditForm.relative')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.phone')} *</label>
                  <input
                    type="tel"
                    required
                    value={formData.contactPhone2}
                    onChange={(e) => setFormData({ ...formData, contactPhone2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder="+994 XX XXX XX XX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.name')} 3 *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactName3}
                    onChange={(e) => setFormData({ ...formData, contactName3: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={`${t('creditForm.name')} ${t('creditForm.surname')}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.relative')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactRelation3}
                    onChange={(e) => setFormData({ ...formData, contactRelation3: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder={t('creditForm.relative')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('creditForm.phone')} *</label>
                  <input
                    type="tel"
                    required
                    value={formData.contactPhone3}
                    onChange={(e) => setFormData({ ...formData, contactPhone3: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black bg-white"
                    placeholder="+994 XX XXX XX XX"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('creditForm.workplace')}</label>
            <input
              type="text"
              value={formData.workplace}
              onChange={(e) => setFormData({ ...formData, workplace: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              placeholder={t('creditForm.workplace')}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 font-medium"
            >
              {t('creditForm.sendWhatsapp')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              {t('creditForm.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreditApplicationForm;
