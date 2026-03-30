import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { getTodayAllAttendance } from '../../../services/attendanceService';
import { Employee, Attendance, RealtimeWorker } from '../../../types/worker';
import { Clock, User, AlertCircle, CheckCircle2, Coffee, RefreshCw, LogIn, LogOut } from 'lucide-react';
import QRCodePanel from './QRCodePanel';

const RealTimeMonitoring: React.FC = () => {
  const [workers, setWorkers] = useState<RealtimeWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'isde' | 'yoxdur' | 'gecikmeli'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    // Auto refresh hər 10 saniyədə (daha tez yeniləmə)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadData = async () => {
    try {
      const [employees, attendances] = await Promise.all([
        getAllEmployees(),
        getTodayAllAttendance()
      ]);

      const realtimeWorkers: RealtimeWorker[] = employees.map(emp => {
        const attendance = attendances.find(a => a.isciID === emp.id);
        
        let status: RealtimeWorker['status'] = 'yoxdur';
        let statusText = 'Giriş etməyib';
        
        if (attendance) {
          if (attendance.status === 'isde') {
            status = attendance.gecikme > 0 ? 'gecikmeli' : 'isde';
            statusText = attendance.gecikme > 0 
              ? `İşdə (${attendance.gecikme}d gecikmə)` 
              : 'İşdə';
          } else if (attendance.status === 'icazeli') {
            status = 'icazeli';
            statusText = 'İcazəli';
          } else if (attendance.status === 'cixib') {
            status = 'yoxdur';
            statusText = 'Çıxış edib';
          }
        }
        
        return {
          isci: emp,
          bugunDavamiyyet: attendance,
          status,
          statusText
        };
      });

      setWorkers(realtimeWorkers);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(w => {
    if (filter === 'all') return true;
    return w.status === filter;
  });

  const stats = {
    isde: workers.filter(w => w.status === 'isde').length,
    gecikmeli: workers.filter(w => w.status === 'gecikmeli').length,
    yoxdur: workers.filter(w => w.status === 'yoxdur').length,
    icazeli: workers.filter(w => w.status === 'icazeli').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Real Vaxt İzləmə</h2>
          <p className="text-sm text-gray-500">
            Son yeniləmə: {lastUpdate.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          data-testid="refresh-monitoring-btn"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Yenilənir...' : 'Yenilə'}
        </button>
      </div>

      {/* QR Code Panel */}
      <QRCodePanel magaza="Ana mağaza" />
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filter === 'all' 
              ? 'border-slate-900 bg-slate-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <User className="w-5 h-5 text-gray-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{workers.length}</p>
          <p className="text-sm text-gray-600">Hamısı</p>
        </button>

        <button
          onClick={() => setFilter('isde')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filter === 'isde' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-green-600">{stats.isde}</p>
          <p className="text-sm text-gray-600">İşdə</p>
        </button>

        <button
          onClick={() => setFilter('gecikmeli')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filter === 'gecikmeli' 
              ? 'border-red-500 bg-red-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <AlertCircle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold text-red-600">{stats.gecikmeli}</p>
          <p className="text-sm text-gray-600">Gecikmə ilə</p>
        </button>

        <button
          onClick={() => setFilter('yoxdur')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filter === 'yoxdur' 
              ? 'border-gray-500 bg-gray-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Coffee className="w-5 h-5 text-gray-600 mb-2" />
          <p className="text-2xl font-bold text-gray-600">{stats.yoxdur}</p>
          <p className="text-sm text-gray-600">İşdə deyil</p>
        </button>
      </div>

      {/* Worker List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {filter === 'all' ? 'Bütün İşçilər' : 
             filter === 'isde' ? 'İşdə Olanlar' :
             filter === 'gecikmeli' ? 'Gecikənlər' :
             'İşdə Olmayanlar'}
          </h3>
          <span className="text-sm text-gray-500">{filteredWorkers.length} işçi</span>
        </div>

        <div className="divide-y">
          {filteredWorkers.map(worker => (
            <div key={worker.isci.id} className="p-6 hover:bg-gray-50 transition-colors" data-testid={`worker-row-${worker.isci.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                    {worker.isci.ad[0]}{worker.isci.soyad[0]}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {worker.isci.ad} {worker.isci.soyad}
                    </h4>
                    <p className="text-sm text-gray-600">{worker.isci.vezife}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    {worker.status === 'isde' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800" data-testid={`status-isde-${worker.isci.id}`}>
                        <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'gecikmeli' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800" data-testid={`status-gecikmeli-${worker.isci.id}`}>
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'icazeli' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800" data-testid={`status-icazeli-${worker.isci.id}`}>
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'yoxdur' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800" data-testid={`status-yoxdur-${worker.isci.id}`}>
                        {worker.statusText}
                      </span>
                    )}
                  </div>
                  
                  {worker.bugunDavamiyyet && (
                    <div className="flex flex-col items-end gap-1 text-sm text-gray-600">
                      {worker.bugunDavamiyyet.girisSaati && (
                        <div className="flex items-center gap-1 text-green-600">
                          <LogIn className="w-4 h-4" />
                          <span>Giriş: {new Date(worker.bugunDavamiyyet.girisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      {worker.bugunDavamiyyet.cixisSaati && (
                        <div className="flex items-center gap-1 text-red-600">
                          <LogOut className="w-4 h-4" />
                          <span>Çıxış: {new Date(worker.bugunDavamiyyet.cixisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      {worker.bugunDavamiyyet.isSaati > 0 && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>İş: {Math.floor(worker.bugunDavamiyyet.isSaati / 60)}s {worker.bugunDavamiyyet.isSaati % 60}d</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredWorkers.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              İşçi tapılmadı
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitoring;
