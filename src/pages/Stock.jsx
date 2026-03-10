import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, PackagePlus, AlertCircle } from 'lucide-react';

export default function Stock() {
    const [products, setProducts] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        product_name: '',
        quantity: '',
        value: '',
        type: 'in'
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch products (apenas Complementos)
        const { data: pData } = await supabase.from('products').select('id, name, stock').eq('status', true).eq('category', 'Complementos').order('name');
        setProducts(pData || []);

        // Fetch movements
        const { data: mData } = await supabase.from('stock_movements').select('*, products(name)').order('created_at', { ascending: false }).limit(20);
        setMovements(mData || []);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const qty = parseInt(formData.quantity, 10);
        const val = parseFloat(formData.value) || 0;

        if (qty <= 0) {
            alert('Quantidade deve ser maior que zero.');
            setLoading(false);
            return;
        }

        try {
            if (editingId) {
                await supabase.from('stock_movements').update({
                    quantity: qty,
                    value: val,
                    type: formData.type
                }).eq('id', editingId);
            } else {
                let currentProductId = null;
                // Buscar se o componente já existe
                const { data: existingProdArr } = await supabase.from('products')
                    .select('id, stock')
                    .ilike('name', formData.product_name)
                    .eq('category', 'Complementos');

                const existingProd = existingProdArr && existingProdArr.length > 0 ? existingProdArr[0] : null;

                if (existingProd) {
                    currentProductId = existingProd.id;
                    const newStock = formData.type === 'in' ? existingProd.stock + qty : existingProd.stock - qty;
                    await supabase.from('products').update({ stock: newStock }).eq('id', currentProductId);
                } else {
                    const newStock = formData.type === 'in' ? qty : -qty;
                    const { data: newProd } = await supabase.from('products').insert([{
                        name: formData.product_name,
                        category: 'Complementos',
                        price: 0,
                        cost: 0,
                        stock: newStock
                    }]).select();

                    if (newProd && newProd.length > 0) {
                        currentProductId = newProd[0].id;
                    }
                }

                if (currentProductId) {
                    await supabase.from('stock_movements').insert([{
                        product_id: currentProductId,
                        type: formData.type,
                        quantity: qty,
                        value: val,
                        reason: 'Movimentação via Estoque'
                    }]);
                }
            }

            resetForm();
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEdit = (movement) => {
        setFormData({
            product_name: movement.products?.name || '',
            quantity: movement.quantity,
            value: movement.value || '',
            type: movement.type
        });
        setEditingId(movement.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Excluir este registro de movimentação do histórico?')) {
            setLoading(true);
            await supabase.from('stock_movements').delete().eq('id', id);
            fetchData();
        }
    };

    const resetForm = () => {
        setFormData({ product_name: '', quantity: '', value: '', type: 'in' });
        setEditingId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Estoque</h1>
                    <p className="text-muted">Controle de entradas e saídas</p>
                </div>
                {!isFormOpen && (
                    <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        <PackagePlus size={20} /> <span className="hide-mobile">Novo Registro</span>
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="card mb-4 animate-fade-in">
                    <h2>{editingId ? 'Editar Movimentação' : 'Novo Registro'}</h2>
                    <form onSubmit={handleSubmit} className="grid-2 mt-4">
                        <div className="form-group">
                            <label>Nome do Insumo / Componente</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.product_name}
                                onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                disabled={editingId !== null} // não permite alterar o produto na edicao simples
                                placeholder="Ex: Copo 300ml, Granola"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Tipo de Movimentação</label>
                            <select
                                className="select-field"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="in">Entrada (+)</option>
                                <option value="out">Saída (-)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Quantidade</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                required
                                min="1"
                            />
                        </div>

                        <div className="form-group">
                            <label>Valor Total (R$) - Opcional</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input-field"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="flex items-center gap-2 mt-4" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Movimentação'}
                            </button>
                            <button type="button" className="btn btn-danger btn-block" disabled={loading} onClick={resetForm}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tabela de Produtos com Alerta */}
            <div className="card mb-4">
                <h2>Posição Atual (Estoque Baixo)</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    {products.filter(p => p.stock <= 5).length === 0 ? (
                        <p className="text-muted">Nenhum produto com estoque crítico.</p>
                    ) : (
                        products.filter(p => p.stock <= 5).map(p => (
                            <div key={p.id} className="flex justify-between items-center" style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
                                <div className="flex items-center gap-2 text-danger text-bold">
                                    <AlertCircle size={20} />
                                    <span>{p.name}</span>
                                </div>
                                <span className="badge badge-danger text-bold" style={{ fontSize: '1rem' }}>{p.stock}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Histórico Move */}
            <div className="card">
                <h2>Últimas Movimentações</h2>
                {loading ? (
                    <div className="text-center p-4"><RefreshCw className="animate-spin" /></div>
                ) : (
                    <div className="table-wrapper mt-4">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Produto</th>
                                    <th>Tipo</th>
                                    <th>Qtd</th>
                                    <th>Valor Estimado</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 && (
                                    <tr><td colSpan="6" className="text-center text-muted">Ainda não há movimentações</td></tr>
                                )}
                                {movements.map(m => (
                                    <tr key={m.id}>
                                        <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                                        <td className="text-bold">{m.products?.name}</td>
                                        <td>
                                            <span className={`badge ${m.type === 'in' ? 'badge-success' : 'badge-warning'}`}>
                                                {m.type === 'in' ? 'Entrada (+)' : 'Saída (-)'}
                                            </span>
                                        </td>
                                        <td className="text-bold">{m.quantity}</td>
                                        <td className="text-muted">R$ {parseFloat(m.value || 0).toFixed(2)}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn-icon-only text-primary" style={{ minHeight: '32px', minWidth: '32px', padding: '6px', background: '#f3e8ff', border: 'none', cursor: 'pointer' }} onClick={() => handleEdit(m)}>
                                                    ✏️
                                                </button>
                                                <button className="btn-icon-only text-danger" style={{ minHeight: '32px', minWidth: '32px', padding: '6px', background: '#fee2e2', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(m.id)}>
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
