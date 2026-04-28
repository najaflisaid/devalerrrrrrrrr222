import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import {
  getPrivacyPolicy,
  updatePrivacyPolicy,
  DEFAULT_PRIVACY_POLICY,
  type PrivacyPolicy,
  type PrivacySection,
} from '../../services/contentService';

const newSection = (): PrivacySection => ({
  id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  no: '',
  title: '',
  body: '',
});

const PrivacyPolicyTab: React.FC = () => {
  const [data, setData] = useState<PrivacyPolicy>(DEFAULT_PRIVACY_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getPrivacyPolicy();
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePrivacyPolicy(data);
      alert('Yadda saxlanıldı!');
    } catch (e) {
      console.error(e);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (field: keyof PrivacyPolicy['hero'], value: string) =>
    setData({ ...data, hero: { ...data.hero, [field]: value } });

  const updateSection = (idx: number, field: keyof PrivacySection, value: string) => {
    const sections = [...data.sections];
    sections[idx] = { ...sections[idx], [field]: value };
    setData({ ...data, sections });
  };

  const addSection = () => {
    const next = [...data.sections, newSection()];
    // auto-number to next available
    const nextNo = String(next.length).padStart(2, '0');
    next[next.length - 1].no = nextNo;
    setData({ ...data, sections: next });
  };

  const removeSection = (idx: number) => {
    if (!confirm('Bu bölməni silmək istədiyinizə əminsiniz?')) return;
    const sections = data.sections.filter((_, i) => i !== idx);
    setData({ ...data, sections });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const sections = [...data.sections];
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    [sections[idx], sections[j]] = [sections[j], sections[idx]];
    setData({ ...data, sections });
  };

  const resetToDefault = () => {
    if (!confirm('Bütün məzmunu standart (DE VALEUR) versiyasına qaytarmaq istədiyinizə əminsiniz?')) return;
    setData(DEFAULT_PRIVACY_POLICY);
  };

  if (loading) {
    return <div className="p-6">Yüklənir...</div>;
  }

  return (
    <div className="space-y-6" data-testid="privacy-management-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#D4AF37]" />
            Məxfilik Siyasəti
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Saytın <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/privacy-policy</code> səhifəsinin tam məzmunu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            data-testid="privacy-reset-default"
          >
            Standartı yüklə
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="privacy-save-btn"
            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saxlanılır...' : 'Yadda saxla'}
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <h3 className="text-lg font-semibold border-b pb-2">Başlıq bölməsi (Hero)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Eyebrow (üst kiçik mətn)" value={data.hero.eyebrow} onChange={(v) => updateHero('eyebrow', v)} />
          <Field label="Son yenilənmə (badge mətni)" value={data.hero.badgeRight} onChange={(v) => updateHero('badgeRight', v)} />
          <Field label="Başlıq — qara hissə" value={data.hero.title} onChange={(v) => updateHero('title', v)} />
          <Field label="Başlıq — qızılı hissə" value={data.hero.titleAccent} onChange={(v) => updateHero('titleAccent', v)} />
        </div>
        <Field
          label="Təsviri mətn (intro)"
          value={data.hero.intro}
          onChange={(v) => updateHero('intro', v)}
          rows={3}
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Sol rozet (Shield ikonalı)" value={data.hero.badgeLeft} onChange={(v) => updateHero('badgeLeft', v)} />
          <Field label="Aşağı imza (italic)" value={data.signature} onChange={(v) => setData({ ...data, signature: v })} />
        </div>
      </div>

      {/* SECTIONS */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Bölmələr ({data.sections.length})</h3>
            <p className="text-xs text-gray-500 mt-1">
              <strong>Body</strong> sahəsində <code>- Mətn</code> ilə başlayan sətirlər avtomatik
              maddə (bullet) kimi göstərilir. Boş sətir paraqraf ayırır.
            </p>
          </div>
          <button
            type="button"
            onClick={addSection}
            data-testid="privacy-add-section"
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
          >
            <Plus className="h-4 w-4" /> Bölmə əlavə et
          </button>
        </div>

        <div className="space-y-4">
          {data.sections.map((s, i) => (
            <div
              key={s.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
              data-testid={`privacy-section-row-${i}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-7">
                  <button
                    type="button"
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    aria-label="Yuxarı"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(i, 1)}
                    disabled={i === data.sections.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    aria-label="Aşağı"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <Field
                      label="No"
                      value={s.no}
                      onChange={(v) => updateSection(i, 'no', v)}
                    />
                    <Field
                      label="Başlıq"
                      value={s.title}
                      onChange={(v) => updateSection(i, 'title', v)}
                    />
                  </div>
                  <Field
                    label="Body (mətn)"
                    value={s.body}
                    onChange={(v) => updateSection(i, 'body', v)}
                    rows={5}
                    placeholder={'Burada mətn yazın...\n\n- Bullet maddə 1\n- Bullet maddə 2\n\nNövbəti paraqraf'}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0 mt-7"
                  aria-label="Sil"
                  data-testid={`privacy-remove-section-${i}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Compact field component (defined OUTSIDE main render so React doesn't unmount on every keystroke)
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}
const Field: React.FC<FieldProps> = ({ label, value, onChange, rows, placeholder }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    {rows ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black bg-white font-mono"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black bg-white"
      />
    )}
  </div>
);

export default PrivacyPolicyTab;
