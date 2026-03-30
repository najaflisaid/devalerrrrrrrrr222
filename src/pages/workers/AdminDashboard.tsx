import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorker } from '../../context/WorkerContext';
import {
  Users,
  Activity,
  TrendingUp,
  DollarSign,
  LogOut,
  Clock,
  AlertTriangle,
  CheckCircle,
  Award,
  Bell
} from 'lucide-react';
import { getAllEmployees } from '../../services/employeeService';
import { getTodayAllAttendance } from '../../services/attendanceService';
import { getAllPerformances } from '../../services/performanceService';
import { subscribeToPendingRequests } from '../../services/requestService';
import { Employee, Attendance, Performance, AdminDashboardStats, RealtimeWorker } from '../../types/worker';

// Komponentlər
import RealTimeMonitoring from '../../components/workers/admin/RealTimeMonitoring';
import EmployeeManagement from '../../components/workers/admin/EmployeeManagement';
import AttendanceManagement from '../../components/workers/admin/AttendanceManagement';
import BehaviorManagement from '../../components/workers/admin/BehaviorManagement';
import PerformanceManagement from '../../components/workers/admin/PerformanceManagement';
import BonusManagement from '../../components/workers/admin/BonusManagement';
import RequestManagement from '../../components/workers/admin/RequestManagement';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, logout, loading: authLoading } = useWorker();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'realtime' | 'employees' | 'attendance' | 'behavior' | 'performance' | 'bonus'>('dashboard');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [stats, setStats] = useState<AdminDashboardStats>({
    bugunIsde: 0,
    bugunGecikenler: 0,
    bugunIcazeli: 0,
    umumi_isci: 0,
    ortalamaDavamiyyet: 0,
    ortalamaPerformans: 0,
    buAyToplamBonus: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/workers/admin-login');
      return;
    }
    
    if (isAdmin) {
      loadDashboardData();
      
      // Real-time sorğu sayını dinlə
      const unsubscribe = subscribeToPendingRequests((requests) => {
        setPendingRequestCount(requests.length);
      });
      
      return () => unsubscribe();
    }
  }, [isAdmin, authLoading, navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      const [employees, todayAttendances, performances] = await Promise.all([
        getAllEmployees(),
        getTodayAllAttendance(),
        getAllPerformances(currentMonth)
      ]);
      
      // Statistika hesabla
      const isdeCount = todayAttendances.filter(a => a.status === 'isde').length;
      const gecikenCount = todayAttendances.filter(a => a.gecikme > 0).length;
      const icazeliCount = todayAttendances.filter(a => a.status === 'icazeli').length;
      
      const avgPerformance = performances.length > 0
        ? performances.reduce((sum, p) => sum + p.umumi, 0) / performances.length
        : 0;
      
      setStats({
        bugunIsde: isdeCount,
        bugunGecikenler: gecikenCount,
        bugunIcazeli: icazeliCount,
        umumi_isci: employees.length,
        ortalamaDavamiyyet: 95, // Bu real hesablanmalıdır
        ortalamaPerformans: Math.round(avgPerformance),
        buAyToplamBonus: 0 // Bonus service-dən gələcək
      });
      
    } catch (error) {
      console.error('Dashboard data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/workers/admin-login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold">İşçi İdarəetmə Sistemi</h1>
                <p className="text-sm text-gray-300">Admin Panel</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Çıxış</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap relative ${
                activeTab === 'requests'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="requests-tab"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Sorğular
                {pendingRequestCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {pendingRequestCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('realtime')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'realtime'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Real Vaxt İzləmə
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'employees'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              İşçilər
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Davamiyyət
            </button>
            <button
              onClick={() => setActiveTab('behavior')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'behavior'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Davranış
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'performance'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Performans
            </button>
            <button
              onClick={() => setActiveTab('bonus')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'bonus'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bonuslar
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Statistika Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Bugün İşdə</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.bugunIsde}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Bugün Gecikənlər</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.bugunGecikenler}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Ümumi İşçi</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.umumi_isci}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Ortalama Performans</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.ortalamaPerformans}</p>
              </div>
            </div>

            {/* Əlavə məlumat */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ümumi Məlumat</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ortalama Davamiyyət</p>
                  <p className="text-2xl font-bold text-green-600">{stats.ortalamaDavamiyyet}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bu Ay Toplam Bonus</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.buAyToplamBonus}₼</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">İcazəli Çıxış</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.bugunIcazeli}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requests' && <RequestManagement />}
        {activeTab === 'realtime' && <RealTimeMonitoring />}
        {activeTab === 'employees' && <EmployeeManagement onRefresh={loadDashboardData} />}
        {activeTab === 'attendance' && <AttendanceManagement />}
        {activeTab === 'behavior' && <BehaviorManagement />}
        {activeTab === 'performance' && <PerformanceManagement />}
        {activeTab === 'bonus' && <BonusManagement />}
      </div>
    </div>
  );
};

export default AdminDashboard;
