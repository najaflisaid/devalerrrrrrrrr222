import React, { useEffect, useState } from 'react';
import { Loader2, Upload, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import {
  getBestSellersBanner,
  saveBestSellersBanner,
  uploadBestSellersBannerImage,
  defaultBanner,
  type BestSellersBanner,
} from '../../services/bestSellersBannerService';

const BestSellersBannerTab: React.FC = () => {
  const [data, setData] = useState<BestSellersBanner>(defaultBanner());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getBestSellersBanner()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const updateLang = (
    field: 'title' | 'subtitle' | 'buttonText',
    lang: 'az' | 'ru' | 'en',
    value: string
  ) => {
    setData((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Şəkil 5MB-dan böyük ola bilməz' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadBestSellersBannerImage(file);
      setData((d) => ({ ...d, imageUrl: url }));
      setMsg({ type: 'ok', text: 'Şəkil yükləndi' });
    } catch (err: any) {
      setMsg({ type: 'err', text: 'Yükləmə xətası: ' + (err?.message || 'naməlum') });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setMsg(null);
    setSaving(true);
    try {
      await saveBestSellersBanner(data);
      setMsg({ type: 'ok', text: 'Banner yadda saxlanıldı' });
    } catch (err: any) {
      setMsg({ type: 'err', text: 'Yadda saxlama xətası: ' + (err?.message || 'naməlum') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bestsellers-banner-tab">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Bestseller Banner (sağ tərəf)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ana səhifədə "Bestsellers" bölməsində sağ tərəfdə göstərilən sticky banner.
              Yalnız desktop-də görsənir.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={(e) => setData((d) => ({ ...d, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              data-testid="bsb-enabled"
            />
            <span className="text-sm font-medium text-gray-900">Aktiv</span>
          </label>
        </div>

        {msg && (
          <div
            className={`rounded-lg border px-4 py-3 flex items-center gap-2 text-sm mb-4 ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {msg.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Image upload */}
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-700 block mb-2">
            Banner şəkli (portret format tövsiyə olunur — 3:4)
          </label>
          <div className="flex items-start gap-4">
            <div className="w-40 aspect-[3/4] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
              {data.imageUrl ? (
                <img
                  src={data.imageUrl}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                {uploading ? 'Yüklənir...' : 'Şəkil yüklə (fayl)'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  className="hidden"
                  data-testid="bsb-image"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider">və ya link</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <input
                type="text"
                value={data.imageUrl}
                onChange={(e) => setData((d) => ({ ...d, imageUrl: e.target.value }))}
                placeholder="https://...jpg"
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none font-mono"
                data-testid="bsb-image-url"
              />
              {data.imageUrl && (
                <button
                  type="button"
                  onClick={() => setData((d) => ({ ...d, imageUrl: '' }))}
                  className="text-[11px] text-red-600 hover:underline"
                  data-testid="bsb-image-clear"
                >
                  Şəkli sil
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Text fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Başlıq (AZ)</label>
            <input
              type="text"
              value={data.title.az}
              onChange={(e) => updateLang('title', 'az', e.target.value)}
              placeholder="məs: Yeni kolleksiya"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="bsb-title-az"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Başlıq (RU)</label>
            <input
              type="text"
              value={data.title.ru}
              onChange={(e) => updateLang('title', 'ru', e.target.value)}
              placeholder="Заголовок"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Başlıq (EN)</label>
            <input
              type="text"
              value={data.title.en}
              onChange={(e) => updateLang('title', 'en', e.target.value)}
              placeholder="Title"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Alt-mətn (AZ)</label>
            <textarea
              value={data.subtitle.az}
              onChange={(e) => updateLang('subtitle', 'az', e.target.value)}
              rows={2}
              placeholder="Qısa təsvir"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none resize-none"
              data-testid="bsb-subtitle-az"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Alt-mətn (RU)</label>
            <textarea
              value={data.subtitle.ru}
              onChange={(e) => updateLang('subtitle', 'ru', e.target.value)}
              rows={2}
              placeholder="Описание"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Alt-mətn (EN)</label>
            <textarea
              value={data.subtitle.en}
              onChange={(e) => updateLang('subtitle', 'en', e.target.value)}
              rows={2}
              placeholder="Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Düymə mətni (AZ)</label>
            <input
              type="text"
              value={data.buttonText.az}
              onChange={(e) => updateLang('buttonText', 'az', e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Düymə mətni (RU)</label>
            <input
              type="text"
              value={data.buttonText.ru}
              onChange={(e) => updateLang('buttonText', 'ru', e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Düymə mətni (EN)</label>
            <input
              type="text"
              value={data.buttonText.en}
              onChange={(e) => updateLang('buttonText', 'en', e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Düymə linki</label>
            <input
              type="text"
              value={data.buttonLink}
              onChange={(e) => setData((d) => ({ ...d, buttonLink: e.target.value }))}
              placeholder="/products"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="bsb-link"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Mətn rəngi</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.textColor}
                onChange={(e) => setData((d) => ({ ...d, textColor: e.target.value }))}
                className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={data.textColor}
                onChange={(e) => setData((d) => ({ ...d, textColor: e.target.value }))}
                className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono focus:border-gray-900 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Mətn mövqeyi</label>
            <select
              value={data.textPosition}
              onChange={(e) =>
                setData((d) => ({ ...d, textPosition: e.target.value as any }))
              }
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none bg-white"
              data-testid="bsb-text-position"
            >
              <option value="top">Yuxarı</option>
              <option value="center">Mərkəz</option>
              <option value="bottom">Aşağı</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          data-testid="bsb-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Yadda saxla
        </button>
      </div>
    </div>
  );
};

export default BestSellersBannerTab;
