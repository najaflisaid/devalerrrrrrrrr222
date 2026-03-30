import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorker } from '../../context/WorkerContext';
import { 
  LogOut, 
  Clock, 
  TrendingUp, 
  Award, 
  DollarSign,
  Calendar,
  Target,
  Activity,
  Scan
} from 'lucide-react';
import { 
  getTodayAttendance, 
  getRecentAttendance,
  getMonthlyAttendance
} from '../../services/attendanceService';
import { getLatestPerformance } from '../../services/performanceService';
import { getEmployeeBadges } from '../../services/badgeService';
import { getMonthlyBonus } from '../../services/bonusService';
import { getMonthlySales } from '../../services/salesService';
import { Attendance, Performance, Badge, Bonus } from '../../types/worker';

const WorkerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { employee, logout, loading: authLoading } = useWorker();
  
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [recentAttendances, setRecentAttendances] = useState<Attendance[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [monthlyStats, setMonthlyStats] = useState({
    totalWorkHours: 0,
    lateCount: 0,
    salesAmount: 0,
    salesTarget: 50000
  });

  useEffect(() => {
    if (!authLoading && !employee) {
      navigate('/workers');
      return;
    }
    
    if (employee) {
      loadData();
    }
  }, [employee, authLoading, navigate]);

  const loadData = async () => {
    if (!employee) return;
    
    try {
      setLoading(true);
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Paralel yükleme
      const [
        todayAtt,
        recentAtt,
        perf,
        badgeList,
        bonusData,
        monthlyAtt,
        sales
      ] = await Promise.all([
        getTodayAttendance(employee.id),
        getRecentAttendance(employee.id, 7),
        getLatestPerformance(employee.id),
        getEmployeeBadges(employee.id),
        getMonthlyBonus(employee.id, currentMonth),
        getMonthlyAttendance(employee.id, currentMonth),
        getMonthlySales(employee.id, currentMonth)
      ]);
      
      setTodayAttendance(todayAtt);
      setRecentAttendances(recentAtt);
      setPerformance(perf);
      setBadges(badgeList);
      setBonus(bonusData);
      
      // Aylıq statistika hesabla
      const totalMinutes = monthlyAtt.reduce((sum, att) => sum + att.isSaati, 0);
      const totalHours = Math.floor(totalMinutes / 60);
      const lateCount = monthlyAtt.filter(att => att.gecikme > 0).length;
      const salesAmount = sales.reduce((sum, sale) => sum + sale.mebleg, 0);
      
      setMonthlyStats({
        totalWorkHours: totalHours,
        lateCount,
        salesAmount,
        salesTarget: 50000
      });
      
    } catch (error) {
      console.error('Data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/workers');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  const salesProgress = (monthlyStats.salesAmount / monthlyStats.salesTarget) * 100;
  const performanceColor = performance 
    ? performance.umumi >= 90 ? 'text-green-600' 
    : performance.umumi >= 80 ? 'text-blue-600' 
    : 'text-orange-600'
    : 'text-gray-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {employee.ad[0]}{employee.soyad[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {employee.ad} {employee.soyad}
                </h1>
                <p className="text-sm text-gray-600">{employee.vezife}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Çıxış</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Bugünkü Status Kartı */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-8 text-white mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-indigo-100 mb-2">Bugünkü Status</p>
              <h2 className="text-3xl font-bold mb-4" data-testid="today-status">
                {todayAttendance 
                  ? todayAttendance.status === 'isde' 
                    ? '🟢 İşdəsiniz' 
                    : '⏹️ Çıxış etmisiniz'
                  : '⚪ Giriş etməmisiniz'}
              </h2>
              
              {todayAttendance && (
                <div className="space-y-2">
                  <p className="text-indigo-100 flex items-center gap-2">
                    <span className="text-green-300">▶</span>
                    Giriş: {todayAttendance.girisSaati ? new Date(todayAttendance.girisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                  {todayAttendance.cixisSaati && (
                    <p className="text-indigo-100 flex items-center gap-2">
                      <span className="text-red-300">■</span>
                      Çıxış: {new Date(todayAttendance.cixisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {todayAttendance.isSaati > 0 && (
                    <p className="text-indigo-100 flex items-center gap-2">
                      <span className="text-yellow-300">⏱</span>
                      İş müddəti: {Math.floor(todayAttendance.isSaati / 60)}s {todayAttendance.isSaati % 60}d
                    </p>
                  )}
                  {todayAttendance.gecikme > 0 && (
                    <p className="text-yellow-300 flex items-center gap-2">
                      ⚠️ Gecikmə: {todayAttendance.gecikme} dəqiqə
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div>
              {(!todayAttendance || todayAttendance.status === 'isde') ? (
                <div className="bg-white/20 px-6 py-4 rounded-xl text-center" data-testid="qr-instruction">
                  <Scan className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">
                    {!todayAttendance ? 'Giriş üçün mağazadakı QR kodu skan edin' : 'Çıxış üçün mağazadakı QR kodu skan edin'}
                  </p>
                </div>
              ) : (
                <div className="bg-white/20 px-8 py-4 rounded-xl text-center" data-testid="work-completed">
                  <p className="text-lg font-medium">✅ Bu gün işiniz bitib</p>
                  <p className="text-sm text-indigo-100 mt-1">Xoş istirahət!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistika Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Bu ay iş saatı */}
          <div className="bg-white rounded-xl shadow-md p-6" data-testid="work-hours-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-1">Bu Ay İş Saatı</h3>
            <p className="text-3xl font-bold text-gray-900">{monthlyStats.totalWorkHours}<span className="text-lg text-gray-600">s</span></p>
          </div>

          {/* Performans Balı */}
          <div className="bg-white rounded-xl shadow-md p-6" data-testid="performance-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              {performance && (
                <span className={`text-sm font-semibold ${performanceColor}`}>
                  Reytinq #{performance.reytinq || '-'}
                </span>
              )}
            </div>
            <h3 className="text-gray-600 text-sm mb-1">Performans Balı</h3>
            <p className={`text-3xl font-bold ${performanceColor}`}>
              {performance ? performance.umumi : '-'}<span className="text-lg text-gray-600">/100</span>
            </p>
          </div>

          {/* Bonus */}
          <div className="bg-white rounded-xl shadow-md p-6" data-testid="bonus-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-1">Bu Ay Bonus</h3>
            <p className="text-3xl font-bold text-gray-900">
              {bonus ? `${bonus.mebleg}₼` : '0₼'}
            </p>
            {bonus && (
              <p className="text-xs text-gray-500 mt-1">{bonus.sebeb}</p>
            )}
          </div>

          {/* Gecikmə */}
          <div className="bg-white rounded-xl shadow-md p-6" data-testid="late-count-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm mb-1">Gecikmə Sayı</h3>
            <p className="text-3xl font-bold text-gray-900">{monthlyStats.lateCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol sütun - Satış hədəfi və Badgelər */}
          <div className="lg:col-span-1 space-y-6">
            {/* Satış Hədəfi */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-900">Satış Hədəfi</h3>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Cari / Hədəf</span>
                  <span className="font-semibold text-gray-900">
                    {monthlyStats.salesAmount.toLocaleString()}₼ / {monthlyStats.salesTarget.toLocaleString()}₼
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(salesProgress, 100)}%` }}
                  ></div>
                </div>
                <p className="text-right text-sm text-gray-600 mt-1">
                  {salesProgress.toFixed(1)}%
                </p>
              </div>
              
              {salesProgress < 100 && (
                <p className="text-sm text-gray-600">
                  Hədəfə {(monthlyStats.salesTarget - monthlyStats.salesAmount).toLocaleString()}₼ qalıb
                </p>
              )}
            </div>

            {/* Badgelər */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <Award className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-bold text-gray-900">Nailiyyətlər</h3>
              </div>
              
              {badges.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {badges.map(badge => (
                    <div 
                      key={badge.id}
                      className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg p-3 text-center"
                    >
                      <div className="text-3xl mb-2">{badge.icon}</div>
                      <p className="text-xs font-semibold text-gray-800">{badge.ad}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">
                  Hələ badge qazanmamısınız
                </p>
              )}
            </div>
          </div>

          {/* Sağ sütun - Son davamiyyət */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">Son Davamiyyət</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tarix</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Giriş</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Çıxış</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">İş Saatı</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendances.map(att => (
                      <tr key={att.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(att.tarix).toLocaleDateString('az-AZ', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {att.girisSaati ? new Date(att.girisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {att.cixisSaati ? new Date(att.cixisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {att.isSaati ? `${Math.floor(att.isSaati / 60)}s ${att.isSaati % 60}d` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {att.gecikme > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {att.gecikme}d gecikmə
                            </span>
                          )}
                          {att.gecikme === 0 && att.status === 'cixib' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
