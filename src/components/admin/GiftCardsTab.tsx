import React, { useEffect, useState } from 'react';
import { Gift, Plus, Trash2, Save, X, Send, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productService } from '../../services/productService';
import { createGiftCardPromoCode, type PromoCode } from '../../services/promoCodeService';
import type { Product } from '../../types';

interface FormState {
  id?: string;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  descAz: string;
  descEn: string;
  descRu: string;
  price: string;
  imageUrl: string;
  isEnabled: boolean;
}

const empty: FormState = {
  nameAz: '',
  nameEn: '',
  nameRu: '',
  descAz: '',
  descEn: '',
  descRu: '',
  price: '',
  imageUrl: '',
  isEnabled: true,
};

const GiftCardsTab: React.FC = () => {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  // Influencer/Bloger üçün hədiyyə kartı göndərmə state-i
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    recipientName: '',
    recipientPhone: '',
    amount: '',
    message: '',
    senderName: 'DE VALEUR',
  });
  const [sendingCard, setSendingCard] = useState(false);
  const [sentCard, setSentCard] = useState<PromoCode | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('isGiftCard', '==', true)));
      const list: Product[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as any), id: d.id } as Product));
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
      setItems(list);
    } catch (e) {
      console.error(e);
      alert('Yükləmə xətası: ' + (e as any)?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setForm(empty);
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setForm({
      id: p.id,
      nameAz: p.name?.az || '',
      nameEn: p.name?.en || '',
      nameRu: p.name?.ru || '',
      descAz: p.description?.az || '',
      descEn: p.description?.en || '',
      descRu: p.description?.ru || '',
      price: String(p.price || ''),
      imageUrl: p.images?.[0] || '',
      isEnabled: p.isEnabled !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const price = parseFloat(form.price);
    if (!form.nameAz.trim() && !form.nameEn.trim()) {
      alert('Ən azı bir dildə ad daxil edin');
      return;
    }
    if (!price || price <= 0) {
      alert('Düzgün qiymət daxil edin');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: {
          az: form.nameAz.trim() || form.nameEn.trim(),
          en: form.nameEn.trim() || form.nameAz.trim(),
          ru: form.nameRu.trim() || form.nameAz.trim() || form.nameEn.trim(),
        },
        description: {
          az: form.descAz.trim(),
          en: form.descEn.trim(),
          ru: form.descRu.trim(),
        },
        price,
        images: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
        category: 'gift-card',
        brand: 'De Valeur',
        gender: 'unisex' as const,
        isEnabled: form.isEnabled,
        isGiftCard: true,
        stock: 9999,
      };

      if (form.id) {
        await productService.update(form.id, payload);
      } else {
        await productService.add(payload);
      }

      setShowForm(false);
      setForm(empty);
      await load();
    } catch (e: any) {
      console.error(e);
      alert('Yadda saxlama xətası: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`"${p.name?.az || p.name?.en}" hədiyyə kartını silmək istəyirsinizmi?`)) return;
    try {
      await productService.delete(p.id);
      await load();
    } catch (e: any) {
      alert('Silmə xətası: ' + e?.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-6 h-6" /> Hədiyyə Kartları
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Müştərilər bu kartı alanda hesabları üçün avtomatik unikal promo kod yaranır.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSentCard(null);
              setSendForm({
                recipientName: '',
                recipientPhone: '',
                amount: '',
                message: '',
                senderName: 'DE VALEUR',
              });
              setShowSendModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            data-testid="send-influencer-card-btn"
          >
            <Send className="w-4 h-4" /> Influencer-ə Göndər
          </button>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            data-testid="gift-cards-add-btn"
          >
            <Plus className="w-4 h-4" /> Yeni Hədiyyə Kartı
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Hələ hədiyyə kartı yoxdur. "Yeni Hədiyyə Kartı" düyməsi ilə əlavə edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden" data-testid={`gift-card-row-${p.id}`}>
              <div className="aspect-[16/10] bg-gradient-to-br from-black to-[#2a2218] relative overflow-hidden">
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name?.az} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                )}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">De Valeur</p>
                  <p className="text-xl font-medium">{p.price.toFixed(0)} AZN</p>
                </div>
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-900 mb-1">{p.name?.az || p.name?.en}</p>
                <p className="text-xs text-gray-500 mb-3">
                  {p.isEnabled ? '✓ Aktiv' : '○ Deaktiv'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded"
                    data-testid={`gift-card-edit-${p.id}`}
                  >
                    Redaktə et
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="px-3 py-2 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded inline-flex items-center gap-1"
                    data-testid={`gift-card-delete-${p.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? 'Hədiyyə Kartını Redaktə Et' : 'Yeni Hədiyyə Kartı'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Bağla"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qiymət (AZN) *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="100"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                  data-testid="gift-card-form-price"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Müştəri bu kartı alanda eyni dəyərdə promo kod alacaq.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ad (AZ)</label>
                  <input
                    type="text"
                    value={form.nameAz}
                    onChange={(e) => setForm({ ...form, nameAz: e.target.value })}
                    placeholder="100 AZN Hədiyyə"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                    data-testid="gift-card-form-name-az"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name (EN)</label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="100 AZN Gift"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Имя (RU)</label>
                  <input
                    type="text"
                    value={form.nameRu}
                    onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
                    placeholder="100 AZN Подарок"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şəkil URL (istəyə bağlı)</label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  data-testid="gift-card-form-image"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıqlama (AZ)</label>
                <textarea
                  rows={2}
                  value={form.descAz}
                  onChange={(e) => setForm({ ...form, descAz: e.target.value })}
                  placeholder="Sevdiklərinizə hədiyyə üçün ideal..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Aktiv (saytda göstər)</span>
              </label>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ləğv et
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
                data-testid="gift-card-form-save"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Yadda saxlanılır...' : 'Yadda saxla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Influencer-ə Hədiyyə Kartı Göndər Modalı === */}
      {showSendModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" data-testid="send-influencer-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-600" />
                  Influencer-ə Hədiyyə Kartı Göndər
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bloger / influencer üçün ödənişsiz hədiyyə kartı yaradın və paylaşma linki əldə edin
                </p>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Bağla"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!sentCard ? (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alıcının adı *</label>
                    <input
                      type="text"
                      value={sendForm.recipientName}
                      onChange={(e) => setSendForm({ ...sendForm, recipientName: e.target.value })}
                      placeholder="Məs: Aysel Quliyeva"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                      data-testid="send-recipient-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Məbləğ (AZN) *</label>
                    <input
                      type="number"
                      value={sendForm.amount}
                      onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                      placeholder="500"
                      min={1}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                      data-testid="send-amount"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp nömrəsi <span className="text-gray-400 font-normal">(istəyə bağlı)</span>
                  </label>
                  <input
                    type="tel"
                    value={sendForm.recipientPhone}
                    onChange={(e) => setSendForm({ ...sendForm, recipientPhone: e.target.value })}
                    placeholder="+994551234567"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                    data-testid="send-phone"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Daxil edilərsə, hazır WhatsApp linki yaranar
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Göndərənin adı</label>
                  <input
                    type="text"
                    value={sendForm.senderName}
                    onChange={(e) => setSendForm({ ...sendForm, senderName: e.target.value })}
                    placeholder="DE VALEUR"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şəxsi mesaj</label>
                  <textarea
                    rows={3}
                    value={sendForm.message}
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                    placeholder="Əməkdaşlığımız üçün təşəkkür edirik..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    data-testid="send-message"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <strong>Qeyd:</strong> Bu kart admin tərəfindən pulsuz yaradılır (heç bir ödəniş alınmır). Alıcı paylaşma linki ilə kodu görəcək və checkout-da promo kod kimi istifadə edə biləcək.
                </div>
              </div>
            ) : (
              /* Card yaradıldıqdan sonra paylaşma ekranı */
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-900">Hədiyyə kartı yaradıldı!</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Aşağıdakı link və ya kodu paylaşa bilərsiniz
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-950 to-black rounded-xl p-5 text-center text-white">
                  <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/80 mb-1">Kod</p>
                  <p className="font-mono text-3xl tracking-[0.3em] mb-2">{sentCard.code}</p>
                  <p className="text-xs text-amber-200/80">Dəyər: {sentCard.amountAZN || 0} AZN</p>
                </div>

                {(() => {
                  const shareUrl = `${window.location.origin}/gift-card/${sentCard.code}`;
                  const waText = encodeURIComponent(
                    `${sendForm.recipientName || 'Hörmətli istifadəçi'}, sizə DE VALEUR-dan ${sentCard.amountAZN} AZN dəyərində hədiyyə kartı göndərildi! ${shareUrl}`
                  );
                  const waPhone = sendForm.recipientPhone.replace(/\D/g, '');
                  const waLink = waPhone
                    ? `https://wa.me/${waPhone}?text=${waText}`
                    : `https://wa.me/?text=${waText}`;
                  return (
                    <>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Paylaşma linki</p>
                        <p className="text-xs font-mono text-gray-800 break-all mb-2">{shareUrl}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(shareUrl);
                                setCopiedLink(true);
                                setTimeout(() => setCopiedLink(false), 2000);
                              } catch { /* ignore */ }
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                            data-testid="copy-share-link"
                          >
                            {copiedLink ? (
                              <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopyalandı</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> Linki kopyala</>
                            )}
                          </button>
                          <a
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Aç
                          </a>
                        </div>
                      </div>

                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
                        data-testid="send-via-whatsapp"
                      >
                        <MessageCircle className="w-5 h-5" />
                        {sendForm.recipientPhone ? 'WhatsApp ilə birbaşa göndər' : 'WhatsApp ilə paylaş'}
                      </a>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {!sentCard ? (
                <>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    Ləğv et
                  </button>
                  <button
                    onClick={async () => {
                      const amount = parseFloat(sendForm.amount);
                      if (!sendForm.recipientName.trim()) {
                        alert('Alıcının adını daxil edin');
                        return;
                      }
                      if (!amount || amount <= 0) {
                        alert('Düzgün məbləğ daxil edin');
                        return;
                      }
                      setSendingCard(true);
                      try {
                        const created = await createGiftCardPromoCode(
                          amount,
                          'admin_influencer',
                          undefined,
                          {
                            senderName: sendForm.senderName.trim() || 'DE VALEUR',
                            recipientName: sendForm.recipientName.trim(),
                            recipientPhone: sendForm.recipientPhone.trim(),
                            message: sendForm.message.trim(),
                            source: 'admin_influencer',
                          }
                        );
                        setSentCard(created);
                      } catch (e: any) {
                        alert('Kart yaradılmadı: ' + (e?.message || 'Bilinməyən xəta'));
                      } finally {
                        setSendingCard(false);
                      }
                    }}
                    disabled={sendingCard}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                    data-testid="create-influencer-card"
                  >
                    <Send className="w-4 h-4" />
                    {sendingCard ? 'Yaradılır...' : 'Kart Yarat və Paylaş'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowSendModal(false)}
                  className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  data-testid="close-send-modal"
                >
                  Bağla
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftCardsTab;
