import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import {
  getLegalDoc,
  updateLegalDoc,
  type LegalDoc,
  type PrivacySection,
} from '../../services/contentService';

const newSection = (): PrivacySection => ({
  id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  no: '',
  title: '',
  body: '',
});

interface FieldProps { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; }
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

interface LegalManagementTabProps {
  docId: string;
  defaultData: LegalDoc;
  pageTitle: string;
  pagePath: string;
  testIdPrefix: string;
}

const LegalManagementTab: React.FC<LegalManagementTabProps> = ({
  docId,
  defaultData,
  pageTitle,
  pagePath,
  testIdPrefix,
}) => {
  const [data, setData] = useState<LegalDoc>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const d = await getLegalDoc(docId, defaultData);
        if (active) setData(d);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateLegalDoc(docId, data);
      alert('Yadda saxlanıldı!');
    } catch (e) {
      console.error(e);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (field: keyof LegalDoc['hero'], value: string) =>
    setData({ ...data, hero: { ...data.hero, [field]: value } });

  const updateSection = (idx: number, field: keyof PrivacySection, value: string) => {
    const sections = [...data.sections];
    sections[idx] = { ...sections[idx], [field]: value };
    setData({ ...data, sections });
  };

  const addSection = () => {
    const next = [...data.sections, newSection()];
    next[next.length - 1].no = String(next.length).padStart(2, '0');
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
    if (!confirm('Bütün məzmunu standart versiyasına qaytarmaq istədiyinizə əminsiniz?')) return;
    setData(defaultData);
  };

  if (loading) return <div className="p-6">Yüklənir...</div>;

  return (
    <div className="space-y-6" data-testid={`${testIdPrefix}-management-tab`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#D4AF37]" />
            {pageTitle}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Saytın <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pagePath}</code> səhifəsinin tam məzmunu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetToDefault} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50" data-testid={`${testIdPrefix}-reset-default`}>
            Standartı yüklə
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid={`${testIdPrefix}-save-btn`}
            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saxlanılır...' : 'Yadda saxla'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <h3 className="text-lg font-semibold border-b pb-2">Başlıq bölməsi (Hero)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Eyebrow (üst kiçik mətn)" value={data.hero.eyebrow} onChange={(v) => updateHero('eyebrow', v)} />
          <Field label="Sağ rozet (FileText ikonalı)" value={data.hero.badgeRight} onChange={(v) => updateHero('badgeRight', v)} />
          <Field label="Başlıq — qara hissə" value={data.hero.title} onChange={(v) => updateHero('title', v)} />
          <Field label="Başlıq — qızılı hissə" value={data.hero.titleAccent} onChange={(v) => updateHero('titleAccent', v)} />
        </div>
        <Field label="Təsviri mətn (intro)" value={data.hero.intro} onChange={(v) => updateHero('intro', v)} rows={3} />
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Sol rozet (Shield ikonalı)" value={data.hero.badgeLeft} onChange={(v) => updateHero('badgeLeft', v)} />
          <Field label="Aşağı imza (italic)" value={data.signature} onChange={(v) => setData({ ...data, signature: v })} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Bölmələr ({data.sections.length})</h3>
            <p className="text-xs text-gray-500 mt-1">
              <strong>Body</strong> sahəsində <code>- Mətn</code> ilə başlayan sətirlər avtomatik maddə (bullet) kimi göstərilir. Boş sətir paraqraf ayırır.
            </p>
          </div>
          <button type="button" onClick={addSection} data-testid={`${testIdPrefix}-add-section`} className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm">
            <Plus className="h-4 w-4" /> Bölmə əlavə et
          </button>
        </div>

        <div className="space-y-4">
          {data.sections.map((s, i) => (
            <div key={s.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3" data-testid={`${testIdPrefix}-section-row-${i}`}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-7">
                  <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Yuxarı"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => moveSection(i, 1)} disabled={i === data.sections.length - 1} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Aşağı"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <Field label="No" value={s.no} onChange={(v) => updateSection(i, 'no', v)} />
                    <Field label="Başlıq" value={s.title} onChange={(v) => updateSection(i, 'title', v)} />
                  </div>
                  <Field
                    label="Body (mətn)"
                    value={s.body}
                    onChange={(v) => updateSection(i, 'body', v)}
                    rows={5}
                    placeholder={'Burada mətn yazın...\n\n- Bullet maddə 1\n- Bullet maddə 2\n\nNövbəti paraqraf'}
                  />
                </div>
                <button type="button" onClick={() => removeSection(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0 mt-7" aria-label="Sil" data-testid={`${testIdPrefix}-remove-section-${i}`}>
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

export default LegalManagementTab;
