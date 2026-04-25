import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Save to Firebase for admin panel
      await addDoc(collection(db, 'contact_messages'), {
        ...formData,
        status: 'new',
        createdAt: serverTimestamp()
      });

      alert(t('contact.messageSent'));
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error:', error);
      alert('Error sending message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <h1 className="font-playfair text-3xl md:text-4xl font-light text-black tracking-tight leading-none">
            {t('contact.title')}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="hidden md:inline-block w-8 h-[1px] flex-shrink-0" style={{ background: '#D4AF37' }} />
            <p className="text-gray-500 text-sm font-light leading-snug">
              {t('contact.getInTouch')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-playfair text-3xl mb-6">{t('contact.getInTouch')}</h2>
            <p className="text-gray-600 mb-8">
              {t('contact.subtitle')}
            </p>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-gray-900 text-white p-3 rounded-lg mr-4">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{t('contact.phone')}</h3>
                  <p className="text-gray-600">
                    <a href="tel:+994777577277" className="hover:text-gray-900">+994 77 757 72 77</a>
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-gray-900 text-white p-3 rounded-lg mr-4">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{t('contact.email')}</h3>
                  <p className="text-gray-600">
                    <a href="mailto:info@devaleur.az" className="hover:text-gray-900">İnfo@devaleur.az</a>
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-gray-900 text-white p-3 rounded-lg mr-4">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{t('contact.workingHours')}</h3>
                  <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: t('contact.workingHoursText').replace('\n', '<br />') }} />
                </div>
              </div>
            </div>

            {/* Branches */}
            <div className="mt-10">
              <h3 className="font-playfair text-2xl mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#D4AF37]" />
                Filiallarımız
              </h3>
              <div className="space-y-5" data-testid="contact-branches">
                {[
                  {
                    id: 'sulh',
                    name: 'DE VALEUR — Sumqayıt, Sülh küçəsi',
                    address: 'Sumqayıt şəh., Sülh küçəsi',
                    lat: 40.5889111,
                    lng: 49.6751973,
                    link: 'https://www.google.com/maps/place/DE+VALEUR+Sumqay%C4%B1t+%C5%9F%C9%99h.,+S%C3%BClh+k%C3%BC%C3%A7%C9%99si/@40.5889111,49.672617,17z/data=!3m1!4b1!4m6!3m5!1s0x403097968093f8b1:0x2dddf79b0380cbf9!8m2!3d40.5889111!4d49.6751973'
                  },
                  {
                    id: 'azadliq',
                    name: 'DE VALEUR — Bakı, Azadlıq Prospekti',
                    address: 'Bakı şəh., Azadlıq Prospekti',
                    lat: 40.3945648,
                    lng: 49.8402833,
                    link: 'https://www.google.com/maps/place/DE+VALEUR+Azadl%C4%B1q+Prospekti/@40.3945648,49.837703,17z/data=!3m1!4b1!4m6!3m5!1s0x40307d7836198c1b:0x97426f996ccdb934!8m2!3d40.3945648!4d49.8402833'
                  },
                  {
                    id: 'karvan',
                    name: 'DE VALEUR — Sumqayıt, Karvan Mall',
                    address: 'Sumqayıt şəh., Karvan Mall',
                    lat: 40.5899542,
                    lng: 49.6747978,
                    link: 'https://www.google.com/maps/place/DE+VALEUR+Sumqay%C4%B1t+%C5%9F%C9%99h.,+Karvan+Mall/@40.5899542,49.6722175,17z/data=!3m1!4b1!4m6!3m5!1s0x4030970db096e551:0x160a0e8cde924a04!8m2!3d40.5899542!4d49.6747978'
                  }
                ].map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    data-testid={`contact-branch-${branch.id}`}
                  >
                    <div className="p-4 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-900">{branch.name}</h4>
                      <p className="text-sm text-gray-600 mt-0.5">{branch.address}</p>
                    </div>
                    <div className="h-48 bg-gray-100">
                      <iframe
                        title={branch.name}
                        src={`https://maps.google.com/maps?q=${branch.lat},${branch.lng}&hl=az&z=17&output=embed`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                    <div className="p-3 flex justify-end">
                      <a
                        href={branch.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-900 font-medium hover:text-[#D4AF37] transition-colors"
                        data-testid={`contact-branch-${branch.id}-directions`}
                      >
                        <MapPin className="h-4 w-4" />
                        Xəritədə aç
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-2xl p-8">
              <h2 className="font-playfair text-3xl mb-6">{t('contact.sendMessage')}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('contact.name')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                    placeholder={t('contact.namePlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('contact.email')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('contact.phone')}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                    placeholder="+994 XX XXX XX XX"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('contact.subject')}
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                    placeholder={t('contact.subjectPlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('contact.message')}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all resize-none"
                    placeholder={t('contact.messagePlaceholder')}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('cart.sending') : t('contact.send')}
                  <Send className="h-5 w-5 ml-2" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
