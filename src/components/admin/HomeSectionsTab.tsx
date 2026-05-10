import React, { useEffect, useState } from 'react';
import { Loader2, Save, ToggleLeft, ToggleRight, Image as ImageIcon, Upload, X } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import {
  getHomepageSections,
  updateHomepageSections,
  HomepageSections,
  DEFAULT_HOMEPAGE_SECTIONS,
} from '../../services/contentService';
import { productService } from '../../services/productService';
import type { Product } from '../../types';

type Lang = 'az' | 'ru' | 'en';
const LANGS: Lang[] = ['az', 'ru', 'en'];

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
);

const MultiLangField: React.FC<{
  label: string;
  value: { az: string; ru: string; en: string };
  onChange: (v: { az: string; ru: string; en: string }) => void;
  textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <div>
    <Label>{label}</Label>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {LANGS.map((l) => {
        const Tag: any = textarea ? 'textarea' : 'input';
        return (
          <div key={l}>
            <span className="text-xs text-gray-500 uppercase">{l}</span>
            <Tag
              value={value[l] || ''}
              onChange={(e: any) => onChange({ ...value, [l]: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              rows={textarea ? 3 : undefined}
              data-testid={`home-sections-${label.replace(/\s+/g, '-').toLowerCase()}-${l}`}
            />
          </div>
        );
      })}
    </div>
  </div>
);

const HomeSectionsTab: React.FC = () => {
  const [data, setData] = useState<HomepageSections>(DEFAULT_HOMEPAGE_SECTIONS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sec, prods] = await Promise.all([
          getHomepageSections(),
          productService.getAll(true),
        ]);
        setData(sec);
        setProducts(prods);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await updateHomepageSections(data);
      setStatus('Yadda saxlanıldı ✓');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setStatus('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black"
    >
      {on ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
      {on ? 'Aktivdir' : 'Deaktivdir'}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="home-sections-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Ana səhifə bölmələri</h2>
          <p className="text-sm text-gray-500 mt-1">Brend vitrinı, kateqoriya kartları və yeniliklər bölmələrini idarə edin.</p>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm text-gray-600">{status}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
            data-testid="home-sections-save"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Yadda saxla
          </button>
        </div>
      </div>

      {/* --- Brand Showcase --- */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5" data-testid="home-sections-brand-showcase">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Premium brendlər vitrinı</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ana səhifədə hansı brendlər və hansı sıra ilə görünməsini seçin.</p>
          </div>
          <Toggle
            on={data.brandShowcase.enabled}
            onChange={(v) => setData({ ...data, brandShowcase: { ...data.brandShowcase, enabled: v } })}
          />
        </div>

        <div>
          <Label>Maksimum brend sayı (1–12)</Label>
          <input
            type="number"
            min={1}
            max={12}
            value={data.brandShowcase.maxBrands}
            onChange={(e) =>
              setData({
                ...data,
                brandShowcase: {
                  ...data.brandShowcase,
                  maxBrands: Math.max(1, Math.min(12, Number(e.target.value) || 6)),
                },
              })
            }
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            data-testid="home-sections-brand-max"
          />
          <p className="text-xs text-gray-500 mt-1">
            Hazırda ana səhifədə həmişə dəqiq <strong>6 brend</strong> göstərilir (3 sütunda 2 sıra).
            Bu sahə yalnız avtomatik seçim üçün top-N saymağa təsir edir.
          </p>
        </div>

        <div>
          <Label>Brendlər</Label>
          <p className="text-xs text-gray-500 mb-2">
            Heç biri seçilməsə, ən çox məhsulu olan top {data.brandShowcase.maxBrands} brend avtomatik göstərilir.
            Seçdiyiniz brendlər seçilmə sırası ilə vitrində görünür.
          </p>

          {(() => {
            const allBrands = Array.from(
              new Set(products.map((p) => (p as any).brand).filter(Boolean))
            ).sort((a: string, b: string) => a.localeCompare(b, 'az'));
            const selected = data.brandShowcase.selectedBrands || [];
            const toggleBrand = (b: string) => {
              const next = selected.includes(b)
                ? selected.filter((x) => x !== b)
                : [...selected, b];
              setData({ ...data, brandShowcase: { ...data.brandShowcase, selectedBrands: next } });
            };
            return (
              <>
                {selected.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selected.map((b, i) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black text-white rounded-full text-xs"
                      >
                        <span className="font-mono opacity-60">{i + 1}.</span> {b}
                        <button
                          type="button"
                          onClick={() => toggleBrand(b)}
                          className="ml-1 opacity-70 hover:opacity-100"
                          aria-label="Sil"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setData({ ...data, brandShowcase: { ...data.brandShowcase, selectedBrands: [] } })
                      }
                      className="text-xs text-gray-500 hover:text-black underline ml-1"
                    >
                      Hamısını təmizlə
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
                  {allBrands.map((b: string) => {
                    const isSel = selected.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBrand(b)}
                        className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                          isSel
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-800 border-gray-200 hover:border-black hover:bg-gray-50'
                        }`}
                        data-testid={`brand-toggle-${b}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                  {allBrands.length === 0 && (
                    <p className="col-span-full text-xs text-gray-500 italic">Brend tapılmadı.</p>
                  )}
                </div>
              </>
            );
          })()}
        </div>

      </div>

      {/* ==================== Collection Tiles ==================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5" data-testid="home-sections-collection-tiles">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Kateqoriya kartları (2 sütun grid)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ana səhifədə 2 sütunda görünən kateqoriya kartlarını idarə edin (məs: Qol saatları, Gümüş aksesuarlar, Dəri).
              Hər birinin adı, şəkili və linki sizin tərəfinizdən təyin olunur.
            </p>
          </div>
          <Toggle
            on={data.collectionTiles?.enabled !== false}
            onChange={(v) =>
              setData({
                ...data,
                collectionTiles: {
                  ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                  enabled: v,
                },
              })
            }
          />
        </div>

        {/* Eyebrow / Title / Subtitle */}
        <MultiLangField
          label="Üst yazı (eyebrow)"
          value={(data.collectionTiles?.eyebrow || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.eyebrow!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                eyebrow: v,
              },
            })
          }
        />
        <MultiLangField
          label="Başlıq"
          value={(data.collectionTiles?.title || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.title!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                title: v,
              },
            })
          }
        />
        <MultiLangField
          label="Alt başlıq"
          textarea
          value={(data.collectionTiles?.subtitle || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.subtitle!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                subtitle: v,
              },
            })
          }
        />

        {/* Tile list */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label>Kartlar</Label>
            <button
              type="button"
              onClick={() => {
                const newTile = {
                  id: `tile_${Date.now()}`,
                  title_az: '',
                  title_ru: '',
                  title_en: '',
                  image_url: '',
                  link_url: '',
                };
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: [...(data.collectionTiles?.tiles || []), newTile],
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-md text-xs hover:bg-gray-800"
              data-testid="add-collection-tile-btn"
            >
              + Yeni kart
            </button>
          </div>

          <div className="space-y-3">
            {(data.collectionTiles?.tiles || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Hələ kart yoxdur. Yuxarıdakı "+ Yeni kart" düyməsi ilə əlavə edin.</p>
            )}

            {(data.collectionTiles?.tiles || []).map((t, idx) => {
              const updateTile = (patch: Partial<typeof t>) => {
                const next = [...(data.collectionTiles?.tiles || [])];
                next[idx] = { ...next[idx], ...patch };
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const removeTile = () => {
                const next = (data.collectionTiles?.tiles || []).filter((_, i) => i !== idx);
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const moveUp = () => {
                if (idx === 0) return;
                const next = [...(data.collectionTiles?.tiles || [])];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const moveDown = () => {
                const len = (data.collectionTiles?.tiles || []).length;
                if (idx >= len - 1) return;
                const next = [...(data.collectionTiles?.tiles || [])];
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const handleUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const filename = `collection_tile_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_collection_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ image_url: url });
                } catch (err) {
                  alert('Şəkil yüklənmədi: ' + (err as Error).message);
                }
              };
              const handleVideoUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'mp4';
                  const filename = `collection_tile_video_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_collection_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ video_url: url } as any);
                } catch (err) {
                  alert('Video yüklənmədi: ' + (err as Error).message);
                }
              };

              return (
                <div
                  key={t.id || idx}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                  data-testid={`collection-tile-row-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={moveUp} disabled={idx === 0} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Yuxarı">↑</button>
                      <button type="button" onClick={moveDown} disabled={idx >= (data.collectionTiles?.tiles || []).length - 1} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Aşağı">↓</button>
                      <button type="button" onClick={removeTile} className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-700" aria-label="Sil" data-testid={`remove-collection-tile-${idx}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact horizontal layout: small thumbnail + fields side by side */}
                  <div className="flex gap-3">
                    {/* Image — small thumbnail on the left */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <div className="aspect-[4/3] bg-white border border-gray-200 rounded overflow-hidden relative">
                        {t.image_url ? (
                          <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <label className="mt-1 w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                        <Upload className="h-3 w-3" />
                        {t.image_url ? 'Yenilə' : 'Yüklə'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.currentTarget.value = '';
                          }}
                          data-testid={`collection-tile-upload-${idx}`}
                        />
                      </label>
                      <input
                        type="text"
                        value={t.image_url}
                        onChange={(e) => updateTile({ image_url: e.target.value })}
                        placeholder="URL"
                        className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                      />

                      {/* Video — istəyə bağlı; yerləşdirilərsə şəkilin yerinə oynayır */}
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Video (istəyə bağlı)</p>
                        {(t as any).video_url && (
                          <div className="aspect-[4/3] bg-black border border-gray-200 rounded overflow-hidden mb-1">
                            <video
                              src={(t as any).video_url}
                              className="w-full h-full object-cover"
                              muted
                              autoPlay
                              loop
                              playsInline
                            />
                          </div>
                        )}
                        <label className="w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                          <Upload className="h-3 w-3" />
                          {(t as any).video_url ? 'Yenilə' : 'Yüklə'}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleVideoUpload(f);
                              e.currentTarget.value = '';
                            }}
                            data-testid={`collection-tile-video-upload-${idx}`}
                          />
                        </label>
                        <input
                          type="text"
                          value={(t as any).video_url || ''}
                          onChange={(e) => updateTile({ video_url: e.target.value } as any)}
                          placeholder="Video URL"
                          className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                          data-testid={`collection-tile-video-url-${idx}`}
                        />
                        {(t as any).video_url && (
                          <button
                            type="button"
                            onClick={() => updateTile({ video_url: '' } as any)}
                            className="mt-1 w-full px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded"
                          >
                            Videonu sil
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields — compact */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={t.title_az}
                        onChange={(e) => updateTile({ title_az: e.target.value })}
                        placeholder="Başlıq AZ"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                        data-testid={`collection-tile-title-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={t.title_ru}
                          onChange={(e) => updateTile({ title_ru: e.target.value })}
                          placeholder="RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                        <input
                          type="text"
                          value={t.title_en}
                          onChange={(e) => updateTile({ title_en: e.target.value })}
                          placeholder="EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={t.link_url}
                        onChange={(e) => updateTile({ link_url: e.target.value })}
                        placeholder="Link (məs: /products?category=...)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none font-mono"
                        data-testid={`collection-tile-link-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== News Tiles (Yeniliklər) ==================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5" data-testid="home-sections-news-tiles">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Yeniliklər (üfüqi sürüşmə)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ana səhifədə "Yeniliklər" bölməsi. Webdə eyni anda 4, mobildə 3 kart görünür — istifadəçi sağa-sola sürüşdürərək digərlərinə baxa bilir. Kartlar bir-birinə bitişikdir.
            </p>
          </div>
          <Toggle
            on={data.newsTiles?.enabled !== false}
            onChange={(v) =>
              setData({
                ...data,
                newsTiles: {
                  ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                  enabled: v,
                },
              })
            }
          />
        </div>

        <MultiLangField
          label="Başlıq"
          value={(data.newsTiles?.title || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!.title!) as any}
          onChange={(v) =>
            setData({
              ...data,
              newsTiles: {
                ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                title: v,
              },
            })
          }
        />

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label>Kartlar</Label>
            <button
              type="button"
              onClick={() => {
                const newTile = {
                  id: `news_${Date.now()}`,
                  title_az: '',
                  title_ru: '',
                  title_en: '',
                  image_url: '',
                  link_url: '',
                };
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: [...(data.newsTiles?.tiles || []), newTile],
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-md text-xs hover:bg-gray-800"
              data-testid="add-news-tile-btn"
            >
              + Yeni kart
            </button>
          </div>

          <div className="space-y-3">
            {(data.newsTiles?.tiles || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Hələ kart yoxdur.</p>
            )}

            {(data.newsTiles?.tiles || []).map((nt, idx) => {
              const tilesArr = data.newsTiles?.tiles || [];
              const updateTile = (patch: Partial<typeof nt>) => {
                const next = [...tilesArr];
                next[idx] = { ...next[idx], ...patch };
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const removeTile = () => {
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: tilesArr.filter((_, i) => i !== idx),
                  },
                });
              };
              const moveUp = () => {
                if (idx === 0) return;
                const next = [...tilesArr];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const moveDown = () => {
                if (idx >= tilesArr.length - 1) return;
                const next = [...tilesArr];
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const handleUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const filename = `news_tile_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_news_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ image_url: url });
                } catch (err) {
                  alert('Şəkil yüklənmədi: ' + (err as Error).message);
                }
              };

              return (
                <div
                  key={nt.id || idx}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                  data-testid={`news-tile-row-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={moveUp} disabled={idx === 0} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Yuxarı">↑</button>
                      <button type="button" onClick={moveDown} disabled={idx >= tilesArr.length - 1} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Aşağı">↓</button>
                      <button type="button" onClick={removeTile} className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-700" aria-label="Sil" data-testid={`remove-news-tile-${idx}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact horizontal layout: small thumbnail + fields side by side */}
                  <div className="flex gap-3">
                    {/* Image — small thumbnail on the left */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <div className="aspect-[4/3] bg-white border border-gray-200 rounded overflow-hidden relative">
                        {nt.image_url ? (
                          <img src={nt.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <label className="mt-1 w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                        <Upload className="h-3 w-3" />
                        {nt.image_url ? 'Yenilə' : 'Yüklə'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.currentTarget.value = '';
                          }}
                          data-testid={`news-tile-upload-${idx}`}
                        />
                      </label>
                      <input
                        type="text"
                        value={nt.image_url}
                        onChange={(e) => updateTile({ image_url: e.target.value })}
                        placeholder="URL"
                        className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                      />
                    </div>

                    {/* Fields — compact */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={nt.title_az}
                        onChange={(e) => updateTile({ title_az: e.target.value })}
                        placeholder="Başlıq AZ"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                        data-testid={`news-tile-title-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={nt.title_ru}
                          onChange={(e) => updateTile({ title_ru: e.target.value })}
                          placeholder="RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                        <input
                          type="text"
                          value={nt.title_en}
                          onChange={(e) => updateTile({ title_en: e.target.value })}
                          placeholder="EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                      </div>
                      <textarea
                        value={(nt as any).description_az || ''}
                        onChange={(e) => updateTile({ description_az: e.target.value } as any)}
                        rows={2}
                        placeholder="Açıqlama AZ"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        data-testid={`news-tile-desc-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <textarea
                          value={(nt as any).description_ru || ''}
                          onChange={(e) => updateTile({ description_ru: e.target.value } as any)}
                          rows={2}
                          placeholder="Açıqlama RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        />
                        <textarea
                          value={(nt as any).description_en || ''}
                          onChange={(e) => updateTile({ description_en: e.target.value } as any)}
                          rows={2}
                          placeholder="Açıqlama EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        />
                      </div>
                      <input
                        type="text"
                        value={nt.link_url}
                        onChange={(e) => updateTile({ link_url: e.target.value })}
                        placeholder="Link (məs: /blog/...)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none font-mono"
                        data-testid={`news-tile-link-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Dəyişiklikləri saxla
        </button>
      </div>
    </div>
  );
};

export default HomeSectionsTab;
