import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Briefcase, Eye, EyeOff } from 'lucide-react';
import { getVacancies, updateVacancies, type Vacancy } from '../../services/contentService';

const newVacancy = (): Vacancy => ({
  id: `vac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: '',
  department: '',
  location: 'Bakı',
  type: 'Tam ştat',
  description: '',
  contactEmail: 'hr@devaleur.az',
  isOpen: true,
  createdAt: new Date().toISOString(),
});

interface FieldProps { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; }
const Field: React.FC<FieldProps> = ({ label, value, onChange, rows, placeholder }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    {rows ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black bg-white font-mono" />
    ) : (
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black bg-white" />
    )}
  </div>
);

const CareersTab: React.FC = () => {
  const [items, setItems] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await getVacancies();
        setItems(v);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateVacancies(items);
      alert('Yadda saxlanıldı!');
    } catch (e) {
      console.error(e);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const update = (idx: number, patch: Partial<Vacancy>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const add = () => {
    const v = newVacancy();
    setItems([v, ...items]);
    setExpandedId(v.id);
  };

  const remove = (idx: number) => {
    if (!confirm('Bu vakansiyanı silmək istədiyinizə əminsiniz?')) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  if (loading) return <div className="p-6">Yüklənir...</div>;

  return (
    <div className="space-y-6" data-testid="careers-management-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-[#D4AF37]" />
            Karyera / Vakansiyalar
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Saytın <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/careers</code> səhifəsində açıq vakansiyalar göstərilir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={add} data-testid="career-add-btn" className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 text-sm border border-gray-200">
            <Plus className="h-4 w-4" /> Vakansiya əlavə et
          </button>
          <button onClick={handleSave} disabled={saving} data-testid="career-save-btn"
            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400">
            <Save className="h-5 w-5" />
            {saving ? 'Saxlanılır...' : 'Yadda saxla'}
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">Hələ vakansiya yoxdur. "Vakansiya əlavə et" düyməsinə basın.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((v, i) => {
          const expanded = expandedId === v.id;
          return (
            <div key={v.id} className={`border rounded-xl bg-white overflow-hidden transition-all ${
              expanded ? 'border-[#D4AF37]/40 shadow-md' : 'border-gray-200'
            }`} data-testid={`vacancy-row-${i}`}>
              <div className="flex items-center gap-3 p-4 bg-gray-50/50 border-b border-gray-100">
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Yuxarı"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Aşağı"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={() => setExpandedId(expanded ? null : v.id)} className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{v.title || <span className="italic text-gray-400">Başlıqsız vakansiya</span>}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-2">
                    {v.department && <span>{v.department}</span>}
                    {v.location && <span>· {v.location}</span>}
                    {v.type && <span>· {v.type}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${v.isOpen ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {v.isOpen ? 'Açıq' : 'Bağlı'}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => update(i, { isOpen: !v.isOpen })}
                  className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                  title={v.isOpen ? 'Vakansiyanı bağla' : 'Vakansiyanı aç'}
                  data-testid={`vacancy-toggle-${i}`}
                >
                  {v.isOpen ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => remove(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Sil" data-testid={`vacancy-remove-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {expanded && (
                <div className="p-5 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Vəzifə adı" value={v.title} onChange={(val) => update(i, { title: val })} placeholder="məs: Mağaza məsləhətçisi" />
                    <Field label="Şöbə / Departament" value={v.department} onChange={(val) => update(i, { department: val })} placeholder="məs: Satış" />
                    <Field label="Yerləşmə" value={v.location} onChange={(val) => update(i, { location: val })} placeholder="məs: Bakı, Port Baku Mall" />
                    <Field label="İş növü" value={v.type} onChange={(val) => update(i, { type: val })} placeholder="məs: Tam ştat" />
                  </div>
                  <Field
                    label="Vakansiya təsviri"
                    value={v.description}
                    onChange={(val) => update(i, { description: val })}
                    rows={8}
                    placeholder={'Vəzifə öhdəlikləri:\n\n- Müştərilərə xidmət göstərmək\n- Məhsulları təqdim etmək\n\nNamizədə tələblər:\n\n- Ünsiyyət bacarığı\n- Ali təhsil arzu olunandır'}
                  />
                  <Field label="Müraciət üçün email" value={v.contactEmail} onChange={(val) => update(i, { contactEmail: val })} placeholder="hr@devaleur.az" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CareersTab;
