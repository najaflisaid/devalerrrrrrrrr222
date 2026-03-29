import React, { useState, useEffect } from 'react';
import { getAllEmployees, addEmployee, updateEmployee, deleteEmployee } from '../../../services/employeeService';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getSecondaryAuth } from '../../../lib/firebase';
import { Employee } from '../../../types/worker';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface Props {
  onRefresh?: () => void;
}

const EmployeeManagement: React.FC<Props> = ({ onRefresh }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    ad: '',
    soyad: '',
    email: '',
    telefon: '',
    vezife: '',
    magaza: 'Ana mağaza',
    iseGirisTarixi: new Date().toISOString().split('T')[0],
    mezuniyyetQaligi: 20,
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('İşçilər yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingEmployee) {
        // Yenilə
        await updateEmployee(editingEmployee.id, {
          ad: formData.ad,
          soyad: formData.soyad,
          telefon: formData.telefon,
          vezife: formData.vezife,
          magaza: formData.magaza,
          mezuniyyetQaligi: formData.mezuniyyetQaligi
        });
      } else {
        // Yeni işçi əlavə et
        // 1. Firebase Auth-da hesab yarat
        const secondaryAuth = getSecondaryAuth();
        await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        
        // 2. Firestore-da işçi məlumatı yarat
        await addEmployee({
          ad: formData.ad,
          soyad: formData.soyad,
          email: formData.email,
          telefon: formData.telefon,
          vezife: formData.vezife,
          magaza: formData.magaza,
          iseGirisTarixi: formData.iseGirisTarixi,
          aktiv: true,
          mezuniyyetQaligi: formData.mezuniyyetQaligi
        });
      }

      setShowModal(false);
      resetForm();
      loadEmployees();
      if (onRefresh) onRefresh();
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      ad: employee.ad,
      soyad: employee.soyad,
      email: employee.email,
      telefon: employee.telefon,
      vezife: employee.vezife,
      magaza: employee.magaza,
      iseGirisTarixi: employee.iseGirisTarixi,
      mezuniyyetQaligi: employee.mezuniyyetQaligi,
      password: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('İşçini silmək istədiyinizdən əminsiniz?')) return;
    
    try {
      await deleteEmployee(id);
      loadEmployees();
      if (onRefresh) onRefresh();
    } catch (error: any) {
      alert('Xəta: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      ad: '',
      soyad: '',
      email: '',
      telefon: '',
      vezife: '',
      magaza: 'Ana mağaza',
      iseGirisTarixi: new Date().toISOString().split('T')[0],
      mezuniyyetQaligi: 20,
      password: ''
    });
    setEditingEmployee(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">İşçilər</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni İşçi
        </button>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Ad Soyad</th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Email</th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Vəzifə</th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Mağaza</th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Telefon</th>
              <th className="text-right py-3 px-6 text-sm font-semibold text-gray-700">Əməliyyatlar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {emp.ad[0]}{emp.soyad[0]}
                    </div>
                    <span className="font-medium text-gray-900">{emp.ad} {emp.soyad}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-gray-700">{emp.email}</td>
                <td className="py-4 px-6 text-sm text-gray-700">{emp.vezife}</td>
                <td className="py-4 px-6 text-sm text-gray-700">{emp.magaza}</td>
                <td className="py-4 px-6 text-sm text-gray-700">{emp.telefon}</td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mr-3"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(emp.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {employees.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            İşçi tapılmadı
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingEmployee ? 'İşçini Redaktə Et' : 'Yeni İşçi Əlavə Et'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ad *</label>
                  <input
                    type="text"
                    value={formData.ad}
                    onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Soyad *</label>
                  <input
                    type="text"
                    value={formData.soyad}
                    onChange={(e) => setFormData({ ...formData, soyad: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                  required
                  disabled={!!editingEmployee}
                />
              </div>

              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Şifrə *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon *</label>
                  <input
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vəzifə *</label>
                  <input
                    type="text"
                    value={formData.vezife}
                    onChange={(e) => setFormData({ ...formData, vezife: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mağaza *</label>
                  <select
                    value={formData.magaza}
                    onChange={(e) => setFormData({ ...formData, magaza: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  >
                    <option value="Ana mağaza">Ana mağaza</option>
                    <option value="Filial 1">Filial 1</option>
                    <option value="Filial 2">Filial 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Məzuniyyət Qalığı (gün)</label>
                  <input
                    type="number"
                    value={formData.mezuniyyetQaligi}
                    onChange={(e) => setFormData({ ...formData, mezuniyyetQaligi: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    min="0"
                  />
                </div>
              </div>

              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İşə Giriş Tarixi *</label>
                  <input
                    type="date"
                    value={formData.iseGirisTarixi}
                    onChange={(e) => setFormData({ ...formData, iseGirisTarixi: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Gözləyin...' : editingEmployee ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
