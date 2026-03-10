import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertTriangle, Users } from 'lucide-react';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        todayRev: 0,
        weekRev: 0,
        monthRev: 0,
        totalSales: 0,
        avgTicket: 0,
    });

    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [topProducts, setTopProducts] = useState({ labels: [], data: [] });
    const [topClients, setTopClients] = useState({ labels: [], data: [] });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);

        try {
            // 1. Fetch Sales Data (mock implementation for visuals if DB empty)
            const { data: sales, error: salesError } = await supabase.from('sales').select('*');

            let revToday = 0, revWeek = 0, revMonth = 0, total = 0;
            const today = new Date();

            const mockedSales = salesError || !sales?.length ? [] : sales;

            mockedSales.forEach(sale => {
                const saleDate = new Date(sale.created_at);
                const dayDiff = Math.floor((today - saleDate) / (1000 * 60 * 60 * 24));

                const val = parseFloat(sale.total);
                if (dayDiff === 0) revToday += val;
                if (dayDiff <= 7) revWeek += val;
                if (dayDiff <= 30) revMonth += val;
                total++;
            });

            setMetrics({
                todayRev: revToday,
                weekRev: revWeek,
                monthRev: revMonth,
                totalSales: total,
                avgTicket: total > 0 ? (revMonth / total) : 0,
            });

            // 2. Fetch Stock Data
            const { data: products } = await supabase.from('products').select('name, stock, status').eq('status', true);
            const activeProds = products || [];

            setLowStockProducts(activeProds.filter(p => p.stock <= 5).slice(0, 5));

            // Em um cenário real de banco, você faria uma query agrupa os produtos mais vendidos.
            // Como exemplo, mantemos a estrutura vazia ou alimentada da sua própria query futura.
            setTopProducts({
                labels: [],
                data: []
            });

            // 4. Fetch Top Clients
            const { data: clientsData } = await supabase.from('clients').select(`
                name,
                sales (total)
            `);
            if (clientsData) {
                const clientTotals = clientsData.map(c => {
                    const totalSpent = c.sales.reduce((acc, s) => acc + parseFloat(s.total), 0);
                    return { name: c.name, total: totalSpent };
                }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

                setTopClients({
                    labels: clientTotals.map(c => c.name),
                    data: clientTotals.map(c => c.total)
                });
            }

        } catch (e) {
            console.error(e);
        }

        setLoading(false);
    };

    const chartData = {
        labels: topProducts.labels,
        datasets: [
            {
                label: 'Vendas (Qtd)',
                data: topProducts.data,
                backgroundColor: 'rgba(124, 67, 189, 0.8)',
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
    };

    const clientChartData = {
        labels: topClients.labels,
        datasets: [
            {
                data: topClients.data,
                backgroundColor: [
                    '#4a148c',
                    '#7c43bd',
                    '#fbc02d',
                    '#10b981',
                    '#3b82f6'
                ],
                borderWidth: 0,
            },
        ],
    };

    const clientChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right' },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return ' R$ ' + context.raw.toFixed(2);
                    }
                }
            }
        },
    };

    return (
        <div className="container animate-fade-in">
            <h1>Visão Geral</h1>
            <p className="text-muted mb-4">Acompanhe os resultados do Açai Kalix</p>

            {/* Metrics Row */}
            <div className="grid-2 grid-4-desktop mb-4" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>

                <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Faturamento (Hoje)</h3>
                        <DollarSign size={20} color="var(--primary)" />
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                        R$ {metrics.todayRev.toFixed(2)}
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--secondary-dark)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Faturamento (Semana)</h3>
                        <TrendingUp size={20} color="var(--secondary-dark)" />
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                        R$ {metrics.weekRev.toFixed(2)}
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Faturamento (Mês)</h3>
                        <DollarSign size={20} color="var(--success)" />
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                        R$ {metrics.monthRev.toFixed(2)}
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Ticket Médio</h3>
                        <ShoppingBag size={20} color="#3b82f6" />
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                        R$ {metrics.avgTicket.toFixed(2)}
                    </p>
                </div>

            </div>

            <div className="grid-2 mb-4">
                {/* Top Products Chart */}
                <div className="card h-full">
                    <h2 style={{ fontSize: '1.1rem' }}>Produtos Mais Vendidos</h2>
                    <div style={{ height: '250px', marginTop: '16px' }}>
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                </div>

                {/* Top Clients Chart */}
                <div className="card h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Top Clientes (Por Faturamento)</h2>
                    </div>
                    {topClients.data.length === 0 ? (
                        <p className="text-muted text-center mt-4">Ainda não há clientes com compras registradas.</p>
                    ) : (
                        <div style={{ height: '220px' }}>
                            <Doughnut data={clientChartData} options={clientChartOptions} />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid-2 mb-4">
                {/* Low Stock Alerts */}
                <div className="card h-full" style={{ gridColumn: '1 / -1' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={24} color="var(--warning)" />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Estoque Baixo</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {lowStockProducts.length === 0 ? (
                            <p className="text-muted">Todos os produtos com estoque regular.</p>
                        ) : (
                            lowStockProducts.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center" style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#92400e' }}>{p.name}</span>
                                    <span className="badge badge-warning">{p.stock} un. restantes</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
