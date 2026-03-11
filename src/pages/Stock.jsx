import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, PackagePlus, AlertCircle, Trash2, Calculator, BarChart2 } from 'lucide-react';
import { formatCurrency, confirmAlert, successAlert, errorAlert } from '../utils';

export default function Stock() {
    const [products, setProducts] = useState([]); // Ingredients
    const [acaiProducts, setAcaiProducts] = useState([]); // For simulator and capacity
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        product_name: '',
        unit: 'unidade',
        quantity: '',
        value: '',
        type: 'in'
    });
    const [editingId, setEditingId] = useState(null);

    // Simulator State
    const [simProduct, setSimProduct] = useState('');
    const [simQty, setSimQty] = useState('');
    const [simResults, setSimResults] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch ingredients (Complementos)
        const { data: pData } = await supabase
            .from('products')
            .select('id, name, stock, unit')
            .eq('status', true)
            .eq('category', 'Complementos')
            .order('name');

        // Fetch Açaí products for capacity calculations
        const { data: aData } = await supabase
            .from('products')
            .select('id, name, recipe')
            .eq('status', true)
            .eq('category', 'Açaí')
            .order('name');

        // Fetch movements
        const { data: mData } = await supabase
            .from('stock_movements')
            .select('*, products(name)')
            .order('created_at', { ascending: false })
            .limit(20);

        // Calcular o valor total investido por produto (soma de entradas)
        const { data: allMoves } = await supabase.from('stock_movements').select('product_id, type, value');

        const productsWithValue = (pData || []).map(prod => {
            let totalInvested = 0;
            if (allMoves) {
                allMoves.forEach(m => {
                    if (m.product_id === prod.id && m.type === 'in' && m.value) {
                        totalInvested += parseFloat(m.value);
                    }
                });
            }
            return {
                ...prod,
                totalValue: totalInvested,
                unit: prod.unit || 'unidade'
            };
        });

        setProducts(productsWithValue);
        setAcaiProducts(aData || []);
        setMovements(mData || []);
        setLoading(false);
    };

    const calculateCapacity = (recipe, ingredientsMap) => {
        if (!recipe || recipe.length === 0) return null; // Não dá pra calcular
        let maxCanMake = Infinity;

        for (const item of recipe) {
            const stockAvailable = ingredientsMap[item.ingredient_id] || 0;
            if (item.quantity > 0) {
                const canMakeWithThisIngredient = Math.floor(stockAvailable / item.quantity);
                if (canMakeWithThisIngredient < maxCanMake) {
                    maxCanMake = canMakeWithThisIngredient;
                }
            }
        }

        return maxCanMake === Infinity ? 0 : maxCanMake;
    };

    const handleSimulate = (e) => {
        e.preventDefault();
        if (!simProduct || !simQty || simQty <= 0) return;

        const product = acaiProducts.find(p => p.id === simProduct);
        if (!product || !product.recipe || product.recipe.length === 0) {
            errorAlert('Sem Receita', 'Este produto não possui receita cadastrada.');
            return;
        }

        const qtyToMake = parseInt(simQty, 10);
        let results = [];

        product.recipe.forEach(item => {
            const ingredient = products.find(p => p.id === item.ingredient_id);
            const stockAvailable = ingredient ? ingredient.stock : 0;
            const requiredAmount = item.quantity * qtyToMake;
            const missing = requiredAmount > stockAvailable ? requiredAmount - stockAvailable : 0;

            results.push({
                name: item.name || (ingredient ? ingredient.name : 'Insumo Desconhecido'),
                unit: item.unit || (ingredient ? ingredient.unit : 'un'),
                required: requiredAmount,
                available: stockAvailable,
                missing: missing
            });
        });

        setSimResults(results);
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
                const { data: oldMove } = await supabase.from('stock_movements').select('*').eq('id', editingId).single();
                if (oldMove && oldMove.product_id) {
                    const { data: currentProduct } = await supabase.from('products').select('stock').eq('id', oldMove.product_id).single();
                    if (currentProduct) {
                        let newStock = oldMove.type === 'in' ? currentProduct.stock - oldMove.quantity : currentProduct.stock + oldMove.quantity;
                        newStock = formData.type === 'in' ? newStock + qty : newStock - qty;
                        await supabase.from('products').update({ stock: newStock }).eq('id', oldMove.product_id);
                    }
                }

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
                    // Também atualiza a unidade se for diferente
                    await supabase.from('products').update({ stock: newStock, unit: formData.unit }).eq('id', currentProductId);
                } else {
                    const newStock = formData.type === 'in' ? qty : -qty;
                    const { data: newProd } = await supabase.from('products').insert([{
                        name: formData.product_name,
                        category: 'Complementos',
                        price: 0,
                        cost: 0,
                        stock: newStock,
                        unit: formData.unit
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
            successAlert('Movimentação registrada com sucesso!');
        } catch (e) {
            console.error(e);
            errorAlert('Erro na Movimentação', 'Houve um erro ao processar os dados de estoque.');
        }
    };

    const handleEdit = (movement) => {
        setFormData({
            product_name: movement.products?.name || '',
            unit: 'unidade', // Simplification, could fetch product unit
            quantity: movement.quantity,
            value: movement.value || '',
            type: movement.type
        });
        setEditingId(movement.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmAlert('Excluir Movimentação?', 'Excluir este registro do histórico de estoque? O saldo será recalculado.');
        if (confirmed) {
            setLoading(true);
            try {
                const { data: moveData } = await supabase.from('stock_movements').select('*').eq('id', id).single();
                if (moveData && moveData.product_id) {
                    const { data: currentProduct } = await supabase.from('products').select('stock').eq('id', moveData.product_id).single();
                    if (currentProduct) {
                        const newStock = moveData.type === 'in'
                            ? currentProduct.stock - moveData.quantity
                            : currentProduct.stock + moveData.quantity;
                        await supabase.from('products').update({ stock: newStock }).eq('id', moveData.product_id);
                    }
                }

                await supabase.from('stock_movements').delete().eq('id', id);
                fetchData();
                successAlert('Registro removido do histórico (Estoque Ajustado).');
            } catch (e) {
                console.error(e);
                errorAlert('Erro na Exclusão', 'Não foi possível reverter o estoque.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDeleteProduct = async (id) => {
        const confirmed = await confirmAlert('Excluir Insumo Permanentemente?', 'Isso apagará este componente da grade e excluirá todo seu histórico. Continuar?');
        if (confirmed) {
            setLoading(true);
            try {
                await supabase.from('stock_movements').delete().eq('product_id', id);
                await supabase.from('products').delete().eq('id', id);
                fetchData();
                successAlert('Insumo e histórico excluídos com sucesso.');
            } catch (e) {
                console.error(e);
                errorAlert('Erro na Exclusão', 'Não foi possível excluir o insumo.');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetForm = () => {
        setFormData({ product_name: '', unit: 'unidade', quantity: '', value: '', type: 'in' });
        setEditingId(null);
        setIsFormOpen(false);
    };

    // Prepare map for capacity calc
    const stockMap = products.reduce((acc, p) => ({ ...acc, [p.id]: p.stock }), {});

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1>Estoque</h1>
                    <p className="text-muted">Controle de insumos de produção</p>
                </div>
                {!isFormOpen && (
                    <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        <PackagePlus size={20} /> <span className="hide-mobile">Nova Movimentação</span>
                    </button>
                )}
            </div>

            {/* Visualização de Itens em Estoque (Tabela com Valores) */}
            <div className="card mb-4" style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Visão Geral do Estoque (Insumos)</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px', borderBottom: '2px solid #e2e8f0' }}>Insumo</th>
                                <th style={{ padding: '8px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Qtd</th>
                                <th style={{ padding: '8px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Valor Total</th>
                                <th style={{ padding: '8px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Nenhum insumo em estoque.</td>
                                </tr>
                            ) : (
                                products.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '8px', fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                                            {p.name}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: p.stock <= 5 ? 'var(--danger)' : 'var(--primary)' }}>
                                                {p.stock} <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>{p.unit}</span>
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                            {formatCurrency(p.totalValue || 0)}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <button className="btn-icon-only text-danger" title="Excluir Insumo" style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '6px', minWidth: '28px', minHeight: '28px' }} onClick={() => handleDeleteProduct(p.id)}>
                                                <Trash2 size={14} color="var(--danger)" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Capacidade de Produção */}
            <div className="card mb-4">
                <h2 className="flex items-center gap-2">
                    <BarChart2 size={24} color="var(--primary)" />
                    Capacidade de Produção
                </h2>
                <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                    Calculado automaticamente com base no estoque atual de insumos e nas receitas dos produtos.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {acaiProducts.filter(p => p.recipe && p.recipe.length > 0).length === 0 ? (
                        <p className="text-muted col-span-full">Nenhum produto possui receita cadastrada. Adicione receitas na aba Produtos.</p>
                    ) : (
                        acaiProducts.filter(p => p.recipe && p.recipe.length > 0).map(p => {
                            const maxCapacity = calculateCapacity(p.recipe, stockMap);
                            return (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 600, color: '#334155' }}>{p.name}</span>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>possível produzir</span>
                                        <span className={`badge ${maxCapacity > 0 ? 'badge-primary' : 'badge-danger'}`} style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                                            {maxCapacity} un.
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Simulador de Produção */}
            <div className="card mb-4" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <h2 className="flex items-center gap-2" style={{ color: '#0369a1' }}>
                    <Calculator size={24} />
                    Simulador de Produção
                </h2>
                <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                    Simule uma produção para ver os insumos necessários e o que precisa ser comprado.
                </p>

                <form onSubmit={handleSimulate} className="grid-2" style={{ alignItems: 'end' }}>
                    <div className="form-group mb-0">
                        <label>Produto</label>
                        <select className="select-field" value={simProduct} onChange={e => setSimProduct(e.target.value)} required>
                            <option value="">Selecione um Produto...</option>
                            {acaiProducts.filter(p => p.recipe && p.recipe.length > 0).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group mb-0 flex gap-2" style={{ alignItems: 'end' }}>
                        <div style={{ flex: 1 }}>
                            <label>Qtd Desejada (un)</label>
                            <input type="number" min="1" className="input-field" value={simQty} onChange={e => setSimQty(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px', background: '#0ea5e9', borderColor: '#0ea5e9' }}>
                            Simular
                        </button>
                    </div>
                </form>

                {simResults && (
                    <div className="mt-4 animate-fade-in" style={{ background: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #bae6fd' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#0f172a' }}>Resultado da Simulação</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '8px' }}>Insumo</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Necessário</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Em Estoque</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Falta Comprar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simResults.map((res, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px', fontWeight: 500 }}>{res.name}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{res.required} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{res.unit}</span></td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: res.available >= res.required ? 'var(--success)' : 'inherit' }}>{res.available} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{res.unit}</span></td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: res.missing > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                            {res.missing > 0 ? `${res.missing} ${res.unit}` : 'OK'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Posição Atual */}
            <div className="grid-2">
                <div className="card">
                    <h2>Posição Atual (Estoque Baixo)</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                        {products.filter(p => p.stock <= 5).length === 0 ? (
                            <p className="text-muted">Nenhum insumo com estoque crítico.</p>
                        ) : (
                            products.filter(p => p.stock <= 5).map(p => (
                                <div key={p.id} className="flex justify-between items-center" style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
                                    <div className="flex items-center gap-2 text-danger text-bold">
                                        <AlertCircle size={20} />
                                        <span>{p.name}</span>
                                    </div>
                                    <span className="badge badge-danger text-bold" style={{ fontSize: '1rem' }}>{p.stock} <span style={{ fontSize: '0.75rem' }}>{p.unit}</span></span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

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
                                            <p className="text-bold" style={{ margin: 0 }}>{m.quantity}</p>
                                            {m.value > 0 && <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>{formatCurrency(m.value)}</p>}
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

            {/* Form Modal Remanescente */}
            {isFormOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px' }}>
                        <div className="flex justify-between mb-4">
                            <h2>{editingId ? 'Editar Movimentação' : 'Nova Movimentação (Insumo)'}</h2>
                            <button onClick={resetForm} className="btn-icon-only text-muted" style={{ border: 'none', background: 'transparent' }}>X</button>
                        </div>
                        <form onSubmit={handleSubmit} className="grid-2 mt-4">
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Insumo / Componente</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.product_name}
                                    onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                    disabled={editingId !== null}
                                    placeholder="Ex: Granola, Leite Ninho"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Unidade de Medida</label>
                                <select
                                    className="select-field"
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    disabled={editingId !== null}
                                >
                                    <option value="unidade">Unidade (un)</option>
                                    <option value="g">Gramas (g)</option>
                                    <option value="kg">Quilogramas (kg)</option>
                                    <option value="ml">Mililitros (ml)</option>
                                    <option value="l">Litros (l)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Tipo</label>
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
                                <label>Valor Total da Compra (R$) - Opcional</label>
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
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
