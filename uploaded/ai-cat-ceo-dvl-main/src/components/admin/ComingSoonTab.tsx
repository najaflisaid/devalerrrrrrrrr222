import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { productService } from '../../services/productService';
import type { Product } from '../../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Brand {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

const ComingSoonTab: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: { az: '', ru: '' },
    description: { az: '', ru: '' },
    price: 0,
    images: [''],
    category: '',
    brand: '',
    gender: 'unisex',
    stock: 0,
    isEnabled: true,
    comingSoon: true,
    isBestseller: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allProducts, brandsData, categoriesData] = await Promise.all([
        productService.getAll(true),
        getDocs(collection(db, 'brands')),
        getDocs(collection(db, 'categories'))
      ]);

      const comingSoonProducts = allProducts.filter(p => p.comingSoon);
      setProducts(comingSoonProducts);

      setBrands(brandsData.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      setCategories(categoriesData.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productService.update(editingProduct.id, { ...formData, comingSoon: true });
      } else {
        await productService.add({ ...formData, comingSoon: true, createdAt: new Date() } as any);
      }
      loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Məhsul saxlanıla bilmədi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu məhsulu silmək istədiyinizə əminsiniz?')) return;
    try {
      await productService.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Məhsul silinə bilmədi');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      images: product.images,
      category: product.category,
      brand: product.brand,
      gender: product.gender,
      stock: product.stock,
      isEnabled: product.isEnabled,
      comingSoon: true,
      isBestseller: product.isBestseller || false
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({
      name: { az: '', ru: '' },
      description: { az: '', ru: '' },
      price: 0,
      images: [''],
      category: '',
      brand: '',
      gender: 'unisex',
      stock: 0,
      isEnabled: true,
      comingSoon: true,
      isBestseller: false
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Tezliklə Gələcək Məhsullar ({products.length})
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Yeni Məhsul
        </button>
      </div>

      <div className="grid gap-4">
        {products.map((product) => (
          <div key={product.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={product.images[0]}
                alt={product.name.az}
                className="w-20 h-20 object-cover rounded"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{product.name.az}</h3>
                <p className="text-sm text-gray-600">{product.brand} • {product.category}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className="inline-block px-2 py-1 bg-orange-600 text-white text-xs rounded-full">
                    Tezliklə
                  </span>
                  <span className="text-xs text-gray-600">Stok: {product.stock}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-lg">{product.price} AZN</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(product)}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tezliklə gələcək məhsul yoxdur</p>
            <p className="text-sm text-gray-500 mt-2">Yeni məhsul əlavə edin</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingProduct ? 'Məhsulu Redaktə Et' : 'Yeni Tezliklə Məhsul'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad (AZ) *</label>
                  <input
                    type="text"
                    value={formData.name?.az || ''}
                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name!, az: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad (RU) *</label>
                  <input
                    type="text"
                    value={formData.name?.ru || ''}
                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name!, ru: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Təsvir (AZ) *</label>
                  <textarea
                    value={formData.description?.az || ''}
                    onChange={(e) => setFormData({ ...formData, description: { ...formData.description!, az: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    rows={3}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Təsvir (RU) *</label>
                  <textarea
                    value={formData.description?.ru || ''}
                    onChange={(e) => setFormData({ ...formData, description: { ...formData.description!, ru: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Normal Qiymət ( AZN) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok *</label>
                  <input
                    type="number"
                    value={formData.stock || 0}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brend *</label>
                  <select
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  >
                    <option value="">Seçin</option>
                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kateqoriya *</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                    required
                  >
                    <option value="">Seçin</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cins *</label>
                  <select
                    value={formData.gender || 'unisex'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                  >
                    <option value="unisex">Unisex</option>
                    <option value="men">Kişi</option>
                    <option value="women">Qadın</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Şəkillər URL</label>
                  {formData.images?.map((img, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={img}
                        onChange={(e) => {
                          const newImages = [...(formData.images || [])];
                          newImages[index] = e.target.value;
                          setFormData({ ...formData, images: newImages });
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                        placeholder={`Şəkil ${index + 1} URL`}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = formData.images?.filter((_, i) => i !== index);
                            setFormData({ ...formData, images: newImages });
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, images: [...(formData.images || []), ''] })}
                    className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    <Plus className="h-4 w-4 inline mr-1" /> Şəkil əlavə et
                  </button>
                </div>

                <div className="md:col-span-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isEnabled || false}
                      onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Aktiv</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isBestseller || false}
                      onChange={(e) => setFormData({ ...formData, isBestseller: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Ən çox satılan</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  {editingProduct ? 'Yenilə' : 'Əlavə et'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ləğv et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComingSoonTab;
