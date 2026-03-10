import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, X, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils';

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: ''
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setLoading(true);
        // In a real scenario with proper SQL views or triggers, total_purchases 
        // and total_spent would be updated directly by the DB or calculated via RPC.
        // For this simple demo, we fetch clients and also count their sales manually if needed,
        // though the DB schema already has these fields if maintained via triggers.
        // Let's assume we do a quick count or just use the fields.
        const { data, error } = await supabase.from('clients').select(`
      id, name, phone, created_at,
      sales(id, total, created_at)
    `).order('name');

        // Calculate stats on the fly since we didn't write an SQL trigger
        if (data) {
            const compiled = data.map(c => {
                const totalSales = c.sales.length;
                const totalSpent = c.sales.reduce((acc, s) => acc + parseFloat(s.total), 0);
                const avgTicket = totalSales > 0 ? (totalSpent / totalSales) : 0;
                const lastSaleDate = totalSales > 0 ? Math.max(...c.sales.map(s => new Date(s.created_at).getTime())) : null;

                return {
                    id: c.id,
                    name: c.name,
                    phone: c.phone || 'Sem telefone',
                    totalPurchases: totalSales,
                    totalSpent: totalSpent,
                    avgTicket: avgTicket,
                    lastPurchase: lastSaleDate ? new Date(lastSaleDate).toLocaleDateString('pt-BR') : '-'
                };
            });
            setClients(compiled);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (editingId) {
            const { error } = await supabase.from('clients').update(formData).eq('id', editingId);
            if (!error) {
                setIsFormOpen(false);
                setFormData({ name: '', phone: '' });
                setEditingId(null);
                fetchClients();
            }
        } else {
            const { error } = await supabase.from('clients').insert([formData]);
            if (!error) {
                setIsFormOpen(false);
                setFormData({ name: '', phone: '' });
                fetchClients();
            }
        }
        setLoading(false);
    };

    const handleEdit = (client) => {
        setFormData({
            name: client.name,
            phone: client.phone === 'Sem telefone' ? '' : client.phone
        });
        setEditingId(client.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
            setLoading(true);
            await supabase.from('clients').delete().eq('id', id);
            fetchClients();
        }
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '' });
        setEditingId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Clientes</h1>
                    <p className="text-muted">Sua base de clientes</p>
                </div>
                {!isFormOpen && (
                    <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        <Plus size={20} /> <span className="hide-mobile">Novo Cliente</span>
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="card mb-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2>{editingId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
                        <button className="btn-icon-only text-muted" onClick={resetForm} style={{ background: 'transparent', border: 'none' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid-2">
                        <div className="form-group">
                            <label>Nome Completo</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" required />
                        </div>
                        <div className="form-group">
                            <label>Telefone / WhatsApp (Opcional)</label>
                            <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input-field" placeholder="(00) 00000-0000" />
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Cadastro'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="text-center p-4"><RefreshCw className="animate-spin" size={24} /></div>
                ) : (
                    <div className="table-wrapper">
                        <div className="clients-list">
                            {clients.length === 0 && (
                                <p className="text-center text-muted p-4">Ainda não há clientes cadastrados.</p>
                            )}
                            {clients.map(c => (
                                <div key={c.id} className="client-card" style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1rem' }} className="text-bold">{c.name}</h3>
                                            <p style={{ margin: 0, fontSize: '0.85rem' }} className="text-muted">{c.phone}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="btn-icon-only text-primary" style={{ minHeight: '32px', minWidth: '32px', padding: '6px', background: '#f3e8ff', border: 'none', cursor: 'pointer' }} onClick={() => handleEdit(c)}>
                                                ✏️
                                            </button>
                                            <button className="btn-icon-only text-danger" style={{ minHeight: '32px', minWidth: '32px', padding: '6px', background: '#fee2e2', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(c.id)}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center" style={{ marginTop: '8px', marginBottom: '8px' }}>
                                        <div className="text-left">
                                            <p style={{ margin: 0, color: 'var(--success)', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(c.totalSpent)}</p>
                                            <p style={{ margin: 0, fontSize: '0.75rem' }} className="text-muted">{c.totalPurchases} compras</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between" style={{ fontSize: '0.85rem', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                                        <span>Ticket Médio: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(c.avgTicket)}</strong></span>
                                        <span>Última: <strong style={{ color: 'var(--text-main)' }}>{c.lastPurchase}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
