import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { getTodayAllAttendance } from '../../../services/attendanceService';
import { Employee, Attendance, RealtimeWorker } from '../../../types/worker';
import { Clock, User, AlertCircle, CheckCircle2, Coffee } from 'lucide-react';

const RealTimeMonitoring: React.FC = () => {
  const [workers, setWorkers] = useState<RealtimeWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'isde' | 'yoxdur' | 'gecikmeli'>('all');

  useEffect(() => {
    loadData();
    // Auto refresh hər 30 saniyədə
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [employees, attendances] = await Promise.all([
        getAllEmployees(),
        getTodayAllAttendance()
      ]);

      const realtimeWorkers: RealtimeWorker[] = employees.map(emp => {
        const attendance = attendances.find(a => a.isciID === emp.id);
        
        let status: RealtimeWorker['status'] = 'yoxdur';
        let statusText = 'İşdə deyil';
        
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
            statusText = 'Çıxıb';
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
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">
            {filter === 'all' ? 'Bütün İşçilər' : 
             filter === 'isde' ? 'İşdə Olanlar' :
             filter === 'gecikmeli' ? 'Gecikənlər' :
             'İşdə Olmayanlar'}
          </h3>
        </div>

        <div className="divide-y">
          {filteredWorkers.map(worker => (
            <div key={worker.isci.id} className="p-6 hover:bg-gray-50 transition-colors">
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
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'gecikmeli' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'icazeli' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {worker.statusText}
                      </span>
                    )}
                    {worker.status === 'yoxdur' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {worker.statusText}
                      </span>
                    )}
                  </div>
                  
                  {worker.bugunDavamiyyet && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {worker.bugunDavamiyyet.girisSaati 
                          ? new Date(worker.bugunDavamiyyet.girisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                        {worker.bugunDavamiyyet.cixisSaati && (
                          <> - {new Date(worker.bugunDavamiyyet.cixisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</>
                        )}
                      </span>
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
