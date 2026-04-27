import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Award, Users, Globe, TrendingUp, Star, Shield, Crown, Gem } from 'lucide-react';
import { getAboutPage, updateAboutPage, type AboutPage, type AboutStat } from '../../services/contentService';

const ICON_OPTIONS = [
  { id: 'award', label: 'Award', Icon: Award },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'globe', label: 'Globe', Icon: Globe },
  { id: 'trending-up', label: 'Trending', Icon: TrendingUp },
  { id: 'star', label: 'Star', Icon: Star },
  { id: 'shield', label: 'Shield', Icon: Shield },
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'gem', label: 'Gem', Icon: Gem },
];

const DEFAULT_STATS: AboutStat[] = [
  { icon: 'award', value_az: '6+', value_ru: '6+', value_en: '6+', label_az: 'İl Təcrübə', label_ru: 'Лет опыта', label_en: 'Years Experience' },
  { icon: 'users', value_az: '25,000+', value_ru: '25,000+', value_en: '25,000+', label_az: 'Məmnun Müştəri', label_ru: 'Довольных клиентов', label_en: 'Happy Customers' },
  { icon: 'globe', value_az: '20+', value_ru: '20+', value_en: '20+', label_az: 'Dünya Brendi', label_ru: 'Мировых брендов', label_en: 'World Brands' },
  { icon: 'trending-up', value_az: '100%', value_ru: '100%', value_en: '100%', label_az: 'Orijinal Məhsul', label_ru: 'Оригинальная продукция', label_en: 'Original Products' },
];

const AboutManagementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<AboutPage>({
    title_az: '', title_ru: '', title_en: '',
    slogan_az: '', slogan_ru: '', slogan_en: '',
    story_heading_az: '', story_heading_ru: '', story_heading_en: '',
    content_az: '', content_ru: '', content_en: '',
    mission_heading_az: '', mission_heading_ru: '', mission_heading_en: '',
    mission_az: '', mission_ru: '', mission_en: '',
    image_url: '',
    stats: DEFAULT_STATS,
  });

  useEffect(() => {
    loadAboutPage();
  }, []);

  const loadAboutPage = async () => {
    try {
      setLoading(true);
      const data = await getAboutPage();
      if (data) {
        setFormData({
          title_az: data.title_az || '',
          title_ru: data.title_ru || '',
          title_en: data.title_en || '',
          slogan_az: data.slogan_az || '',
          slogan_ru: data.slogan_ru || '',
          slogan_en: data.slogan_en || '',
          story_heading_az: data.story_heading_az || '',
          story_heading_ru: data.story_heading_ru || '',
          story_heading_en: data.story_heading_en || '',
          content_az: data.content_az || '',
          content_ru: data.content_ru || '',
          content_en: data.content_en || '',
          mission_heading_az: data.mission_heading_az || '',
          mission_heading_ru: data.mission_heading_ru || '',
          mission_heading_en: data.mission_heading_en || '',
          mission_az: data.mission_az || '',
          mission_ru: data.mission_ru || '',
          mission_en: data.mission_en || '',
          image_url: data.image_url || '',
          stats: (data.stats && data.stats.length > 0) ? data.stats : DEFAULT_STATS,
        });
      }
    } catch (error) {
      console.error('Error loading about page:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateAboutPage(formData);
      alert('Yadda saxlanıldı!');
    } catch (error) {
      console.error('Error saving about page:', error);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const updateStat = (index: number, field: keyof AboutStat, value: string) => {
    const stats = [...(formData.stats || [])];
    stats[index] = { ...stats[index], [field]: value };
    setFormData({ ...formData, stats });
  };

  const addStat = () => {
    const stats = [...(formData.stats || []), {
      icon: 'star', value_az: '', value_ru: '', value_en: '',
      label_az: '', label_ru: '', label_en: '',
    }];
    setFormData({ ...formData, stats });
  };

  const removeStat = (index: number) => {
    const stats = (formData.stats || []).filter((_, i) => i !== index);
    setFormData({ ...formData, stats });
  };

  if (loading) {
    return <div className="p-6">Yüklənir...</div>;
  }

  const TextField = ({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) => {
    if (rows) {
      return (
        <div>
          <label className="block text-sm font-medium mb-2">{label}</label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
          />
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium mb-2">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="about-management-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Haqqımızda Səhifəsi</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          data-testid="about-save-btn"
          className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saxlanılır...' : 'Yadda saxla'}
        </button>
      </div>

      {/* Header section */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <h3 className="text-lg font-semibold border-b pb-2">Səhifə Başlığı və Sloqan</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <TextField label="Başlıq (AZ)" value={formData.title_az} onChange={(v) => setFormData({ ...formData, title_az: v })} />
          <TextField label="Başlıq (RU)" value={formData.title_ru} onChange={(v) => setFormData({ ...formData, title_ru: v })} />
          <TextField label="Başlıq (EN)" value={formData.title_en} onChange={(v) => setFormData({ ...formData, title_en: v })} />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <TextField label="Sloqan (AZ)" value={formData.slogan_az || ''} onChange={(v) => setFormData({ ...formData, slogan_az: v })} />
          <TextField label="Sloqan (RU)" value={formData.slogan_ru || ''} onChange={(v) => setFormData({ ...formData, slogan_ru: v })} />
          <TextField label="Sloqan (EN)" value={formData.slogan_en || ''} onChange={(v) => setFormData({ ...formData, slogan_en: v })} />
        </div>
      </div>

      {/* Story section */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <h3 className="text-lg font-semibold border-b pb-2">Bizim Hekayəmiz</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <TextField label="Hekayə Başlığı (AZ)" value={formData.story_heading_az || ''} onChange={(v) => setFormData({ ...formData, story_heading_az: v })} />
          <TextField label="Hekayə Başlığı (RU)" value={formData.story_heading_ru || ''} onChange={(v) => setFormData({ ...formData, story_heading_ru: v })} />
          <TextField label="Hekayə Başlığı (EN)" value={formData.story_heading_en || ''} onChange={(v) => setFormData({ ...formData, story_heading_en: v })} />
        </div>
        <TextField label="Məzmun (AZ)" value={formData.content_az} onChange={(v) => setFormData({ ...formData, content_az: v })} rows={6} />
        <TextField label="Məzmun (RU)" value={formData.content_ru} onChange={(v) => setFormData({ ...formData, content_ru: v })} rows={6} />
        <TextField label="Məzmun (EN)" value={formData.content_en} onChange={(v) => setFormData({ ...formData, content_en: v })} rows={6} />

        <div>
          <label className="block text-sm font-medium mb-2">Şəkil URL</label>
          <input
            type="text"
            value={formData.image_url || ''}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
            placeholder="https://example.com/image.jpg"
          />
          {formData.image_url && (
            <img src={formData.image_url} alt="Preview" className="mt-3 w-full max-w-md h-48 object-cover rounded-lg" />
          )}
        </div>
      </div>

      {/* Statistics section */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-lg font-semibold">Statistikalar</h3>
          <button
            onClick={addStat}
            data-testid="add-stat-btn"
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
          >
            <Plus className="h-4 w-4" /> Əlavə et
          </button>
        </div>

        <div className="space-y-4">
          {(formData.stats || []).map((stat, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3" data-testid={`stat-row-${index}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Statistika #{index + 1}</span>
                <button
                  onClick={() => removeStat(index)}
                  data-testid={`remove-stat-${index}`}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">İkon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map(({ id, Icon }) => (
                    <button
                      key={id}
                      onClick={() => updateStat(index, 'icon', id)}
                      type="button"
                      className={`p-2 rounded-lg border transition ${stat.icon === id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}
                      title={id}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <TextField label="Dəyər (AZ)" value={stat.value_az} onChange={(v) => updateStat(index, 'value_az', v)} />
                <TextField label="Dəyər (RU)" value={stat.value_ru} onChange={(v) => updateStat(index, 'value_ru', v)} />
                <TextField label="Dəyər (EN)" value={stat.value_en} onChange={(v) => updateStat(index, 'value_en', v)} />
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <TextField label="Etiket (AZ)" value={stat.label_az} onChange={(v) => updateStat(index, 'label_az', v)} />
                <TextField label="Etiket (RU)" value={stat.label_ru} onChange={(v) => updateStat(index, 'label_ru', v)} />
                <TextField label="Etiket (EN)" value={stat.label_en} onChange={(v) => updateStat(index, 'label_en', v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission section */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
        <h3 className="text-lg font-semibold border-b pb-2">Missiyamız</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <TextField label="Missiya Başlığı (AZ)" value={formData.mission_heading_az || ''} onChange={(v) => setFormData({ ...formData, mission_heading_az: v })} />
          <TextField label="Missiya Başlığı (RU)" value={formData.mission_heading_ru || ''} onChange={(v) => setFormData({ ...formData, mission_heading_ru: v })} />
          <TextField label="Missiya Başlığı (EN)" value={formData.mission_heading_en || ''} onChange={(v) => setFormData({ ...formData, mission_heading_en: v })} />
        </div>
        <TextField label="Missiya Mətni (AZ)" value={formData.mission_az} onChange={(v) => setFormData({ ...formData, mission_az: v })} rows={4} />
        <TextField label="Missiya Mətni (RU)" value={formData.mission_ru} onChange={(v) => setFormData({ ...formData, mission_ru: v })} rows={4} />
        <TextField label="Missiya Mətni (EN)" value={formData.mission_en} onChange={(v) => setFormData({ ...formData, mission_en: v })} rows={4} />
      </div>
    </div>
  );
};

export default AboutManagementTab;
