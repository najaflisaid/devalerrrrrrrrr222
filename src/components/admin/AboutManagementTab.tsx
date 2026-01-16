import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { getAboutPage, updateAboutPage, type AboutPage } from '../../services/contentService';

const AboutManagementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title_az: '',
    title_ru: '',
    title_en: '',
    content_az: '',
    content_ru: '',
    content_en: '',
    mission_az: '',
    mission_ru: '',
    mission_en: '',
    image_url: ''
  });

  useEffect(() => {
    loadAboutPage();
  }, []);

  const loadAboutPage = async () => {
    try {
      setLoading(true);
      const data = await getAboutPage();
      if (data) {
        setFormData({
          title_az: data.title_az,
          title_ru: data.title_ru,
          title_en: data.title_en,
          content_az: data.content_az,
          content_ru: data.content_ru,
          content_en: data.content_en,
          mission_az: data.mission_az || '',
          mission_ru: data.mission_ru || '',
          mission_en: data.mission_en || '',
          image_url: data.image_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading about page:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateAboutPage(formData);
      alert('Yadda saxlanıldı!');
    } catch (error) {
      console.error('Error saving about page:', error);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Yüklənir...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Haqqımızda Səhifəsi</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saxlanılır...' : 'Yadda saxla'}
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Başlıq (AZ)</label>
          <input
            type="text"
            value={formData.title_az}
            onChange={(e) => setFormData({ ...formData, title_az: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Başlıq (RU)</label>
          <input
            type="text"
            value={formData.title_ru}
            onChange={(e) => setFormData({ ...formData, title_ru: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Başlıq (EN)</label>
          <input
            type="text"
            value={formData.title_en}
            onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Məzmun (AZ)</label>
          <textarea
            value={formData.content_az}
            onChange={(e) => setFormData({ ...formData, content_az: e.target.value })}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Məzmun (RU)</label>
          <textarea
            value={formData.content_ru}
            onChange={(e) => setFormData({ ...formData, content_ru: e.target.value })}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Məzmun (EN)</label>
          <textarea
            value={formData.content_en}
            onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Missiyamız</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Missiya (AZ)</label>
              <textarea
                value={formData.mission_az}
                onChange={(e) => setFormData({ ...formData, mission_az: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Missiya (RU)</label>
              <textarea
                value={formData.mission_ru}
                onChange={(e) => setFormData({ ...formData, mission_ru: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Missiya (EN)</label>
              <textarea
                value={formData.mission_en}
                onChange={(e) => setFormData({ ...formData, mission_en: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Şəkil URL</label>
          <input
            type="text"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {formData.image_url && (
          <div>
            <label className="block text-sm font-medium mb-2">Şəkil önizləməsi</label>
            <img
              src={formData.image_url}
              alt="Preview"
              className="w-full max-w-md h-64 object-cover rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AboutManagementTab;
