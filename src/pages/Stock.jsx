import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, PackagePlus, AlertCircle } from 'lucide-react';

export default function Stock() {
    const [products, setProducts] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        product_id: '',
        quantity: '',
        reason: 'Reposição'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch products
        const { data: pData } = await supabase.from('products').select('id, name, stock').eq('status', true).order('name');
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

        if (qty <= 0) {
            alert('Quantidade deve ser maior que zero.');
            setLoading(false);
            return;
        }

        try {
            // Registrar movimento de entrada
            await supabase.from('stock_movements').insert([{
                product_id: formData.product_id,
                type: 'in',
                quantity: qty,
                reason: formData.reason
            }]);

            // Atualizar o estoque atual do produto
            const prod = products.find(p => p.id === formData.product_id);
            if (prod) {
                await supabase.from('products').update({ stock: prod.stock + qty }).eq('id', prod.id);
            }

            setIsFormOpen(false);
            setFormData({ product_id: '', quantity: '', reason: 'Reposição' });
            fetchData();
        } catch (e) {
            console.error(e);
        }
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
                        <PackagePlus size={20} /> <span className="hide-mobile">Nova Entrada</span>
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="card mb-4 animate-fade-in">
                    <h2>Registrar Entrada de Estoque</h2>
                    <form onSubmit={handleSubmit} className="grid-2 mt-4">
                        <div className="form-group">
                            <label>Produto</label>
                            <select
                                className="select-field"
                                value={formData.product_id}
                                onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                                required
                            >
                                <option value="">Selecione um produto</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (Atual: {p.stock})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Quantidade a adicionar</label>
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
                            <label>Motivo</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                required
                            />
                        </div>

                        <div className="flex items-center gap-2 mt-4" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Entrada'}
                            </button>
                            <button type="button" className="btn btn-danger btn-block" disabled={loading} onClick={() => setIsFormOpen(false)}>
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
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 && (
                                    <tr><td colSpan="5" className="text-center text-muted">Ainda não há movimentações</td></tr>
                                )}
                                {movements.map(m => (
                                    <tr key={m.id}>
                                        <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                                        <td className="text-bold">{m.products?.name}</td>
                                        <td>
                                            <span className={`badge ${m.type === 'in' ? 'badge-success' : 'badge-warning'}`}>
                                                {m.type === 'in' ? 'Entrada' : 'Saída'}
                                            </span>
                                        </td>
                                        <td className="text-bold">{m.quantity}</td>
                                        <td>{m.reason || (m.type === 'out' ? 'Venda' : '-')}</td>
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
