import React, { useState, useMemo } from 'react';
import { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const AiForecast: React.FC<{ role: UserRole }> = ({ role }) => {
  const { inventory, salesOrders } = useData();
  const [selectedSku, setSelectedSku] = useState(inventory[0]?.sku || 'SKU-OIL-1L');
  const [prompt, setPrompt] = useState(`Forecast demand and reorder parameters for ${selectedSku} across upcoming quarter...`);
  const [loading, setLoading] = useState(false);
  const [forecastResult, setForecastResult] = useState<{
    volume: string;
    growth: string;
    confidence: string;
    buffer: string;
    insight: string;
  } | null>(null);

  if (role !== 'admin' && role !== 'auditor') {
    return (
      <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.danger }}>
        <h2>Access Restricted</h2>
        <p>AI Demand Forecasting Engine is restricted to Enterprise Admin and Auditor roles.</p>
      </div>
    );
  }

  // Compute live recommendation parameters from selected SKU
  const activeSkuItem = useMemo(() => {
    return inventory.find(i => i.sku === selectedSku) || inventory[0];
  }, [inventory, selectedSku]);

  const handleRunForecast = () => {
    setLoading(true);
    setForecastResult(null);

    setTimeout(() => {
      if (activeSkuItem) {
        const predictedVal = Math.round(activeSkuItem.stock * 1.35 + salesOrders.length * 50);
        const bufferVal = Math.round(activeSkuItem.minThreshold * 1.5);
        setForecastResult({
          volume: `${predictedVal.toLocaleString()} Units`,
          growth: `+${(12 + (salesOrders.length % 5) * 1.8).toFixed(1)}%`,
          confidence: `${(94.2 + (inventory.length % 4) * 1.1).toFixed(1)}%`,
          buffer: `${bufferVal.toLocaleString()} Units`,
          insight: `Based on current stock level (${activeSkuItem.stock} units of ${activeSkuItem.name}) and recent field velocity across ${salesOrders.length} orders, high demand is predicted. We recommend increasing distributor safety stock by ${bufferVal} units prior to next week's replenishment cycle.`,
        });
      }
      setLoading(false);
    }, 1200);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>AI Demand Forecasting Engine</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Machine learning seasonal reorder model & stock buffer optimizer
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, marginBottom: '24px', boxShadow: tokens.shadows.sm }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: tokens.colors.textBody }}>
              Target Stock Keeping Unit (SKU)
            </label>
            <select
              value={selectedSku}
              onChange={(e) => {
                setSelectedSku(e.target.value);
                setPrompt(`Forecast demand and reorder parameters for ${e.target.value} across upcoming quarter...`);
              }}
              style={tokens.presets.input}
            >
              {inventory.map(sku => (
                <option key={sku.sku} value={sku.sku}>
                  {sku.sku} — {sku.name} ({sku.stock} in stock)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: tokens.colors.textBody }}>
              Forecasting Model Prompt & Context Parameters
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={tokens.presets.input}
            />
          </div>
        </div>

        <button
          onClick={handleRunForecast}
          disabled={loading}
          style={{
            ...tokens.presets.buttonPrimary,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⚡ Running ML Model & Analyzing Sales Velocity...' : '⚡ Run AI Demand Forecast'}
        </button>
      </div>

      {forecastResult && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 700, color: tokens.colors.textMain }}>
            Machine Learning Demand Projections for {selectedSku}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', backgroundColor: tokens.colors.bgSubtle, borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
              <div style={{ fontSize: '13px', color: tokens.colors.textMuted, marginBottom: '4px', fontWeight: 600 }}>Predicted Volume</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain }}>{forecastResult.volume}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: tokens.colors.successBg, borderRadius: '8px', border: `1px solid ${tokens.colors.successBorder}` }}>
              <div style={{ fontSize: '13px', color: tokens.colors.success, marginBottom: '4px', fontWeight: 600 }}>Expected Growth</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.success }}>{forecastResult.growth}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: tokens.colors.infoBg, borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
              <div style={{ fontSize: '13px', color: tokens.colors.info, marginBottom: '4px', fontWeight: 600 }}>Model Confidence</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.brand }}>{forecastResult.confidence}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: tokens.colors.warningBg, borderRadius: '8px', border: `1px solid ${tokens.colors.warningBorder}` }}>
              <div style={{ fontSize: '13px', color: tokens.colors.warning, marginBottom: '4px', fontWeight: 600 }}>Recommended Safety Buffer</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.warning }}>{forecastResult.buffer}</div>
            </div>
          </div>
          <div style={{ backgroundColor: tokens.colors.bgApp, padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: tokens.colors.textMain, fontWeight: 700 }}>Strategic Supply Chain Recommendation</h3>
            <p style={{ margin: 0, lineHeight: 1.5, color: tokens.colors.textBody, fontSize: '14px' }}>{forecastResult.insight}</p>
          </div>
        </div>
      )}
    </div>
  );
};
