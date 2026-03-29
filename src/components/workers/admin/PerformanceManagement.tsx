import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { calculateMonthlyPerformance, getAllPerformances, calculateRatings } from '../../../services/performanceService';
import { calculateBonus } from '../../../services/bonusService';
import { checkAndAwardBadges } from '../../../services/badgeService';
import { Employee, Performance } from '../../../types/worker';
import { TrendingUp, Calculator, Award } from 'lucide-react';

const PerformanceManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, perfData] = await Promise.all([
        getAllEmployees(),
        getAllPerformances(month)
      ]);
      setEmployees(empData);
      setPerformances(perfData);
    } catch (error) {
      console.error('Data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    if (!confirm(`${month} ayı üçün bütün işçilərin performansını hesablamaq istəyirsiniz?`)) return;
    
    setCalculating(true);
    try {
      // Hər işçi üçün performans hesabla
      for (const emp of employees) {
        const perf = await calculateMonthlyPerformance(emp.id, month, 50000);
        
        // Bonus hesabla
        await calculateBonus(emp.id, month, perf.umumi);
        
        // Badge yoxla
        await checkAndAwardBadges(emp.id, month, perf.umumi);
      }
      
      // Reytinqləri hesabla
      await calculateRatings(month);
      
      alert('Performans hesablamaları tamamlandı!');
      loadData();
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  const getEmployeeName = (isciID: string) => {
    const emp = employees.find(e => e.id === isciID);
    return emp ? `${emp.ad} ${emp.soyad}` : 'Naməlum';
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Performans İdarəetməsi</h2>
          <div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
        <button
          onClick={handleCalculateAll}
          disabled={calculating}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <Calculator className="w-5 h-5" />
          {calculating ? 'Hesablanır...' : 'Hamııını Hesabla'}
        </button>
      </div>

      {/* Performance List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Reytinq</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">İşçi</th>
                    <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Davamiyyət<br/>(30)</th>
                    <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Satış<br/>(40)</th>
                    <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">İntizam<br/>(20)</th>
                    <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Aktivlik<br/>(10)</th>
                    <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Ümumi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {performances.map((perf, index) => (
                    <tr key={perf.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {perf.reytinq <= 3 && (
                            <Award className="w-5 h-5 text-yellow-500" />
                          )}
                          <span className="font-bold text-lg text-gray-900">#{perf.reytinq || index + 1}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{getEmployeeName(perf.isciID)}</p>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-700">{perf.davamiyyetBali.toFixed(1)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-700">{perf.satisBali.toFixed(1)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-700">{perf.intizamBali.toFixed(1)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-700">{perf.aktivlikBali}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${getPerformanceColor(perf.umumi)}`}>
                          {perf.umumi}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {performances.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p>Bu ay üçün performans hesablanmayıb</p>
                  <p className="text-sm mt-2">"Hamııını Hesabla" düyməsinə basın</p>
                </div>
              )}
            </div>

            {/* Legend */}
            {performances.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">90+ Əla</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700">80-89 Yaxşı</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-700">70-79 Orta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700">70-dən aşağı Zəif</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PerformanceManagement;