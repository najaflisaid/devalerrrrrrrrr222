import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { getAllBonuses } from '../../../services/bonusService';
import { Employee, Bonus } from '../../../types/worker';
import { DollarSign, TrendingUp } from 'lucide-react';

const BonusManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, bonusData] = await Promise.all([
        getAllEmployees(),
        getAllBonuses(month)
      ]);
      setEmployees(empData);
      setBonuses(bonusData);
    } catch (error) {
      console.error('Data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (isciID: string) => {
    const emp = employees.find(e => e.id === isciID);
    return emp ? `${emp.ad} ${emp.soyad}` : 'Naməlum';
  };

  const totalBonus = bonuses.reduce((sum, b) => sum + b.mebleg, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Bonus İdarəetməsi</h2>
          <div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            <h3 className="text-sm text-gray-600">Toplam Bonus</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalBonus.toLocaleString()}₼</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h3 className="text-sm text-gray-600">Bonus Alan İşçi</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{bonuses.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-purple-600" />
            <h3 className="text-sm text-gray-600">Ortalama Bonus</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {bonuses.length > 0 ? Math.round(totalBonus / bonuses.length).toLocaleString() : 0}₼
          </p>
        </div>
      </div>

      {/* Bonus List */}
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
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">İşçi</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Məbləğ</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Performans Balı</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Səbəb</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bonuses.map(bonus => (
                    <tr key={bonus.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{getEmployeeName(bonus.isciID)}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-lg font-bold text-green-600">{bonus.mebleg.toLocaleString()}₼</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {bonus.performansBali}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-700">{bonus.sebeb}</p>
                      </td>
                      <td className="py-4 px-6">
                        {bonus.status === 'tesdiq' ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Təsdiq edilib
                          </span>
                        ) : bonus.status === 'odenilib' ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Ödənilib
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Gözləmədə
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {bonuses.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p>Bu ay üçün bonus tapılmadı</p>
                  <p className="text-sm mt-2">Performans hesablandıqdan sonra bonuslar avtomatik yaradılacaq</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BonusManagement;