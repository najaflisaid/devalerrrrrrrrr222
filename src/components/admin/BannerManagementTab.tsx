import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Image as ImageIcon, Loader2, X, Upload, Video } from 'lucide-react';
import { getAllBanners, createBanner, updateBanner, deleteBanner, Banner } from '../../services/bannerService';
import { storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const BannerManagementTab: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<any>({
    imageUrl: '',
    title: { az: '', ru: '', en: '' },
    link: '',
    buttonText: { az: '', ru: '', en: '' },
    position: 'home',
    orderIndex: 0,
    active: true,
    mediaType: 'image',
    videoUrl: '',
    duration: 4
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Fayl ölçüsü 5MB-dan çox olmamalıdır');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const filename = `banner_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `banners/${filename}`);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      let imageUrl = formData.imageUrl;

      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }

      if (formData.mediaType === 'image' && !imageUrl) {
        alert('Zəhmət olmasa şəkil seçin və ya URL daxil edin');
        return;
      }

      if (formData.mediaType === 'video' && !formData.videoUrl) {
        alert('Zəhmət olmasa video URL daxil edin');
        return;
      }

      const bannerData = { ...formData, imageUrl };

      if (editingBanner) {
        await updateBanner(editingBanner.id!, bannerData);
      } else {
        await createBanner(bannerData);
      }
      await loadBanners();
      resetForm();
      alert('Banner uğurla saxlanıldı!');
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Banner saxlanıla bilmədi: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu banneri silmək istədiyinizə əminsiniz?')) return;
    try {
      await deleteBanner(id);
      loadBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('Banner silinə bilmədi');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      imageUrl: banner.imageUrl || '',
      title: banner.title,
      link: banner.link || '',
      buttonText: (banner as any).buttonText || { az: '', ru: '', en: '' },
      position: banner.position,
      orderIndex: banner.orderIndex,
      active: banner.active,
      mediaType: (banner as any).mediaType || 'image',
      videoUrl: (banner as any).videoUrl || '',
      duration: (banner as any).duration || 4
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBanner(null);
    setFormData({
      imageUrl: '',
      title: { az: '', ru: '', en: '' },
      link: '',
      buttonText: { az: '', ru: '', en: '' },
      position: 'home',
      orderIndex: 0,
      active: true,
      mediaType: 'image',
      videoUrl: '',
      duration: 4
    });
    setSelectedFile(null);
    setPreviewUrl('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Banner İdarəetməsi</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Yeni Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="relative h-48 bg-gray-100">
              {(banner as any).mediaType === 'video' && (banner as any).videoUrl ? (
                <iframe
                  src={(banner as any).videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <img
                  src={banner.imageUrl || ''}
                  alt={banner.title.az}
                  className="w-full h-full object-cover"
                />
              )}
              {!banner.active && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white font-semibold">Deaktiv</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-2">
                <p className="font-semibold text-gray-900">{banner.title.az}</p>
                <p className="text-sm text-gray-600">{banner.title.ru}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3 flex-wrap">
                <span className={`px-2 py-1 rounded ${banner.position === 'home' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                  {banner.position === 'home' ? 'Ana Səhifə' : 'Məhsullar'}
                </span>
                <span className={`px-2 py-1 rounded ${(banner as any).mediaType === 'video' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                  {(banner as any).mediaType === 'video' ? 'Video' : 'Şəkil'}
                </span>
                <span>Sıra: {banner.orderIndex}</span>
                <span>{(banner as any).duration || 4}s</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(banner)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
                >
                  <Edit className="h-4 w-4" />
                  Redaktə
                </button>
                <button
                  onClick={() => handleDelete(banner.id!)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Hələ banner əlavə edilməyib</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingBanner ? 'Banner Redaktə' : 'Yeni Banner'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Media Tipi</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mediaType: 'image' })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.mediaType === 'image' ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <ImageIcon className="h-5 w-5" />
                    <span>Şəkil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mediaType: 'video' })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.mediaType === 'video' ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Video className="h-5 w-5" />
                    <span>Video</span>
                  </button>
                </div>
              </div>

              {formData.mediaType === 'image' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Şəkil Yüklə</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="banner-upload"
                      />
                      <label htmlFor="banner-upload" className="cursor-pointer">
                        {previewUrl || formData.imageUrl ? (
                          <div className="space-y-2">
                            <img src={previewUrl || formData.imageUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                            <p className="text-sm text-blue-600 hover:text-blue-700">Başqa şəkil seçin</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                            <p className="text-gray-600">Şəkil yükləmək üçün klikləyin</p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF (max 5MB)</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">və ya</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şəkil URL</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </>
              )}

              {formData.mediaType === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="https://www.youtube.com/embed/..."
                    required
                  />
                  <p className="mt-2 text-xs text-gray-500">YouTube üçün: https://www.youtube.com/embed/VIDEO_ID</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlıq (AZ)</label>
                  <input
                    type="text"
                    value={formData.title.az}
                    onChange={(e) => setFormData({ ...formData, title: { ...formData.title, az: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlıq (RU)</label>
                  <input
                    type="text"
                    value={formData.title.ru}
                    onChange={(e) => setFormData({ ...formData, title: { ...formData.title, ru: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlıq (EN)</label>
                  <input
                    type="text"
                    value={formData.title.en}
                    onChange={(e) => setFormData({ ...formData, title: { ...formData.title, en: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (İstəyə bağlı)</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              {formData.link && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buton Mətni (AZ)</label>
                    <input
                      type="text"
                      value={formData.buttonText?.az || ''}
                      onChange={(e) => setFormData({ ...formData, buttonText: { ...formData.buttonText, az: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Daha ətraflı"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buton Mətni (RU)</label>
                    <input
                      type="text"
                      value={formData.buttonText?.ru || ''}
                      onChange={(e) => setFormData({ ...formData, buttonText: { ...formData.buttonText, ru: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Подробнее"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buton Mətni (EN)</label>
                    <input
                      type="text"
                      value={formData.buttonText?.en || ''}
                      onChange={(e) => setFormData({ ...formData, buttonText: { ...formData.buttonText, en: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Learn more"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mövqe</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as 'home' | 'products' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="home">Ana Səhifə</option>
                    <option value="products">Məhsullar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                  <input
                    type="number"
                    value={formData.orderIndex}
                    onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Müddət (saniyə)</label>
                  <input
                    type="number"
                    value={formData.duration || 4}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 4 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    min="1"
                    max="60"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">Aktiv</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Yüklənir...
                    </>
                  ) : (
                    editingBanner ? 'Yenilə' : 'Əlavə et'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={uploading}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Ləğv et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerManagementTab;
