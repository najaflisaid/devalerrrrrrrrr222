import React, { useState, useEffect } from 'react';
import { Save, Plus, Edit, Trash2, X } from 'lucide-react';
import { getAllProductBanners, createProductBanner, updateProductBanner, deleteProductBanner, type ProductBanner } from '../../services/contentService';
import { siteConfirm } from '../ui/NotificationProvider';
import MediaInputRow from './MediaInputRow';

const ProductBannersTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<ProductBanner[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBanner, setEditingBanner] = useState<ProductBanner | null>(null);
  const [formData, setFormData] = useState<{
    title_az: string;
    title_ru: string;
    title_en: string;
    image_url: string;
    video_url: string;
    content_type: 'image' | 'video';
    link_url: string;
    position: number;
    is_active: boolean;
  }>({
    title_az: '',
    title_ru: '',
    title_en: '',
    image_url: '',
    video_url: '',
    content_type: 'image',
    link_url: '/products',
    position: 1,
    is_active: true
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const data = await getAllProductBanners();
      setBanners(data);
    } catch (error) {
      console.error('Error loading product banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (banner: ProductBanner) => {
    setEditingBanner(banner);
    setFormData({
      title_az: banner.title_az,
      title_ru: banner.title_ru,
      title_en: banner.title_en,
      image_url: banner.image_url || '',
      video_url: banner.video_url || '',
      content_type: banner.content_type || 'image',
      link_url: banner.link_url,
      position: banner.position,
      is_active: banner.is_active
    });
    setIsEditing(true);
  };

  const handleNew = () => {
    setEditingBanner(null);
    setFormData({
      title_az: '',
      title_ru: '',
      title_en: '',
      image_url: '',
      video_url: '',
      content_type: 'image',
      link_url: '/products',
      position: banners.length + 1,
      is_active: true
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (editingBanner) {
        await updateProductBanner(editingBanner.id, formData);
      } else {
        await createProductBanner(formData);
      }
      await loadBanners();
      setIsEditing(false);
      alert('Yadda saxlanıldı!');
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Xəta baş verdi');
    }
  };

  const handleDelete = async (id: string) => {
    if (await siteConfirm('Silmək istədiyinizdən əminsiniz?')) {
      try {
        await deleteProductBanner(id);
        await loadBanners();
        alert('Silindi!');
      } catch (error) {
        console.error('Error deleting banner:', error);
        alert('Xəta baş verdi');
      }
    }
  };

  if (loading) {
    return <div className="p-6">Yüklənir...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Məhsul Bannerləri</h2>
        {!isEditing && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="h-5 w-5" />
            Yeni Banner
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-white rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {editingBanner ? 'Banneri Redaktə Et' : 'Yeni Banner'}
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium mb-2">Kontent Tipi</label>
              <select
                value={formData.content_type}
                onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'image' | 'video' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              >
                <option value="image">Şəkil</option>
                <option value="video">Video</option>
              </select>
            </div>

            {formData.content_type === 'image' ? (
              <div>
                <label className="block text-sm font-medium mb-2">Şəkil (URL və ya faylı yüklə)</label>
                <MediaInputRow
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  placeholder="https://example.com/image.jpg və ya faylı yüklə"
                  folder="product-banners"
                  accept="image"
                  testId="product-banner-image"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Video (URL və ya faylı yüklə)</label>
                <MediaInputRow
                  value={formData.video_url}
                  onChange={(url) => setFormData({ ...formData, video_url: url })}
                  placeholder="https://example.com/video.mp4 və ya faylı yüklə"
                  folder="product-banners"
                  accept="video"
                  testId="product-banner-video"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Link URL</label>
              <input
                type="text"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pozisiya</label>
              <input
                type="number"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium">Aktiv</span>
              </label>
            </div>
          </div>

          {(formData.content_type === 'image' && formData.image_url) ||
           (formData.content_type === 'video' && formData.video_url) ? (
            <div>
              <label className="block text-sm font-medium mb-2">Önizləmə</label>
              {formData.content_type === 'video' && formData.video_url ? (
                <video
                  src={formData.video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full max-w-md h-64 object-cover rounded-lg"
                />
              ) : (
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full max-w-md h-64 object-cover rounded-lg"
                />
              )}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              <Save className="h-5 w-5" />
              Yadda saxla
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
              {banner.content_type === 'video' && banner.video_url ? (
                <video
                  src={banner.video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-48 object-cover"
                />
              ) : (
                <img
                  src={banner.image_url || ''}
                  alt={banner.title_az}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="font-semibold mb-2">{banner.title_az}</h3>
                <p className="text-sm text-gray-600 mb-2">Tip: {banner.content_type === 'video' ? 'Video' : 'Şəkil'}</p>
                <p className="text-sm text-gray-600 mb-2">Pozisiya: {banner.position}</p>
                <p className="text-sm text-gray-600 mb-4">
                  Status: {banner.is_active ? 'Aktiv' : 'Deaktiv'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(banner)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Edit className="h-4 w-4" />
                    Redaktə et
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isEditing && banners.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Hələ ki banner yoxdur. Yeni banner əlavə edin.
        </div>
      )}
    </div>
  );
};

export default ProductBannersTab;
