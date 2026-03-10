import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils';
import { TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Users, Calendar, Award } from 'lucide-react';

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
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    ChartDataLabels
);

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const getFirstDayOfMonth = () => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    };
    const getLastDayOfMonth = () => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    };

    const [dateFilter, setDateFilter] = useState({
        start: getFirstDayOfMonth(),
        end: getLastDayOfMonth()
    });

    const [metrics, setMetrics] = useState({
        periodRev: 0,
        totalSales: 0,
        avgTicket: 0,
        maxSale: 0
    });

    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [topProducts, setTopProducts] = useState({ labels: [], data: [] });
    const [topClients, setTopClients] = useState({ labels: [], data: [] });

    useEffect(() => {
        fetchDashboardData();
    }, [dateFilter]);

    const fetchDashboardData = async () => {
        setLoading(true);

        try {
            // 1. Fetch Sales Data (mock implementation for visuals if DB empty)
            let salesQuery = supabase.from('sales').select('*');
            if (dateFilter.start) salesQuery = salesQuery.gte('created_at', `${dateFilter.start}T00:00:00`);
            if (dateFilter.end) salesQuery = salesQuery.lte('created_at', `${dateFilter.end}T23:59:59`);

            const { data: sales, error: salesError } = await salesQuery;

            let revTotal = 0, total = 0, max = 0;
            const mockedSales = salesError || !sales?.length ? [] : sales;

            mockedSales.forEach(sale => {
                const val = parseFloat(sale.total) || 0;
                revTotal += val;
                if (val > max) max = val;
                total++;
            });

            setMetrics({
                periodRev: revTotal,
                totalSales: total,
                avgTicket: total > 0 ? (revTotal / total) : 0,
                maxSale: max
            });

            // 2. Fetch Stock Data
            const { data: products } = await supabase.from('products').select('name, stock, status').eq('status', true);
            const activeProds = products || [];

            setLowStockProducts(activeProds.filter(p => p.stock <= 5).slice(0, 5));

            // Em um cenário real de banco, você faria uma query agrupa os produtos mais vendidos.
            // Para simplificar e resolver diretamente via RPC ou join via frontend:
            let siQuery = supabase.from('sale_items').select('quantity, sales!inner(created_at), products!inner(name, category)');
            if (dateFilter.start) siQuery = siQuery.gte('sales.created_at', `${dateFilter.start}T00:00:00`);
            if (dateFilter.end) siQuery = siQuery.lte('sales.created_at', `${dateFilter.end}T23:59:59`);

            const { data: saleItems } = await siQuery;

            if (saleItems) {
                const productTotals = {};
                saleItems.forEach(item => {
                    if (item.products?.category === 'Açaí') {
                        const amount = parseInt(item.quantity) || 0;
                        productTotals[item.products.name] = (productTotals[item.products.name] || 0) + amount;
                    }
                });

                const sortedProducts = Object.keys(productTotals)
                    .map(name => ({ name, qty: productTotals[name] }))
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 5);

                setTopProducts({
                    labels: sortedProducts.map(p => p.name),
                    data: sortedProducts.map(p => p.qty)
                });
            }

            // 4. Fetch Top Clients
            let clientsQuery = supabase.from('sales').select('total, clients!inner(name)');
            if (dateFilter.start) clientsQuery = clientsQuery.gte('created_at', `${dateFilter.start}T00:00:00`);
            if (dateFilter.end) clientsQuery = clientsQuery.lte('created_at', `${dateFilter.end}T23:59:59`);

            const { data: clientSalesData } = await clientsQuery;
            if (clientSalesData) {
                const clientTotalsMap = {};
                clientSalesData.forEach(sale => {
                    if (sale.clients?.name) {
                        clientTotalsMap[sale.clients.name] = (clientTotalsMap[sale.clients.name] || 0) + parseFloat(sale.total);
                    }
                });

                const clientTotals = Object.keys(clientTotalsMap).map(name => ({
                    name,
                    total: clientTotalsMap[name]
                })).sort((a, b) => b.total - a.total).slice(0, 5);

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
        indexAxis: 'y', // Barra horizontal
        plugins: {
            legend: { display: false },
            datalabels: {
                display: true,
                color: '#fff',
                font: { weight: 'bold' }
            }
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
            datalabels: {
                color: '#ffffff',
                font: { weight: 'bold', size: 12 },
                formatter: (value) => formatCurrency(value)
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return ' ' + formatCurrency(context.raw);
                    }
                }
            }
        },
    };

    return (
        <div className="container animate-fade-in">
            <h1>Visão Geral</h1>
            <p className="text-muted mb-4">Acompanhe os resultados do Açai Kalix</p>

            {/* Filtro de Data Compacto */}
            <div className="card mb-4" style={{ padding: '16px', borderLeft: '4px solid var(--primary)' }}>
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <Calendar size={20} color="var(--primary)" />
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Período de Análise</h3>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 130px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Data Inicial</label>
                        <input
                            type="date"
                            className="input-field"
                            style={{ padding: '8px' }}
                            value={dateFilter.start}
                            onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })}
                        />
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Data Final</label>
                        <input
                            type="date"
                            className="input-field"
                            style={{ padding: '8px' }}
                            value={dateFilter.end}
                            onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-2" style={{ flex: '1 1 200px' }}>
                        <button className="btn btn-primary" style={{ flex: 1, padding: '8px' }} onClick={() => fetchDashboardData()}>
                            Aplicar
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => {
                            setDateFilter({ start: getFirstDayOfMonth(), end: getLastDayOfMonth() });
                            setTimeout(fetchDashboardData, 100);
                        }}>
                            Mês Atual
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid-2 grid-4-desktop mb-4" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>

                <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Faturamento</h3>
                        <DollarSign size={20} color="var(--success)" />
                    </div>
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                        {formatCurrency(metrics.periodRev)}
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Vendas (Qtd)</h3>
                        <ShoppingBag size={20} color="var(--primary)" />
                    </div>
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                        {metrics.totalSales} <span style={{ fontSize: '1rem', color: '#666', fontWeight: 400 }}>pedidos</span>
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Ticket Médio</h3>
                        <TrendingUp size={20} color="#3b82f6" />
                    </div>
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                        {formatCurrency(metrics.avgTicket)}
                    </p>
                </div>

                <div className="card" style={{ borderLeft: '4px solid #fbc02d' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Maior Venda</h3>
                        <Award size={20} color="#f59e0b" />
                    </div>
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                        {formatCurrency(metrics.maxSale)}
                    </p>
                </div>

            </div>

            <div className="grid-2 mb-4">
                {/* Top Products Chart */}
                <div className="card h-full">
                    <h2 style={{ fontSize: '1.1rem' }}>Produtos Mais Vendidos</h2>
                    <div style={{ height: '250px', marginTop: '16px' }}>
                        {topProducts.data.length === 0 ? (
                            <p className="text-muted text-center mt-4">Nenhuma venda de Açaí registrada ainda.</p>
                        ) : (
                            <Bar data={chartData} options={chartOptions} />
                        )}
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


        </div>
    );
}
