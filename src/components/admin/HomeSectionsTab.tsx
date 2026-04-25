import React, { useEffect, useState } from 'react';
import { Loader2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
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
  const [productSearch, setProductSearch] = useState<string>('');

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
          <p className="text-sm text-gray-500 mt-1">Maison Quote və Signature Piece 3D mətnlərini idarə edin.</p>
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

      {/* --- Signature Piece 3D --- */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h3 className="text-lg font-semibold text-gray-900">Signature Piece 3D (Seçilmiş əsər)</h3>
          <Toggle
            on={data.signature.enabled}
            onChange={(v) => setData({ ...data, signature: { ...data.signature, enabled: v } })}
          />
        </div>

        <MultiLangField
          label="Eyebrow (üst yazı)"
          value={data.signature.eyebrow}
          onChange={(v) => setData({ ...data, signature: { ...data.signature, eyebrow: v } })}
        />
        <MultiLangField
          label="Başlıq"
          value={data.signature.title}
          onChange={(v) => setData({ ...data, signature: { ...data.signature, title: v } })}
        />
        <MultiLangField
          label="Açıqlama"
          value={data.signature.subtitle}
          onChange={(v) => setData({ ...data, signature: { ...data.signature, subtitle: v } })}
          textarea
        />
        <MultiLangField
          label="Seçim etiketi (məs: Həftənin seçimi)"
          value={data.signature.pickLabel}
          onChange={(v) => setData({ ...data, signature: { ...data.signature, pickLabel: v } })}
        />
        <MultiLangField
          label="Düymə yazısı (CTA)"
          value={data.signature.ctaLabel}
          onChange={(v) => setData({ ...data, signature: { ...data.signature, ctaLabel: v } })}
        />

        <div>
          <Label>Seçilmiş məhsul</Label>

          {/* Search box */}
          <div className="relative mb-2">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Məhsul adı, brend və ya qiymət ilə axtarın..."
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              data-testid="home-sections-product-search"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                aria-label="Təmizlə"
              >
                ✕
              </button>
            )}
          </div>

          {(() => {
            const q = productSearch.trim().toLowerCase();
            const filtered = !q
              ? products
              : products.filter((p) => {
                  const name = typeof p.name === 'string'
                    ? p.name
                    : (p.name?.az || p.name?.en || p.name?.ru || '');
                  const haystack = [
                    name,
                    (p as any).brand,
                    (p as any).category,
                    p.id,
                    p.price?.toString(),
                  ].filter(Boolean).join(' ').toLowerCase();
                  return haystack.includes(q);
                });

            return (
              <>
                <select
                  value={data.signature.featuredProductId}
                  onChange={(e) =>
                    setData({
                      ...data,
                      signature: { ...data.signature, featuredProductId: e.target.value },
                    })
                  }
                  size={Math.min(8, Math.max(4, filtered.length + 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                  data-testid="home-sections-featured-product"
                >
                  <option value="">— Avtomatik (ilk best-seller) —</option>
                  {filtered.map((p) => {
                    const name = typeof p.name === 'string' ? p.name : (p.name?.az || p.name?.en || p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {name} · {p.price?.toFixed(2)} ₼
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {q
                    ? `${filtered.length} nəticə tapıldı (${products.length} məhsuldan)`
                    : 'Boş buraxsanız, avtomatik ilk best-seller göstərilir.'}
                </p>
              </>
            );
          })()}
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
