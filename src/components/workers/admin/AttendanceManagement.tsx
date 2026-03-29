import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { getMonthlyAttendance, addIcazeliCixis } from '../../../services/attendanceService';
import { Employee, Attendance } from '../../../types/worker';
import { Calendar, Download } from 'lucide-react';

const AttendanceManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadAttendances();
    }
  }, [selectedEmployee, month]);

  const loadEmployees = async () => {
    const data = await getAllEmployees();
    setEmployees(data);
    if (data.length > 0) {
      setSelectedEmployee(data[0].id);
    }
  };

  const loadAttendances = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const data = await getMonthlyAttendance(selectedEmployee, month);
      setAttendances(data);
    } catch (error) {
      console.error('Davamiyyət yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = Math.floor(attendances.reduce((sum, a) => sum + a.isSaati, 0) / 60);
  const lateCount = attendances.filter(a => a.gecikme > 0).length;
  const attendanceRate = Math.round((attendances.length / 22) * 100);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">İşçi</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.ad} {emp.soyad} - {emp.vezife}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-sm text-gray-600 mb-2">Toplam İş Saatı</h3>
          <p className="text-3xl font-bold text-gray-900">{totalHours}s</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-sm text-gray-600 mb-2">Gecikmə Sayı</h3>
          <p className="text-3xl font-bold text-red-600">{lateCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-sm text-gray-600 mb-2">Davamiyyət Faizi</h3>
          <p className="text-3xl font-bold text-green-600">{attendanceRate}%</p>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Davamiyyət Cədvəli</h3>
          <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Tarix</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Giriş</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Çıxış</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">İş Saatı</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Gecikmə</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendances.map(att => (
                  <tr key={att.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 text-sm text-gray-900">
                      {new Date(att.tarix).toLocaleDateString('az-AZ', { day: '2-digit', month: 'long', weekday: 'short' })}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      {att.girisSaati ? new Date(att.girisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      {att.cixisSaati ? new Date(att.cixisSaati).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      {att.isSaati ? `${Math.floor(att.isSaati / 60)}s ${att.isSaati % 60}d` : '-'}
                    </td>
                    <td className="py-3 px-6 text-sm">
                      {att.gecikme > 0 ? (
                        <span className="text-red-600 font-medium">{att.gecikme}d</span>
                      ) : (
                        <span className="text-green-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-sm">
                      {att.status === 'icazeli' ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">İcazəli</span>
                      ) : att.status === 'isde' ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">İşdə</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">Çıxıb</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {attendances.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                Bu ay üçün davamiyyət qeydi tapılmadı
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceManagement;