import React, { useEffect, useState } from 'react';
import { Loader2, Save, Sparkles, Building2, Tag, Shield, Package, FileText, CheckCircle2, MessageCircle, Power } from 'lucide-react';
import {
  getAiKnowledge,
  saveAiKnowledge,
  EMPTY_KNOWLEDGE,
  type AiKnowledge,
} from '../../services/aiKnowledgeService';

interface FieldConfig {
  key: keyof AiKnowledge;
  label: string;
  hint: string;
  placeholder: string;
  icon: React.ReactNode;
}

const FIELDS: FieldConfig[] = [
  {
    key: 'aiInstructions',
    label: '🎯 AI Davranış Komandaları',
    hint: 'AI-yə müştərilərlə necə danışmasını izah edin: ton, sürət, satış strategiyası, qadağan sözlər və s. Bu sahə ən prioritetlidir — AI hər şeydən əvvəl bunu nəzərə alır.',
    placeholder:
      'Müştərilərə həmişə "siz" formasında müraciət et.\nCavablar maks 3 cümlə olsun, qısa və konkret.\nİlk mesajda dərhal "salam" + "nə axtarırsınız?" soruş.\nMüştəri 200 AZN-dən aşağı büdcə deyirsə, sərfəli variantları vurğula.\nƏn yüksək marja olan brendləri (məs. Festina) prioritet təklif et.\nMüştəri tərəddüd edirsə, "ən çox satılan" sözünü işlət.\nSon mesajda mütləq müştərini "İndi al" düyməsinə yönləndir.',
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    key: 'companyInfo',
    label: 'Şirkət haqqında',
    hint: 'De Valeur şirkətinin tarixi, missiyası, ünvanları, iş saatları, əlaqə nömrələri və s.',
    placeholder:
      'Məsələn: De Valeur 2018-ci ildə Bakıda təsis olunmuş premium saat satışı şirkətidir. Mərkəz mağaza ünvanı: ...\nİş saatları: B.e–Şən 10:00–20:00, Bazar: 11:00–18:00\nƏlaqə: +994 50 123 45 67',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    key: 'brandsInfo',
    label: 'Brendlər haqqında',
    hint: 'Hər brend üçün mənşə ölkə, tarix və xüsusiyyətlər. AI bu məlumatla daha dəqiq tövsiyə verə bilər.',
    placeholder:
      'Festina — İspaniyanın 1902-ci ildə təsis olunmuş klassik saat brendi.\nPierre Lannier — Fransa, Elzas regionunda 1977-ci ildə yaradılıb, zəriflik və klassik dizayn.\nDucati — İtaliya, motosiklet brendinin saat seriyası, sportiv stil.',
    icon: <Tag className="h-4 w-4" />,
  },
  {
    key: 'policiesInfo',
    label: 'Zəmanət, çatdırılma və qaytarma',
    hint: 'Müştərilərin tez-tez soruşduğu siyasətlər. AI cavablarında bu məlumatları istifadə edəcək.',
    placeholder:
      'Zəmanət: Bütün saatlara 2 il rəsmi zəmanət verilir.\nÇatdırılma: Bakı daxili pulsuz, regionlar — 1-3 iş günü, 8 AZN.\nQaytarma: 14 gün ərzində toxunulmamış məhsulu geri qaytarmaq mümkündür.',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    key: 'productsInfo',
    label: 'Məhsullar haqqında əlavə qeydlər',
    hint: 'Konkret məhsullar/seriyalar haqqında müştəriyə deyilməli xüsusi qeydlər (məs. "X seriyası limit edilmiş buraxılışdır").',
    placeholder:
      'Festina Chrono kişi seriyası — xronoqraf funksiyası, 100m suya davamlı.\nDucati Limited Edition — yalnız 500 ədəd buraxılıb, kolleksioner üçün ideal.',
    icon: <Package className="h-4 w-4" />,
  },
  {
    key: 'additionalNotes',
    label: 'Əlavə qeydlər və FAQ',
    hint: 'Tez-tez verilən suallar, satış strategiyası, xüsusi kampaniyalar və s.',
    placeholder:
      'Hazırda fəal kampaniya: 3 saat alana 4-cüsü 50% endirimlə.\nB2B müştərilərimiz üçün xüsusi qiymətlər mövcuddur.\nKreditlə alış: 0% komissiya 6 aya qədər.',
    icon: <FileText className="h-4 w-4" />,
  },
];

const AiKnowledgeTab: React.FC = () => {
  const [data, setData] = useState<AiKnowledge>(EMPTY_KNOWLEDGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const k = await getAiKnowledge();
      setData(k);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAiKnowledge(data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3500);
    } catch (e) {
      alert('Yadda saxlanmadı: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof AiKnowledge, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleEnabled = async () => {
    const next = !data.enabled;
    const optimistic: AiKnowledge = { ...data, enabled: next };
    setData(optimistic);
    setSaving(true);
    try {
      await saveAiKnowledge(optimistic);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3500);
    } catch (e) {
      // revert on error
      setData((prev) => ({ ...prev, enabled: !next }));
      alert('Vəziyyət dəyişdirilə bilmədi: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalChars = Object.values(data)
    .filter((v): v is string => typeof v === 'string')
    .reduce((sum, v) => sum + v.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-knowledge-tab">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">AI Bilik Bazası</h2>
          </div>
          <p className="text-sm text-gray-500">
            Burada yazdığınız hər şey De Valeur AI-yə avtomatik ötürülür və müştərilərlə söhbət zamanı istifadə olunur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Yadda saxlandı
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            data-testid="ai-knowledge-save-btn"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Yadda saxla
          </button>
        </div>
      </div>

      <div
        className={`rounded-xl p-4 border flex items-center justify-between gap-4 transition-colors ${
          data.enabled
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200'
        }`}
        data-testid="ai-chat-visibility-card"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              data.enabled ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            <Power className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              Sayt-da AI Chat görünüşü
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
              {data.enabled
                ? 'Hal-hazırda AÇIQDIR — müştərilər saytın sağ-aşağı küncündə chat düyməsini görür.'
                : 'Hal-hazırda BAĞLIDIR — müştərilər heç bir chat düyməsi görmür.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={saving}
          role="switch"
          aria-checked={data.enabled}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-60 ${
            data.enabled ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
          data-testid="ai-chat-visibility-toggle"
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              data.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3">
        <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-semibold mb-1">Necə işləyir?</p>
          <p className="text-amber-800/80 leading-relaxed">
            Burada yazdığınız mətnlər AI-nin "yaddaşına" əlavə olunur. Müştəri saytın AI-si ilə söhbət edəndə, AI
            burdakı məlumatları nəzərə alaraq cavab verir. Məsələn, müştəri "Festina haradandır?" deyəndə, brendlər
            bölməsində yazdığınız "İspaniya, 1902" cavabını verəcək. Daha çox yazsanız → daha dəqiq tövsiyələr.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {FIELDS.map((field) => {
          const value = (data[field.key] as string) || '';
          return (
            <div
              key={field.key}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
                    {field.icon}
                  </div>
                  <label
                    htmlFor={`ai-knowledge-${field.key}`}
                    className="text-sm font-semibold text-gray-900 truncate"
                  >
                    {field.label}
                  </label>
                </div>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{value.length} simvol</span>
              </div>
              <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">{field.hint}</p>
              <textarea
                id={`ai-knowledge-${field.key}`}
                value={value}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={6}
                maxLength={4000}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 resize-y bg-gray-50 focus:bg-white transition-colors"
                data-testid={`ai-knowledge-${field.key}`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-gray-500">
          Cəmi: <span className="font-semibold text-gray-700">{totalChars.toLocaleString()}</span> simvol
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Yadda saxla
        </button>
      </div>
    </div>
  );
};

export default AiKnowledgeTab;
