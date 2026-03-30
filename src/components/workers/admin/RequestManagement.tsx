import React, { useState, useEffect } from 'react';
import { 
  subscribeToPendingRequests, 
  approveRequest, 
  rejectRequest 
} from '../../../services/requestService';
import { AttendanceRequest } from '../../../types/worker';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  LogIn, 
  LogOut,
  Bell,
  RefreshCw
} from 'lucide-react';

const RequestManagement: React.FC = () => {
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    // Real-time dinləmə
    const unsubscribe = subscribeToPendingRequests((newRequests) => {
      setRequests(newRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await approveRequest(requestId);
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await rejectRequest(requestId, rejectReason);
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeDiff = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'İndi';
    if (minutes < 60) return `${minutes} dəq əvvəl`;
    const hours = Math.floor(minutes / 60);
    return `${hours} saat əvvəl`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">Gözləyən Sorğular</h2>
          {requests.length > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              {requests.length}
            </span>
          )}
        </div>
      </div>

      {/* Sorğu siyahısı */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-lg">Gözləyən sorğu yoxdur</p>
          <p className="text-gray-400 text-sm mt-2">İşçilər giriş/çıxış sorğusu göndərəndə burada görünəcək</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <div 
              key={request.id} 
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500 hover:shadow-lg transition-shadow"
              data-testid={`request-${request.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    request.nov === 'giris' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {request.nov === 'giris' ? (
                      <LogIn className="w-6 h-6 text-green-600" />
                    ) : (
                      <LogOut className="w-6 h-6 text-red-600" />
                    )}
                  </div>

                  {/* Məlumat */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {request.isciAd} {request.isciSoyad}
                    </h3>
                    <p className={`text-sm font-medium ${
                      request.nov === 'giris' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {request.nov === 'giris' ? '🚀 İşə GİRİŞ sorğusu' : '🚪 İşdən ÇIXIŞ sorğusu'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(request.sorguVaxti)}
                      </span>
                      <span className="text-indigo-600 font-medium">
                        {getTimeDiff(request.sorguVaxti)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action düymələri */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={processing === request.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    data-testid={`approve-${request.id}`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {processing === request.id ? 'Gözləyin...' : 'Təsdiq et'}
                  </button>
                  
                  <button
                    onClick={() => setShowRejectModal(request.id)}
                    disabled={processing === request.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    data-testid={`reject-${request.id}`}
                  >
                    <XCircle className="w-5 h-5" />
                    Ləğv et
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ləğv modalı */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Sorğunu ləğv et</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ləğv səbəbi (istəyə bağlı)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Səbəb yazın..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İmtina
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={processing === showRejectModal}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processing === showRejectModal ? 'Gözləyin...' : 'Ləğv et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestManagement;
