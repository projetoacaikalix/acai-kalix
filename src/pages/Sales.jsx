import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ShoppingCart, Package, Plus, Trash2, Check, RefreshCw } from 'lucide-react';

export default function Sales() {
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Sale State
    const [selectedClient, setSelectedClient] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Pix');
    const [cart, setCart] = useState([]);

    const [recentSales, setRecentSales] = useState([]);
    const [editingSaleId, setEditingSaleId] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('products').select('*').eq('status', true).eq('category', 'Açaí').order('name');
        const { data: cData } = await supabase.from('clients').select('id, name').order('name');

        // Fetch recent sales for history
        const { data: sData } = await supabase.from('sales')
            .select(`
                *, 
                clients(name),
                sale_items(quantity, products(name))
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        setProducts(pData || []);
        setClients(cData || []);
        setRecentSales(sData || []);
        setLoading(false);
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateCartQty = (id, delta) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === id);
            if (!existing) return prev;

            const newQty = existing.qty + delta;
            const updated = prev.map(item => item.id === id ? { ...item, qty: newQty } : item);
            return updated.filter(item => item.qty > 0);
        });
    };

    const removeCartItem = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const totalCart = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    const confirmSale = async () => {
        if (cart.length === 0) return alert('Carrinho vazio.');
        setIsSubmitting(true);

        try {
            if (editingSaleId) {
                await supabase.from('sales').update({
                    client_id: selectedClient || null,
                    total: totalCart,
                    payment_method: paymentMethod
                }).eq('id', editingSaleId);

                await supabase.from('sale_items').delete().eq('sale_id', editingSaleId);

                for (const item of cart) {
                    await supabase.from('sale_items').insert([{
                        sale_id: editingSaleId,
                        product_id: item.id,
                        quantity: item.qty,
                        price: item.price
                    }]);
                }
                setSuccessMsg('Venda atualizada com sucesso!');
                setEditingSaleId(null);
            } else {
                const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
                    client_id: selectedClient || null,
                    total: totalCart,
                    payment_method: paymentMethod
                }]).select();

                if (saleError) throw saleError;
                const saleId = saleData[0].id;

                for (const item of cart) {
                    await supabase.from('sale_items').insert([{
                        sale_id: saleId,
                        product_id: item.id,
                        quantity: item.qty,
                        price: item.price
                    }]);
                }
                setSuccessMsg('Venda registrada com sucesso!');
            }

            setCart([]);
            setSelectedClient('');
            setPaymentMethod('Pix');
            fetchInitialData();

            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (e) {
            console.error('Erro ao finalizar venda', e);
            alert('Erro ao finalizar venda.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSale = async (sale) => {
        setEditingSaleId(sale.id);
        setSelectedClient(sale.client_id || '');
        setPaymentMethod(sale.payment_method);

        const { data: items } = await supabase.from('sale_items').select('*, products(name, image_url)').eq('sale_id', sale.id);
        if (items) {
            setCart(items.map(i => ({
                id: i.product_id,
                name: i.products?.name,
                price: parseFloat(i.price),
                qty: i.quantity,
                image_url: i.products?.image_url
            })));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingSaleId(null);
        setCart([]);
        setSelectedClient('');
        setPaymentMethod('Pix');
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>{editingSaleId ? 'Editando Venda' : 'Caixa / Nova Venda'}</h1>
                    <p className="text-muted">{editingSaleId ? 'Alterando pedido existente' : 'Atendimento rápido'}</p>
                </div>
            </div>

            {successMsg && (
                <div className="card mb-4 text-center animate-fade-in" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981', borderWidth: '1px', borderStyle: 'solid' }}>
                    <Check size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    <span className="text-bold">{successMsg}</span>
                </div>
            )}

            <div className="grid-2 grid-layout-sales">
                {/* Lado Esquerdo: Produtos */}
                <div className="card">
                    <h2 className="flex items-center gap-2 mb-4"><Package size={20} /> Catálogo de Produtos</h2>
                    {loading ? (
                        <div className="text-center p-4"><RefreshCw className="animate-spin" size={24} /></div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                            {products.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    style={{
                                        border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', background: 'var(--surface)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                                >
                                    {p.image_url && (
                                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                                    )}
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{p.name}</h3>
                                    <p className="text-bold text-primary" style={{ fontSize: '1.1rem' }}>R$ {p.price.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lado Direito: Carrinho e Checkout */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 className="flex items-center gap-2 mb-4"><ShoppingCart size={20} /> Resumo da Venda</h2>

                    <div className="form-group">
                        <label>Cliente (Opcional)</label>
                        <select className="select-field" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                            <option value="">Consumidor Final</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: 1, minHeight: '200px', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '16px', overflowY: 'auto' }}>
                        {cart.length === 0 ? (
                            <div className="text-center text-muted h-full flex items-center justify-center flex-col mt-4">
                                <ShoppingCart size={32} opacity={0.3} className="mb-2" />
                                Selecione produtos ao lado
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border" style={{ background: '#fff', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <p className="text-bold" style={{ margin: 0 }}>{item.name}</p>
                                            <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>R$ {item.price.toFixed(2)} x {item.qty}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="btn-icon-only text-danger" style={{ minWidth: '32px', minHeight: '32px', padding: 0 }} onClick={() => updateCartQty(item.id, -1)}>-</button>
                                            <span style={{ fontWeight: 600, width: '20px', textAlign: 'center' }}>{item.qty}</span>
                                            <button className="btn-icon-only text-success" style={{ minWidth: '32px', minHeight: '32px', padding: 0, color: 'var(--success)' }} onClick={() => updateCartQty(item.id, 1)}>+</button>
                                            <button className="btn-icon-only text-danger" style={{ minWidth: '32px', minHeight: '32px', padding: 0, marginLeft: '8px' }} onClick={() => removeCartItem(item.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Forma de Pagamento</label>
                        <div className="flex gap-2" style={{ overflowX: 'auto' }}>
                            {['Pix', 'Dinheiro', 'Cartão'].map(method => (
                                <button
                                    key={method}
                                    className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1, minHeight: '40px', padding: '8px' }}
                                    onClick={() => setPaymentMethod(method)}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 mb-4 pb-4" style={{ borderBottom: '2px dashed #e5e7eb' }}>
                        <span className="text-muted" style={{ fontSize: '1.2rem' }}>Total:</span>
                        <span className="text-bold" style={{ fontSize: '2rem', color: 'var(--primary)' }}>
                            R$ {totalCart.toFixed(2)}
                        </span>
                    </div>

                    <button className="btn btn-primary btn-block" style={{ height: '60px', fontSize: '1.2rem', marginBottom: editingSaleId ? '8px' : '0' }} onClick={confirmSale} disabled={cart.length === 0 || isSubmitting}>
                        {isSubmitting ? <RefreshCw className="animate-spin" /> : (editingSaleId ? 'Salvar Alterações' : 'Finalizar Venda')}
                    </button>
                    {editingSaleId && (
                        <button className="btn btn-outline btn-block" onClick={cancelEdit}>Cancelar Edição</button>
                    )}
                </div>
            </div>

            {/* Histórico de Vendas Recentes */}
            <div className="card mt-4">
                <h2>Histórico de Vendas</h2>
                <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentSales.length === 0 && (
                        <p className="text-center text-muted">Sem vendas recentes</p>
                    )}
                    {recentSales.map(sale => (
                        <div key={sale.id} className="flex justify-between items-center p-3" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <p className="text-bold" style={{ fontSize: '0.9rem', margin: '0 0 4px 0' }}>{sale.clients?.name || 'Avulso'}</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 4px 0', color: '#64748b' }}>
                                    {sale.sale_items?.map(i => `${i.quantity}x ${i.products?.name}`).join(', ')}
                                </p>
                                <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                                    {new Date(sale.created_at).toLocaleString('pt-BR')} • <span className="badge badge-primary" style={{ fontSize: '10px' }}>{sale.payment_method}</span>
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-bold text-success" style={{ fontSize: '1.1rem' }}>R$ {parseFloat(sale.total).toFixed(2)}</span>
                                <button className="btn-icon-only text-primary" style={{ background: '#f3e8ff', border: 'none', cursor: 'pointer', padding: '6px', minWidth: '36px', minHeight: '36px' }} onClick={() => handleEditSale(sale)}>
                                    ✏️ Editar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
