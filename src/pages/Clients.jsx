import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, X, RefreshCw } from 'lucide-react';

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: ''
    });

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

        const { error } = await supabase.from('clients').insert([formData]);
        if (!error) {
            setIsFormOpen(false);
            setFormData({ name: '', phone: '' });
            fetchClients();
        } else {
            console.error(error);
        }
        setLoading(false);
    };

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Clientes</h1>
                    <p className="text-muted">Sua base de clientes VIP</p>
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
                        <h2>Cadastrar Novo Cliente</h2>
                        <button className="btn-icon-only text-muted" onClick={() => setIsFormOpen(false)} style={{ background: 'transparent', border: 'none' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid-2">
                        <div className="form-group">
                            <label>Nome Completo</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" required />
                        </div>
                        <div className="form-group">
                            <label>Telefone / WhatsApp</label>
                            <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input-field" placeholder="(00) 00000-0000" required />
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
                        <table>
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Telefone</th>
                                    <th>Qtd Compras</th>
                                    <th>Valor Gasto</th>
                                    <th>Ticket Médio</th>
                                    <th>Última Compra</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.length === 0 && (
                                    <tr><td colSpan="6" className="text-center text-muted">Ainda não há clientes cadastrados.</td></tr>
                                )}
                                {clients.map(c => (
                                    <tr key={c.id}>
                                        <td className="text-bold">{c.name}</td>
                                        <td>{c.phone}</td>
                                        <td>{c.totalPurchases}</td>
                                        <td className="text-bold" style={{ color: 'var(--success)' }}>R$ {c.totalSpent.toFixed(2)}</td>
                                        <td>R$ {c.avgTicket.toFixed(2)}</td>
                                        <td>{c.lastPurchase}</td>
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
