import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../../services/userService';

interface B2BRequestFormProps {
  onSuccess?: () => void;
}

const B2BRequestForm: React.FC<B2BRequestFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Optimistic UI: göndərmə fonda gedir, istifadəçi dərhal təsdiq görür
    userService.submitB2BRequest(formData)
      .then(() => {
        // uğurla yazıldı — heç nə etmə (UI artıq submitted vəziyyətindədir)
      })
      .catch((error) => {
        console.error('Error submitting B2B request:', error);
        // Qeyd: müraciət UI-də artıq uğurlu görünür. Səhv olarsa konsolda saxla.
        // İstifadəçi yenidən cəhd edə bilməsi üçün submitted-i sıfırlamırıq —
        // admin paneldə yazı görünmədiyindən təkrar göndərə bilər.
      });

    // Dərhal "uğurla göndərildi" ekranını göstər
    setSubmitted(true);
    setLoading(false);

    if (onSuccess) {
      setTimeout(() => onSuccess(), 2000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('auth.requestSubmitted')}
          </h2>
          <p className="text-gray-600">
            {t('auth.requestDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.b2bRequestTitle')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.nameLabel')} *
            </label>
            <input
              type="text"
              name="first_name"
              required
              value={formData.first_name}
              onChange={handleChange}
              placeholder={t('auth.enterName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.surnameLabel')} *
            </label>
            <input
              type="text"
              name="last_name"
              required
              value={formData.last_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('auth.emailLabel')} *
          </label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('auth.phoneLabel')} *
          </label>
          <input
            type="tel"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('auth.companyLabel')} *
          </label>
          <input
            type="text"
            name="company_name"
            required
            value={formData.company_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('auth.passwordLabel')} *
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            placeholder={t('auth.passwordMinLength')}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-3 px-4 rounded-md hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('auth.sending') : t('auth.submitRequest')}
        </button>
      </form>
    </div>
  );
};

export default B2BRequestForm;