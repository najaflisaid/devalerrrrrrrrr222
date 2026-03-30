import React, { useState, useEffect } from 'react';
import { getAllEmployees } from '../../../services/employeeService';
import { addXeberdarliq, addTohmet, addTesekkur, addCerime, getAllBehaviors } from '../../../services/behaviorService';
import { Employee, Behavior } from '../../../types/worker';
import { AlertTriangle, XCircle, Award, Plus, X, DollarSign } from 'lucide-react';

const BehaviorManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    isciID: '',
    nov: 'xeberdarliq' as 'xeberdarliq' | 'tohmet' | 'tesekkur' | 'cerime',
    sebeb: '',
    qeyd: '',
    manager: 'Admin',
    mebleg: 0,
    balTesiri: -5
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, behaviorData] = await Promise.all([
        getAllEmployees(),
        getAllBehaviors()
      ]);
      setEmployees(empData);
      setBehaviors(behaviorData);
      if (empData.length > 0) {
        setFormData(prev => ({ ...prev, isciID: empData[0].id }));
      }
    } catch (error) {
      console.error('Data yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (formData.nov === 'xeberdarliq') {
        await addXeberdarliq(formData.isciID, formData.sebeb, formData.manager, formData.qeyd);
      } else if (formData.nov === 'tohmet') {
        await addTohmet(formData.isciID, formData.sebeb, formData.manager, formData.qeyd);
      } else if (formData.nov === 'cerime') {
        await addCerime(formData.isciID, formData.sebeb, formData.manager, formData.mebleg, formData.balTesiri, formData.qeyd);
      } else {
        await addTesekkur(formData.isciID, formData.sebeb, formData.manager, formData.qeyd);
      }

      setShowModal(false);
      loadData();
      setFormData({
        isciID: employees[0]?.id || '',
        nov: 'xeberdarliq',
        sebeb: '',
        qeyd: '',
        manager: 'Admin',
        mebleg: 0,
        balTesiri: -5
      });
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getEmployeeName = (isciID: string) => {
    const emp = employees.find(e => e.id === isciID);
    return emp ? `${emp.ad} ${emp.soyad}` : 'Naməlum';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Davranış Qeydləri</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Qeyd
        </button>
      </div>

      {/* Behavior List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          </div>
        ) : (
          <div className="divide-y">
            {behaviors.map(behavior => (
              <div key={behavior.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    behavior.nov === 'tesekkur' ? 'bg-green-100' :
                    behavior.nov === 'xeberdarliq' ? 'bg-yellow-100' : 
                    behavior.nov === 'cerime' ? 'bg-purple-100' : 'bg-red-100'
                  }`}>
                    {behavior.nov === 'tesekkur' ? <Award className="w-6 h-6 text-green-600" /> :
                     behavior.nov === 'xeberdarliq' ? <AlertTriangle className="w-6 h-6 text-yellow-600" /> :
                     behavior.nov === 'cerime' ? <DollarSign className="w-6 h-6 text-purple-600" /> :
                     <XCircle className="w-6 h-6 text-red-600" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{getEmployeeName(behavior.isciID)}</h4>
                        <p className="text-sm text-gray-600">
                          {behavior.nov === 'tesekkur' ? 'Təşəkkür' :
                           behavior.nov === 'xeberdarliq' ? 'Xəbərdarlıq' : 
                           behavior.nov === 'cerime' ? 'Cərimə' : 'Töhmət'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {new Date(behavior.tarix).toLocaleDateString('az-AZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        <p className={`text-sm font-medium ${
                          behavior.balTesiri > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {behavior.balTesiri > 0 ? '+' : ''}{behavior.balTesiri} bal
                        </p>
                        {behavior.mebleg && behavior.mebleg > 0 && (
                          <p className="text-sm font-bold text-purple-600">
                            {behavior.mebleg} ₼ cərimə
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-900 mb-2"><strong>Səbəb:</strong> {behavior.sebeb}</p>
                    {behavior.qeyd && (
                      <p className="text-sm text-gray-600"><strong>Qeyd:</strong> {behavior.qeyd}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">Manager: {behavior.manager}</p>
                  </div>
                </div>
              </div>
            ))}

            {behaviors.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                Davranış qeydi tapılmadı
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Yeni Davranış Qeydi</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">İşçi *</label>
                <select
                  value={formData.isciID}
                  onChange={(e) => setFormData({ ...formData, isciID: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                  required
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.ad} {emp.soyad} - {emp.vezife}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Növ *</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nov: 'tesekkur', balTesiri: 10, mebleg: 0 })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.nov === 'tesekkur'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Award className="w-5 h-5 mx-auto mb-1 text-green-600" />
                    <p className="text-xs font-medium">Təşəkkür</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nov: 'xeberdarliq', balTesiri: -5, mebleg: 0 })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.nov === 'xeberdarliq'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                    <p className="text-xs font-medium">Xəbərdarlıq</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nov: 'tohmet', balTesiri: -10, mebleg: 0 })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.nov === 'tohmet'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <XCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                    <p className="text-xs font-medium">Töhmət</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nov: 'cerime', balTesiri: -5, mebleg: 0 })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.nov === 'cerime'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                    <p className="text-xs font-medium">Cərimə</p>
                  </button>
                </div>
              </div>

              {/* Cərimə üçün məbləğ və bal */}
              {formData.nov === 'cerime' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cərimə Məbləği (₼) *</label>
                    <input
                      type="number"
                      value={formData.mebleg}
                      onChange={(e) => setFormData({ ...formData, mebleg: Number(e.target.value) })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      min="0"
                      step="0.01"
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bal Təsiri *</label>
                    <input
                      type="number"
                      value={formData.balTesiri}
                      onChange={(e) => setFormData({ ...formData, balTesiri: Number(e.target.value) })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="-5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mənfi rəqəm yazın (məs: -5, -10)</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Səbəb *</label>
                <input
                  type="text"
                  value={formData.sebeb}
                  onChange={(e) => setFormData({ ...formData, sebeb: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                  required
                  placeholder="Məsələn: Gecikmə, yaxşı iş və s."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Əlavə Qeyd</label>
                <textarea
                  value={formData.qeyd}
                  onChange={(e) => setFormData({ ...formData, qeyd: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                  rows={3}
                  placeholder="Əlavə məlumat..."
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Gözləyin...' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BehaviorManagement;