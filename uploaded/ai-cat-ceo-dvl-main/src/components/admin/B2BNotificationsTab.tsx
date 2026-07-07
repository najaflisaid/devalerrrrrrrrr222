import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, X, Loader2, AlertCircle, AlertTriangle, CheckCircle, Info, Eye } from 'lucide-react';
import { 
  getAllB2BNotifications, 
  addB2BNotification, 
  deleteB2BNotification,
  B2BNotification,
  NotificationType,
  NotificationPriority
} from '../../services/b2bNotificationService';

const B2BNotificationsTab: React.FC = () => {
  const [notifications, setNotifications] = useState<B2BNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as NotificationType,
    priority: 'medium' as NotificationPriority,
    expiresAt: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getAllB2BNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      alert('Başlıq və mesaj daxil edin');
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = formData.expiresAt ? new Date(formData.expiresAt) : undefined;
      await addB2BNotification(
        formData.title, 
        formData.message, 
        formData.type,
        formData.priority,
        expiresAt
      );
      setFormData({ title: '', message: '', type: 'info', priority: 'medium', expiresAt: '' });
      setShowAddForm(false);
      await loadNotifications();
      alert('Bildiriş əlavə edildi!');
    } catch (error) {
      console.error('Error adding notification:', error);
      alert('Xəta baş verdi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bildirişi silmək istədiyinizə əminsiniz?')) return;
    
    try {
      await deleteB2BNotification(id);
      await loadNotifications();
      alert('Bildiriş silindi');
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Xəta baş verdi');
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getTypeConfig = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Uğurlu' };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50', label: 'Xəbərdarlıq' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'Xəta' };
      default:
        return { icon: Info, color: 'text-blue-600 bg-blue-50', label: 'Məlumat' };
    }
  };

  const getPriorityConfig = (priority: NotificationPriority) => {
    switch (priority) {
      case 'high':
        return { color: 'text-red-600', label: 'Yüksək' };
      case 'low':
        return { color: 'text-gray-600', label: 'Aşağı' };
      default:
        return { color: 'text-orange-600', label: 'Orta' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">B2B Bildirişlər</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Bildiriş
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Bu bildirişlər B2B müştərilər giriş etdikdə onlara göstəriləcək.
      </p>

      {/* Əlavə etmə formu */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Yeni Bildiriş</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Başlıq *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="Bildiriş başlığı"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mesaj *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                rows={4}
                placeholder="Bildiriş mətni"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Növ *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="info">Məlumat</option>
                  <option value="success">Uğurlu</option>
                  <option value="warning">Xəbərdarlıq</option>
                  <option value="error">Xəta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prioritet *</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as NotificationPriority })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="low">Aşağı</option>
                  <option value="medium">Orta</option>
                  <option value="high">Yüksək</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bitmə tarixi (istəyə bağlı)</label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Boş buraxsanız, bildiriş silinənə qədər görünəcək</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium disabled:opacity-50"
            >
              {submitting ? 'Əlavə edilir...' : 'Bildiriş əlavə et'}
            </button>
          </form>
        </div>
      )}

      {/* Bildirişlər siyahısı */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Bildiriş yoxdur</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const typeConfig = getTypeConfig(notif.type);
            const priorityConfig = getPriorityConfig(notif.priority);
            const TypeIcon = typeConfig.icon;
            const readCount = notif.readBy?.length || 0;
            
            return (
              <div
                key={notif.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${typeConfig.color}`}>
                        <TypeIcon className="h-3 w-3" />
                        <span className="text-xs font-medium">{typeConfig.label}</span>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig.color} bg-gray-50`}>
                        {priorityConfig.label}
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">{readCount} oxunub</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{notif.title}</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{notif.message}</p>
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      <span>Yaradılıb: {formatDate(notif.createdAt)}</span>
                      {notif.expiresAt && (
                        <span>Bitmə: {formatDate(notif.expiresAt)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(notif.id!)}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default B2BNotificationsTab;
