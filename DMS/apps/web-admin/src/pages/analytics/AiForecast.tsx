import React, { useState } from 'react';
import { UserRole } from '../../types';

export const AiForecast: React.FC<{ role: UserRole }> = ({ role }) => {
  const [prompt, setPrompt] = useState('Forecast demand for SKU-FMCG-001 in Zone A for Q3...');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (role !== 'admin') {
    return (
      <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
        <p>Access Denied. Admins only.</p>
      </div>
    );
  }

  const handleRun = () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        volume: '1850 Units',
        growth: '+14.2%',
        confidence: '95.4%',
        buffer: '200 Units',
        insight: 'Strong seasonal uptick expected due to upcoming regional festivals. Ensure Zone A distributors increase safety stock by week 2.'
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 24px 0', color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>AI Demand Forecast</h1>
      
      <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Forecasting Prompt</label>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '4px', minHeight: '100px', marginBottom: '16px', fontFamily: 'inherit' }}
        />
        <button 
          onClick={handleRun}
          disabled={loading}
          style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Analyzing...' : 'Run AI Demand Forecast'}
        </button>
      </div>

      {result && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#0F172A' }}>Forecast Output</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Predicted Volume</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A' }}>{result.volume}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Expected Growth</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803D' }}>{result.growth}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Confidence Score</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563EB' }}>{result.confidence}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Recommended Buffer</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#B45309' }}>{result.buffer}</div>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>Strategic Insight</h3>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{result.insight}</p>
          </div>
        </div>
      )}
    </div>
  );
};
