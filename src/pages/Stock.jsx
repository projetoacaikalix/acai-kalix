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

        // Fetch movements
        const { data: mData } = await supabase.from('stock_movements').select('*, products(name)').order('created_at', { ascending: false }).limit(20);

        // Calcular o valor total investido por produto (soma de entradas)
        const { data: allMoves } = await supabase.from('stock_movements').select('product_id, type, value');

        const productsWithValue = (pData || []).map(prod => {
            let totalInvested = 0;
            if (allMoves) {
                // Apenas consideramos os valores como custo do que comprou
                allMoves.forEach(m => {
                    if (m.product_id === prod.id && m.type === 'in' && m.value) {
                        totalInvested += parseFloat(m.value);
                    }
                });
            }
            return {
                ...prod,
                totalValue: totalInvested
            };
        });

        setProducts(productsWithValue);
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

            {/* Visualização de Itens em Estoque (Tabela com Valores) */}
            <div className="card mb-4" style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Visão Geral do Estoque</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '12px 24px', borderBottom: '2px solid #e2e8f0' }}>Produto</th>
                                <th style={{ padding: '12px 24px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Quantidade</th>
                                <th style={{ padding: '12px 24px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Valor Acumulado (Entradas)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Nenhum item em estoque.</td>
                                </tr>
                            ) : (
                                products.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '16px 24px', fontWeight: 600, color: '#334155' }}>
                                            {p.name}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: p.stock <= 5 ? 'var(--danger)' : 'var(--primary)' }}>
                                                {p.stock} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#94a3b8' }}>un.</span>
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                            R$ {(p.totalValue || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
                    <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {movements.length === 0 && (
                            <p className="text-center text-muted">Ainda não há movimentações</p>
                        )}
                        {movements.map(m => (
                            <div key={m.id} className="flex justify-between items-center p-3" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <p className="text-bold" style={{ fontSize: '0.9rem', margin: '0 0 4px 0' }}>{m.products?.name}</p>
                                    <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                                        {new Date(m.created_at).toLocaleString('pt-BR')} • <span className={`badge ${m.type === 'in' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '9px', marginLeft: '4px' }}>{m.type === 'in' ? 'Entrada (+)' : 'Saída (-)'}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div style={{ textAlign: 'right' }}>
                                        <p className="text-bold" style={{ margin: 0 }}>{m.quantity} un.</p>
                                        <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>R$ {parseFloat(m.value || 0).toFixed(2)}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button className="btn-icon-only text-primary" style={{ padding: '4px', minWidth: '30px', minHeight: '30px', background: '#f3e8ff', border: 'none', cursor: 'pointer' }} onClick={() => handleEdit(m)}>✏️</button>
                                        <button className="btn-icon-only text-danger" style={{ padding: '4px', minWidth: '30px', minHeight: '30px', background: '#fee2e2', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(m.id)}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
