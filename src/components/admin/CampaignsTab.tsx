import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import {
  getCampaign,
  saveCampaign,
  uploadCampaignImage,
  defaultCampaign,
  isCampaignLive,
  type Campaign,
  type BrandOverride,
} from '../../services/campaignService';
import { invalidateCampaignCache } from '../../services/productService';
import { productService } from '../../services/productService';

const CampaignsTab: React.FC = () => {
  const [data, setData] = useState<Campaign>(defaultCampaign());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, prods] = await Promise.all([
          getCampaign(),
          productService.getAll().catch(() => [] as any[]),
        ]);
        setData(c);
        const uniqueBrands = Array.from(
          new Set(prods.map((p: any) => (p.brand || '').trim()).filter(Boolean))
        ).sort();
        setBrands(uniqueBrands as string[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof Campaign>(k: K, v: Campaign[K]) => {
    setData((d) => ({ ...d, [k]: v }));
  };
  const updatePopup = <K extends keyof Campaign['popup']>(k: K, v: Campaign['popup'][K]) => {
    setData((d) => ({ ...d, popup: { ...d.popup, [k]: v } }));
  };

  const addOverride = () => {
    setData((d) => ({
      ...d,
      brandOverrides: [...d.brandOverrides, { brand: '', type: 'exclude' }],
    }));
  };
  const updateOverride = (idx: number, patch: Partial<BrandOverride>) => {
    setData((d) => {
      const arr = [...d.brandOverrides];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...d, brandOverrides: arr };
    });
  };
  const removeOverride = (idx: number) => {
    setData((d) => ({ ...d, brandOverrides: d.brandOverrides.filter((_, i) => i !== idx) }));
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
      const url = await uploadCampaignImage(file);
      updatePopup('imageUrl', url);
      setMsg({ type: 'ok', text: 'Şəkil yükləndi' });
    } catch (err: any) {
      setMsg({ type: 'err', text: 'Yükləmə xətası: ' + (err?.message || 'naməlum') });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setMsg(null);
    if (data.isActive) {
      if (data.discountPercent < 0 || data.discountPercent > 99) {
        setMsg({ type: 'err', text: 'Endirim faizi 0-99 arası olmalıdır' });
        return;
      }
      if (data.startDate && data.endDate) {
        if (new Date(data.endDate).getTime() <= new Date(data.startDate).getTime()) {
          setMsg({ type: 'err', text: 'Bitmə tarixi başlama tarixindən sonra olmalıdır' });
          return;
        }
      }
    }
    setSaving(true);
    try {
      await saveCampaign(data);
      invalidateCampaignCache();
      setMsg({ type: 'ok', text: 'Kampaniya yadda saxlanıldı' });
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

  const live = isCampaignLive(data);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${live ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${live ? 'text-emerald-800' : 'text-gray-700'}`}>
            {live ? 'Kampaniya hazırda AKTİVDİR' : 'Kampaniya passivdir'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {live ? 'Endirim avtomatik tətbiq olunur və popup ziyarətçilərə göstərilir' : 'Aktivləşdirin və tarixi təyin edin'}
          </p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Settings card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Endirim Ayarları</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Kampaniya adı (daxili)</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="məs: Yeni il endirimləri"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Global endirim faizi (%)</label>
            <input
              type="number"
              min={0}
              max={99}
              value={data.discountPercent}
              onChange={(e) => update('discountPercent', +e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-percent"
            />
            <p className="text-[11px] text-gray-500 mt-1">Yalnız endirimi olmayan məhsullara tətbiq olunur</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Başlama tarixi</label>
            <input
              type="datetime-local"
              value={data.startDate || ''}
              onChange={(e) => update('startDate', e.target.value || null)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-start"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Bitmə tarixi</label>
            <input
              type="datetime-local"
              value={data.endDate || ''}
              onChange={(e) => update('endDate', e.target.value || null)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-end"
            />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.isActive}
            onChange={(e) => update('isActive', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            data-testid="campaign-active"
          />
          <span className="text-sm text-gray-900 font-medium">Kampaniyanı aktivləşdir</span>
        </label>
      </div>

      {/* Brand overrides */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Brend istisnaları / fərqli faizlər</h3>
            <p className="text-xs text-gray-500 mt-0.5">Burada təyin etmədiyiniz brendlər üçün global faiz işləyəcək</p>
          </div>
          <button
            type="button"
            onClick={addOverride}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-black"
            data-testid="campaign-brand-add"
          >
            <Plus className="h-4 w-4" />
            Brend əlavə et
          </button>
        </div>
        <div className="space-y-2">
          {data.brandOverrides.length === 0 && (
            <p className="text-xs text-gray-400 italic">Heç bir brend istisnası yoxdur</p>
          )}
          {data.brandOverrides.map((ov, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center border border-gray-200 rounded-lg p-2">
              <select
                value={ov.brand}
                onChange={(e) => updateOverride(idx, { brand: e.target.value })}
                className="col-span-5 h-9 px-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:outline-none"
                data-testid={`campaign-brand-select-${idx}`}
              >
                <option value="">— Brend seçin —</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={ov.type}
                onChange={(e) => updateOverride(idx, { type: e.target.value as any })}
                className="col-span-3 h-9 px-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:outline-none"
                data-testid={`campaign-brand-type-${idx}`}
              >
                <option value="exclude">Tamamilə istisna</option>
                <option value="custom">Fərqli faiz</option>
              </select>
              {ov.type === 'custom' ? (
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={ov.percent ?? 0}
                  onChange={(e) => updateOverride(idx, { percent: +e.target.value })}
                  placeholder="Faiz"
                  className="col-span-3 h-9 px-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:outline-none"
                  data-testid={`campaign-brand-percent-${idx}`}
                />
              ) : (
                <div className="col-span-3 text-xs text-gray-400 italic px-2">Endirim yoxdur</div>
              )}
              <button
                type="button"
                onClick={() => removeOverride(idx)}
                className="col-span-1 h-9 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                data-testid={`campaign-brand-remove-${idx}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Popup */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Kampaniya Popup-u</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.popup.enabled}
              onChange={(e) => updatePopup('enabled', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              data-testid="campaign-popup-enabled"
            />
            <span className="text-sm text-gray-700">Popup-u aktiv et</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Şəkil</label>
            <div className="flex items-center gap-3">
              {data.popup.imageUrl ? (
                <img src={data.popup.imageUrl} alt="popup" className="w-24 h-20 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="w-24 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <label className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg cursor-pointer text-sm font-medium transition-colors ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Yüklənir...' : 'Şəkil seç'}
                <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} className="hidden" data-testid="campaign-popup-image" />
              </label>
              {data.popup.imageUrl && (
                <button type="button" onClick={() => updatePopup('imageUrl', '')} className="text-xs text-red-500 hover:underline">Sil</button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Başlıq</label>
            <input
              type="text"
              value={data.popup.title}
              onChange={(e) => updatePopup('title', e.target.value)}
              placeholder="məs: 30% endirim!"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-popup-title"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Düymə mətni</label>
            <input
              type="text"
              value={data.popup.buttonText}
              onChange={(e) => updatePopup('buttonText', e.target.value)}
              placeholder="məs: Alış-verişə başla"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-popup-btntext"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Qısa mətn</label>
            <textarea
              value={data.popup.subtitle}
              onChange={(e) => updatePopup('subtitle', e.target.value)}
              rows={2}
              placeholder="məs: Yalnız bu həftə — bütün kolleksiyada xüsusi qiymətlər"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none resize-none"
              data-testid="campaign-popup-subtitle"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Düymə linki</label>
            <input
              type="text"
              value={data.popup.buttonLink}
              onChange={(e) => updatePopup('buttonLink', e.target.value)}
              placeholder="/products və ya tam URL"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-popup-btnlink"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Gecikmə (saniyə)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={data.popup.delaySec}
              onChange={(e) => updatePopup('delaySec', +e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none"
              data-testid="campaign-popup-delay"
            />
            <p className="text-[11px] text-gray-500 mt-1">Sayta girdikdən neçə saniyə sonra göstərilsin</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 h-11 px-6 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="campaign-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Yadda saxla
        </button>
      </div>
    </div>
  );
};

export default CampaignsTab;
