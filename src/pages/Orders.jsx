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
            // Removed spaces in select string as PostgREST can be sensitive
            const [ordersRes, productsRes, clientsRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*,clients(name),products(name,category)')
                    .gte('scheduled_date', todayStr)
                    .lte('scheduled_date', nextWeekStr)
                    .order('scheduled_date', { ascending: true }),
                supabase
                    .from('products')
                    .select('*')
                    .in('category', ['Açaí', 'Bebidas'])
                    .eq('status', true)
                    .order('name'), // Only final products, no ingredients
                supabase
                    .from('clients')
                    .select('id, name')
                    .order('name')
            ]);

            if (ordersRes.error) {
                console.error('Error fetching orders:', ordersRes.error);
                // If the error is 42P01, the table doesn't exist
                if (ordersRes.error.code === '42P01') {
                    errorAlert('Erro do Sistema', 'A tabela de encomendas ainda não foi criada no banco de dados. Verifique o arquivo schema.sql.');
                }
            }
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
            // Ensure numeric values are parsed
            const payload = {
                client_id: formData.client_id || null,
                product_id: formData.product_id || null,
                quantity: parseInt(formData.quantity, 10),
                notes: formData.notes,
                scheduled_date: formData.scheduled_date,
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
            errorAlert('Erro', 'Não foi possível registrar a encomenda. Verifique se o produto e cliente foram selecionados.');
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
    const todaysOrders = orders.filter(o => o.scheduled_date === todayStr);
    const totalToday = todaysOrders.length;
    const toTodo = orders.filter(o => o.status === 'A fazer').length;
    const inProgress = orders.filter(o => o.status === 'Em preparo').length;
    const finished = orders.filter(o => o.status === 'Finalizado').length;

    // Helper to get name from potentially array or object join result
    const getJoinedName = (data) => {
        if (!data) return null;
        if (Array.isArray(data)) return data[0]?.name;
        return data.name;
    };

    // Grouping logic - Defensive
    const groupedOrders = orders.reduce((acc, order) => {
        const productName = getJoinedName(order.products);
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

    const getStatusBorderColor = (status) => {
        switch (status) {
            case 'A fazer': return '#f59e0b'; // amber-500
            case 'Em preparo': return '#3b82f6'; // blue-500
            case 'Finalizado': return '#22c55e'; // green-500
            default: return '#e2e8f0';
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="card text-center" style={{ borderLeft: '4px solid #64748b' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Total Hoje</p>
                    <h2 style={{ fontSize: '1.8rem' }}>{totalToday}</h2>
                </div>
                <div className="card text-center" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>A Fazer</p>
                    <h2 style={{ fontSize: '1.8rem', color: '#f59e0b' }}>{toTodo}</h2>
                </div>
                <div className="card text-center" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Em Preparo</p>
                    <h2 style={{ fontSize: '1.8rem', color: '#3b82f6' }}>{inProgress}</h2>
                </div>
                <div className="card text-center" style={{ borderLeft: '4px solid #22c55e' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Finalizados</p>
                    <h2 style={{ fontSize: '1.8rem', color: '#22c55e' }}>{finished}</h2>
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
                                        gap: '12px',
                                        borderLeft: `6px solid ${getStatusBorderColor(order.status)}`,
                                        backgroundColor: order.status === 'A fazer' ? '#fffaf0' : 'white'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p className="text-bold" style={{ margin: 0, fontSize: '1.1rem' }}>{getJoinedName(order.clients) || 'Cliente Avulso'}</p>
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
                                                        display: 'inline-block',
                                                        fontWeight: 'bold'
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
                                                        height: '54px', 
                                                        backgroundColor: order.status === 'A fazer' ? '#f59e0b' : '#22c55e',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '12px',
                                                        fontWeight: '900',
                                                        fontSize: '1.1rem',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                    onClick={() => updateStatus(order.id, order.status)}
                                                >
                                                    {order.status === 'A fazer' ? (
                                                        <><PlayCircle size={22} /> Começar Preparo</>
                                                    ) : (
                                                        <><CheckCircle2 size={22} /> Finalizar Produção</>
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
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '8px'
                }}>
                    <div className="card" style={{ 
                        width: '100%', 
                        maxWidth: '420px', 
                        maxHeight: '98vh', 
                        overflowY: 'auto',
                        padding: '12px 16px' 
                    }}>
                        <div className="flex justify-between items-center mb-2">
                            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Nova Encomenda</h2>
                            <button className="btn-icon-only text-muted" onClick={() => setIsFormOpen(false)} style={{ padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                            <div className="form-group" style={{ marginBottom: '4px' }}>
                                <label style={{ marginBottom: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>Cliente</label>
                                <select 
                                    name="client_id" 
                                    className="select-field" 
                                    style={{ height: '38px', fontSize: '0.9rem' }}
                                    value={formData.client_id} 
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Selecione o Cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '4px' }}>
                                <label style={{ marginBottom: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>Produto / Sabor</label>
                                <select 
                                    name="product_id" 
                                    className="select-field" 
                                    style={{ height: '38px', fontSize: '0.9rem' }}
                                    value={formData.product_id} 
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Selecione o Produto</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="grid-2" style={{ gap: '10px' }}>
                                <div className="form-group" style={{ marginBottom: '4px' }}>
                                    <label style={{ marginBottom: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>Qtd</label>
                                    <input 
                                        type="number" 
                                        name="quantity" 
                                        className="input-field" 
                                        style={{ height: '38px', fontSize: '0.9rem' }}
                                        min="1" 
                                        value={formData.quantity} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '4px' }}>
                                    <label style={{ marginBottom: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>Data</label>
                                    <input 
                                        type="date" 
                                        name="scheduled_date" 
                                        className="input-field" 
                                        style={{ height: '38px', fontSize: '0.9rem', padding: '4px 8px' }}
                                        value={formData.scheduled_date} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '2px' }}>
                                <label style={{ marginBottom: '2px', fontSize: '0.8rem', fontWeight: 'bold' }}>Observações (opcional)</label>
                                <textarea 
                                    name="notes" 
                                    className="input-field" 
                                    style={{ fontSize: '0.85rem', padding: '6px 8px' }}
                                    rows="1" 
                                    placeholder="Ex: Sem açúcar..."
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                ></textarea>
                            </div>

                            <button type="submit" className="btn btn-primary btn-block" style={{ height: '48px', marginTop: '4px', fontSize: '1rem', fontWeight: 'bold' }} disabled={submitting}>
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : 'Confirmar Encomenda'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
