import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Trash2, X, RefreshCw, PlusCircle } from 'lucide-react';
import { formatCurrency, confirmAlert, successAlert } from '../utils';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [ingredientsList, setIngredientsList] = useState([]);
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
        image_url: '',
        recipe: [] // Array of { ingredient_id, quantity, name, unit }
    });

    useEffect(() => {
        fetchProductsAndIngredients();
    }, []);

    const fetchProductsAndIngredients = async () => {
        setLoading(true);
        // Fetch Açaí products
        const { data: pData, error: pError } = await supabase
            .from('products')
            .select('*')
            .eq('category', 'Açaí')
            .order('name');

        // Fetch Complementos (Ingredients)
        const { data: iData, error: iError } = await supabase
            .from('products')
            .select('id, name, unit')
            .eq('category', 'Complementos')
            .eq('status', true)
            .order('name');

        if (pError) console.error('Error fetching products', pError);
        if (iError) console.error('Error fetching ingredients', iError);

        setProducts(pData || []);
        setIngredientsList(iData || []);
        setLoading(false);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const addRecipeItem = () => {
        setFormData(prev => ({
            ...prev,
            recipe: [...prev.recipe, { ingredient_id: '', quantity: '', name: '', unit: '' }]
        }));
    };

    const updateRecipeItem = (index, field, value) => {
        const newRecipe = [...formData.recipe];
        newRecipe[index][field] = value;

        if (field === 'ingredient_id') {
            const ing = ingredientsList.find(i => i.id === value);
            if (ing) {
                newRecipe[index].name = ing.name;
                newRecipe[index].unit = ing.unit || 'unidade';
            } else {
                newRecipe[index].name = '';
                newRecipe[index].unit = '';
            }
        }

        setFormData(prev => ({ ...prev, recipe: newRecipe }));
    };

    const removeRecipeItem = (index) => {
        const newRecipe = formData.recipe.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, recipe: newRecipe }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Filter out empty recipe items
        const cleanRecipe = formData.recipe
            .filter(r => r.ingredient_id && r.quantity)
            .map(r => ({ ...r, quantity: parseFloat(r.quantity) }));

        // Parse numbers
        const payload = {
            name: formData.name,
            category: formData.category,
            status: formData.status,
            image_url: formData.image_url,
            price: parseFloat(formData.price),
            cost: parseFloat(formData.cost),
            stock: parseInt(formData.stock, 10),
            recipe: cleanRecipe
        };

        if (editingId) {
            const { error } = await supabase
                .from('products')
                .update(payload)
                .eq('id', editingId);
            if (!error) {
                setIsFormOpen(false);
                fetchProductsAndIngredients();
                successAlert('Produto atualizado!');
            }
        } else {
            const { error } = await supabase
                .from('products')
                .insert([payload]);
            if (!error) {
                setIsFormOpen(false);
                fetchProductsAndIngredients();
                successAlert('Produto criado!');
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
            image_url: product.image_url || '',
            recipe: Array.isArray(product.recipe) ? product.recipe : []
        });
        setEditingId(product.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmAlert('Excluir Produto?', 'Tem certeza que deseja excluir este produto do catálogo?');
        if (confirmed) {
            setLoading(true);
            await supabase.from('products').delete().eq('id', id);
            fetchProductsAndIngredients();
            successAlert('Produto removido!');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', category: 'Açaí', price: '', cost: '', stock: 0, status: true, image_url: '', recipe: []
        });
        setEditingId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Produtos</h1>
                    <p className="text-muted">Gerencie seu catálogo e receitas</p>
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
                    <form onSubmit={handleSubmit}>
                        <div className="grid-2">
                            <div className="form-group">
                                <label>Nome do Produto</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
                            </div>

                            <div className="form-group">
                                <label>URL da Foto (opcional)</label>
                                <input type="url" name="image_url" value={formData.image_url} onChange={handleInputChange} className="input-field" />
                            </div>

                            <div className="form-group">
                                <label>Preço de Venda (R$)</label>
                                <input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} className="input-field" required />
                            </div>

                            <div className="form-group">
                                <label>Custo do Produto (R$)</label>
                                <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} className="input-field" required />
                            </div>
                        </div>

                        {/* Receita Section */}
                        <div style={{ marginTop: '24px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3>Receita do Produto</h3>
                                <button type="button" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }} onClick={addRecipeItem}>
                                    <PlusCircle size={16} /> Adicionar Insumo
                                </button>
                            </div>

                            {formData.recipe.length === 0 ? (
                                <p className="text-muted" style={{ fontSize: '0.9rem' }}>Nenhum insumo cadastrado para esta receita. Esse produto não dará baixa automática no estoque de ingredientes.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {formData.recipe.map((item, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                                            <div style={{ flex: '1 1 200px' }}>
                                                <select
                                                    className="select-field"
                                                    value={item.ingredient_id}
                                                    onChange={e => updateRecipeItem(index, 'ingredient_id', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Selecione um Insumo...</option>
                                                    {ingredientsList.map(ing => (
                                                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="input-field"
                                                    placeholder="Qtd"
                                                    value={item.quantity}
                                                    onChange={e => updateRecipeItem(index, 'quantity', e.target.value)}
                                                    required
                                                />
                                                <span className="text-muted" style={{ fontSize: '0.85rem', minWidth: '30px' }}>
                                                    {item.unit || 'un'}
                                                </span>
                                            </div>
                                            <div>
                                                <button type="button" className="btn-icon-only text-danger" style={{ background: 'transparent', border: 'none' }} onClick={() => removeRecipeItem(index)}>
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', marginTop: '16px' }}>
                            <input type="checkbox" name="status" checked={formData.status} onChange={handleInputChange} style={{ width: '20px', height: '20px' }} />
                            <label style={{ marginLeft: '8px', cursor: 'pointer' }}>Produto Ativo</label>
                        </div>

                        <div className="form-group" style={{ marginTop: '24px' }}>
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
                                            {p.recipe && p.recipe.length > 0 && (
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                                    {p.recipe.length} insumos
                                                </span>
                                            )}
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
