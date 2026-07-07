import React, { useState, useEffect } from 'react';
import { Image, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { getAllBanners, createBanner, updateBanner, deleteBanner, type Banner } from '../../services/contentService';

const BannerManagementPanel: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title_az: '',
    title_ru: '',
    title_en: '',
    subtitle_az: '',
    subtitle_ru: '',
    subtitle_en: '',
    image_url: '',
    link_url: '/products',
    order_position: 0,
    is_active: true
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const data = await getAllBanners();
      setBanners(data);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingBanner) {
        await updateBanner(editingBanner.id, formData);
      } else {
        await createBanner(formData as Omit<Banner, 'id'>);
      }
      loadBanners();
      resetForm();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Xəta baş verdi');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Banneri silmək istədiyinizdən əminsiniz?')) {
      try {
        await deleteBanner(id);
        loadBanners();
      } catch (error) {
        console.error('Error deleting banner:', error);
        alert('Xəta baş verdi');
      }
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title_az: banner.title_az,
      title_ru: banner.title_ru,
      title_en: banner.title_en,
      subtitle_az: banner.subtitle_az || '',
      subtitle_ru: banner.subtitle_ru || '',
      subtitle_en: banner.subtitle_en || '',
      image_url: banner.image_url,
      link_url: banner.link_url,
      order_position: banner.order_position,
      is_active: banner.is_active
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingBanner(null);
    setShowForm(false);
    setFormData({
      title_az: '',
      title_ru: '',
      title_en: '',
      subtitle_az: '',
      subtitle_ru: '',
      subtitle_en: '',
      image_url: '',
      link_url: '/products',
      order_position: 0,
      is_active: true
    });
  };

  if (loading) {
    return <div className="p-6">Yüklənir...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Banner İdarəetməsi</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          <Plus className="h-5 w-5" />
          Yeni Banner
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingBanner ? 'Banneri Redaktə Et' : 'Yeni Banner'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
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
                <label className="block text-sm font-medium mb-2">Alt başlıq (AZ)</label>
                <input
                  type="text"
                  value={formData.subtitle_az}
                  onChange={(e) => setFormData({ ...formData, subtitle_az: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                />
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

              <div>
                <label className="block text-sm font-medium mb-2">Link URL</label>
                <input
                  type="text"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                  placeholder="/products"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sıra</label>
                <input
                  type="number"
                  value={formData.order_position}
                  onChange={(e) => setFormData({ ...formData, order_position: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5"
                />
                <label className="text-sm font-medium">Aktiv</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Save className="h-5 w-5" />
                  Yadda saxla
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Ləğv et
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex gap-4">
              {banner.image_url && (
                <img
                  src={banner.image_url}
                  alt={banner.title_az}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{banner.title_az}</h3>
                <p className="text-sm text-gray-600 mb-2">{banner.subtitle_az}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Sıra: {banner.order_position}</span>
                  <span className={banner.is_active ? 'text-green-600' : 'text-red-600'}>
                    {banner.is_active ? 'Aktiv' : 'Deaktiv'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(banner)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BannerManagementPanel;
