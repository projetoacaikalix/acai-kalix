import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Trash2, X, RefreshCw } from 'lucide-react';
import { formatCurrency, confirmAlert, successAlert } from '../utils';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        category: 'Açaí',
        price: '',
        cost: '',
        stock: 0,
        status: true,
        image_url: ''
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('category', 'Açaí')
            .order('name');

        if (error) {
            console.error('Error fetching products', error);
            setProducts([]);
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Parse numbers
        const payload = {
            ...formData,
            price: parseFloat(formData.price),
            cost: parseFloat(formData.cost),
            stock: parseInt(formData.stock, 10),
        };

        if (editingId) {
            const { error } = await supabase
                .from('products')
                .update(payload)
                .eq('id', editingId);
            if (!error) {
                setIsFormOpen(false);
                fetchProducts();
            }
        } else {
            const { error } = await supabase
                .from('products')
                .insert([payload]);
            if (!error) {
                setIsFormOpen(false);
                fetchProducts();
            }
        }
        setLoading(false);
    };

    const handleEdit = (product) => {
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            status: product.status,
            image_url: product.image_url || ''
        });
        setEditingId(product.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmAlert('Excluir Produto?', 'Tem certeza que deseja excluir este produto do catálogo?');
        if (confirmed) {
            setLoading(true);
            await supabase.from('products').delete().eq('id', id);
            fetchProducts();
            successAlert('Produto removido!');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', category: 'Açaí', price: '', cost: '', stock: 0, status: true, image_url: ''
        });
        setEditingId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Produtos</h1>
                    <p className="text-muted">Gerencie seu catálogo</p>
                </div>
                {!isFormOpen && (
                    <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        <Plus size={20} /> <span className="hide-mobile">Novo Produto</span>
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="card mb-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2>{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
                        <button className="btn-icon-only text-muted" onClick={resetForm} style={{ background: 'transparent', border: 'none' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid-2">
                        <div className="form-group">
                            <label>Nome do Produto</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
                        </div>

                        {/* Categoria e Estoque foram ocultados e fixados em Açaí e 0 internamente */}

                        <div className="form-group">
                            <label>Preço de Venda (R$)</label>
                            <input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} className="input-field" required />
                        </div>

                        <div className="form-group">
                            <label>Custo do Produto (R$)</label>
                            <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} className="input-field" required />
                        </div>



                        <div className="form-group">
                            <label>URL da Foto (opcional)</label>
                            <input type="url" name="image_url" value={formData.image_url} onChange={handleInputChange} className="input-field" />
                        </div>

                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <input type="checkbox" name="status" checked={formData.status} onChange={handleInputChange} style={{ width: '20px', height: '20px' }} />
                            <label style={{ marginLeft: '8px', cursor: 'pointer' }}>Produto Ativo</label>
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Produto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading && !isFormOpen ? (
                    <div className="text-center p-4"><RefreshCw className="animate-spin" size={24} /></div>
                ) : (
                    <div className="products-grid">
                        {products.length === 0 ? (
                            <p className="text-muted text-center">Nenhum produto cadastrado.</p>
                        ) : (
                            // Use CSS Grid for desktop, cards for mobile
                            <div dangerouslySetInnerHTML={{ __html: '<style>.product-list-card { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #eee; } .product-list-card:last-child { border-bottom: none; } .p-info h3 { margin: 0; font-size: 1rem; } .p-info p { margin: 4px 0 0; color: #666; font-size: 0.875rem; }</style>' }} />
                        )}
                        {products.map(p => (
                            <div key={p.id} className="product-list-card">
                                <div className="p-info flex items-center gap-4">
                                    {p.image_url && (
                                        <img src={p.image_url} alt={p.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                                    )}
                                    <div>
                                        <h3>{p.name}</h3>
                                        <p className="flex items-center gap-2">
                                            <span className={`badge ${p.status ? 'badge-success' : 'badge-danger'}`}>{p.status ? 'Ativo' : 'Inativo'}</span>
                                            <span className="text-bold">{formatCurrency(p.price)}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-icon-only text-primary" style={{ background: '#f3e8ff', border: 'none', cursor: 'pointer' }} onClick={() => handleEdit(p)}>
                                        <Edit2 size={18} color="var(--primary)" />
                                    </button>
                                    <button className="btn-icon-only text-danger" style={{ background: '#fee2e2', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(p.id)}>
                                        <Trash2 size={18} color="var(--danger)" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
