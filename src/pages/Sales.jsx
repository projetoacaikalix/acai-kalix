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

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('products').select('*').eq('status', true).order('name');
        const { data: cData } = await supabase.from('clients').select('id, name').order('name');

        setProducts(pData || []);
        setClients(cData || []);
        setLoading(false);
    };

    const addToCart = (product) => {
        if (product.stock <= 0) {
            alert('Produto esgotado no estoque!');
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty >= product.stock) {
                    alert('Quantidade máxima no estoque atingida.');
                    return prev;
                }
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

            if (delta > 0 && newQty > existing.stock) {
                alert('Quantidade máxima no estoque atingida.');
                return prev;
            }

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
            // 1. Insert Sale
            const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
                client_id: selectedClient || null,
                total: totalCart,
                payment_method: paymentMethod
            }]).select();

            if (saleError) throw saleError;
            const saleId = saleData[0].id;

            // 2. Insert Sale Items, Update Stock, Create Stock Movements
            for (const item of cart) {
                // Items
                await supabase.from('sale_items').insert([{
                    sale_id: saleId,
                    product_id: item.id,
                    quantity: item.qty,
                    price: item.price
                }]);

                // Stock Output Move
                await supabase.from('stock_movements').insert([{
                    product_id: item.id,
                    type: 'out',
                    quantity: item.qty,
                    reason: `Venda #${saleId.slice(0, 8)}`
                }]);

                // Update product table stock
                await supabase.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id);
            }

            setSuccessMsg('Venda registrada com sucesso!');

            // Reset
            setCart([]);
            setSelectedClient('');
            fetchInitialData(); // refetch products to get updated stock

            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (e) {
            console.error('Erro ao finalizar venda', e);
            alert('Erro ao finalizar venda.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Caixa / Nova Venda</h1>
                    <p className="text-muted">Atendimento rápido</p>
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
                                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>Estoque: {p.stock}</p>
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

                    <button className="btn btn-primary btn-block" style={{ height: '60px', fontSize: '1.2rem' }} onClick={confirmSale} disabled={cart.length === 0 || isSubmitting}>
                        {isSubmitting ? <RefreshCw className="animate-spin" /> : 'Finalizar Venda'}
                    </button>
                </div>
            </div>
        </div>
    );
}
