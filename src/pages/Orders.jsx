import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    ClipboardList, 
    Plus, 
    Search, 
    X, 
    CheckCircle2, 
    Clock, 
    PlayCircle, 
    TrendingUp, 
    Calendar,
    ChevronDown,
    ChevronUp,
    RefreshCw
} from 'lucide-react';
import { formatCurrency, confirmAlert, successAlert, errorAlert } from '../utils';

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        client_id: '',
        product_id: '',
        quantity: 1,
        notes: '',
        scheduled_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchData();
        const subscription = supabase
            .channel('orders-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get today and next 7 days in proper format
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            // Fetch everything in parallel and independently
            const [ordersRes, productsRes, clientsRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select(`
                        *,
                        clients (name),
                        products (name, category)
                    `)
                    .gte('scheduled_date', todayStr)
                    .lte('scheduled_date', nextWeekStr)
                    .order('scheduled_date', { ascending: true }),
                supabase
                    .from('products')
                    .select('*')
                    .eq('category', 'Açaí')
                    .eq('status', true)
                    .order('name'),
                supabase
                    .from('clients')
                    .select('id, name')
                    .order('name')
            ]);

            if (ordersRes.error) console.error('Error fetching orders:', ordersRes.error);
            if (productsRes.error) console.error('Error fetching products:', productsRes.error);
            if (clientsRes.error) console.error('Error fetching clients:', clientsRes.error);

            setOrders(ordersRes.data || []);
            setProducts(productsRes.data || []);
            setClients(clientsRes.data || []);
        } catch (error) {
            console.error('Unexpected error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Ensure IDs are null if empty, to avoid UUID validation errors
            const payload = {
                ...formData,
                client_id: formData.client_id || null,
                product_id: formData.product_id || null,
                status: 'A fazer'
            };

            const { error } = await supabase.from('orders').insert([payload]);

            if (error) throw error;

            successAlert('Encomenda registrada!');
            setIsFormOpen(false);
            setFormData({
                client_id: '',
                product_id: '',
                quantity: 1,
                notes: '',
                scheduled_date: new Date().toISOString().split('T')[0]
            });
            fetchData();
        } catch (error) {
            console.error('Error saving order:', error);
            errorAlert('Erro', 'Não foi possível registrar a encomenda. Verifique os dados.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (id, currentStatus) => {
        let newStatus = '';
        if (currentStatus === 'A fazer') newStatus = 'Em preparo';
        else if (currentStatus === 'Em preparo') newStatus = 'Finalizado';
        else return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchData(); // Refresh immediately
        } catch (error) {
            errorAlert('Erro', 'Falha ao atualizar status.');
        }
    };

    // Calculate Indicators
    const todayStr = new Date().toISOString().split('T')[0];
    const totalToday = orders.filter(o => o.scheduled_date === todayStr).length;
    const inProgress = orders.filter(o => o.status === 'Em preparo').length;
    const finished = orders.filter(o => o.status === 'Finalizado').length;

    // Grouping logic - Defensive
    const groupedOrders = orders.reduce((acc, order) => {
        const productData = order.products;
        const productName = Array.isArray(productData) ? productData[0]?.name : productData?.name;
        const key = productName || 'Desconhecido';
        
        if (!acc[key]) acc[key] = [];
        acc[key].push(order);
        return acc;
    }, {});

    const sortedGroups = Object.entries(groupedOrders).sort((a, b) => b[1].length - a[1].length);

    const getStatusColor = (status) => {
        switch (status) {
            case 'A fazer': return '#fef3c7'; // yellow-100
            case 'Em preparo': return '#dbeafe'; // blue-100
            case 'Finalizado': return '#dcfce7'; // green-100
            default: return '#f3f4f6';
        }
    };

    const getStatusTextColor = (status) => {
        switch (status) {
            case 'A fazer': return '#92400e'; // yellow-800
            case 'Em preparo': return '#1e40af'; // blue-800
            case 'Finalizado': return '#166534'; // green-800
            default: return '#374151';
        }
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Painel de Encomendas</h1>
                    <p className="text-muted">Organização da produção</p>
                </div>
                <button className="btn btn-primary flex items-center gap-2" onClick={() => setIsFormOpen(true)}>
                    <Plus size={20} /> Nova Encomenda
                </button>
            </div>

            {/* Sumário de Indicadores */}
            <div className="grid-3 mb-6">
                <div className="card text-center" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <p className="text-muted mb-1">Total Hoje</p>
                    <h2 style={{ fontSize: '2rem' }}>{totalToday}</h2>
                </div>
                <div className="card text-center" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <p className="text-muted mb-1">Em Preparo</p>
                    <h2 style={{ fontSize: '2rem', color: '#3b82f6' }}>{inProgress}</h2>
                </div>
                <div className="card text-center" style={{ borderLeft: '4px solid #22c55e' }}>
                    <p className="text-muted mb-1">Finalizados</p>
                    <h2 style={{ fontSize: '2rem', color: '#22c55e' }}>{finished}</h2>
                </div>
            </div>

            {/* Sabores mais pedidos */}
            <div className="card mb-6">
                <h3 className="flex items-center gap-2 mb-4"><TrendingUp size={18} /> Ranking de Produção</h3>
                <div className="flex gap-4 flex-wrap">
                    {sortedGroups.slice(0, 5).map(([name, items]) => (
                        <div key={name} className="badge badge-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                            {name} → {items.length} pedidos
                        </div>
                    ))}
                </div>
            </div>

            {/* Painel de Produção Agrupado */}
            <div className="production-panel">
                {loading ? (
                    <div className="text-center p-8"><RefreshCw className="animate-spin" size={32} /></div>
                ) : sortedGroups.length === 0 ? (
                    <div className="card text-center p-8">
                        <ClipboardList size={48} className="mx-auto text-muted mb-4" opacity={0.3} />
                        <p className="text-muted">Nenhuma encomenda para os próximos 7 dias.</p>
                    </div>
                ) : (
                    sortedGroups.map(([productName, productOrders]) => (
                        <div key={productName} className="card mb-4" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, color: 'var(--secondary)' }}>{productName}</h3>
                                <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>{productOrders.length} pedidos</span>
                            </div>
                            <div className="orders-list">
                                {productOrders.map(order => (
                                    <div key={order.id} className="order-item" style={{ 
                                        padding: '16px', 
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p className="text-bold" style={{ margin: 0, fontSize: '1.1rem' }}>{order.clients?.name || 'Cliente Avulso'}</p>
                                                <p className="text-muted" style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                                                    <Calendar size={14} style={{ marginBottom: '-2px' }} /> {new Date(order.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                                                    {order.notes && <span style={{ marginLeft: '12px' }}>• {order.notes}</span>}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p className="text-bold" style={{ color: 'var(--primary)', margin: 0 }}>{order.quantity} Unid.</p>
                                                <span 
                                                    className="badge" 
                                                    style={{ 
                                                        backgroundColor: getStatusColor(order.status), 
                                                        color: getStatusTextColor(order.status),
                                                        marginTop: '8px',
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    {order.status}
                                                </span>
                                            </div>
                                        </div>

                                        {order.status !== 'Finalizado' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                                <button 
                                                    className="btn btn-block flex items-center justify-center gap-2"
                                                    style={{ 
                                                        height: '48px', 
                                                        backgroundColor: order.status === 'A fazer' ? '#3b82f6' : '#22c55e',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 'bold',
                                                        fontSize: '1rem'
                                                    }}
                                                    onClick={() => updateStatus(order.id, order.status)}
                                                >
                                                    {order.status === 'A fazer' ? (
                                                        <><PlayCircle size={20} /> Começar Preparo</>
                                                    ) : (
                                                        <><CheckCircle2 size={20} /> Finalizar Produção</>
                                                    ) }
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de Nova Encomenda */}
            {isFormOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '16px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2>Nova Encomenda</h2>
                            <button className="btn-icon-only text-muted" onClick={() => setIsFormOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="form-group">
                                <label>Cliente</label>
                                <select 
                                    name="client_id" 
                                    className="select-field" 
                                    value={formData.client_id} 
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Selecione o Cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Produto / Sabor</label>
                                <select 
                                    name="product_id" 
                                    className="select-field" 
                                    value={formData.product_id} 
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Selecione o Produto</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label>Quantidade</label>
                                    <input 
                                        type="number" 
                                        name="quantity" 
                                        className="input-field" 
                                        min="1" 
                                        value={formData.quantity} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data de Entrega</label>
                                    <input 
                                        type="date" 
                                        name="scheduled_date" 
                                        className="input-field" 
                                        value={formData.scheduled_date} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Observações (opcional)</label>
                                <textarea 
                                    name="notes" 
                                    className="input-field" 
                                    rows="3" 
                                    placeholder="Ex: Sem granola, adicionar leite em pó..."
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                ></textarea>
                            </div>

                            <button type="submit" className="btn btn-primary btn-block" style={{ height: '50px', marginTop: '12px' }} disabled={submitting}>
                                {submitting ? <RefreshCw className="animate-spin" /> : 'Confirmar Encomenda'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
