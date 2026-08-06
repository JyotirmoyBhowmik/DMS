import React, { useState } from 'react';
import { Modal } from '../Modal';
import { FormField } from '../FormField';
import { SKU_CATEGORIES, DISTRIBUTOR_NAMES } from '../../data/seed';
import { tokens } from '../../theme/tokens';

interface SkuCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (sku: { sku?: string; name: string; category: string; price: number; stock: number; minThreshold: number; distributor: string }) => Promise<any> | void;
}

export const SkuCreateModal: React.FC<SkuCreateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [skuCode, setSkuCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(SKU_CATEGORIES[0]);
  const [distributor, setDistributor] = useState(DISTRIBUTOR_NAMES[0]);
  const [price, setPrice] = useState('15.00');
  const [stock, setStock] = useState('500');
  const [minThreshold, setMinThreshold] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await onSubmit({
        sku: skuCode.trim() || undefined,
        name,
        category,
        distributor,
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0,
        minThreshold: parseInt(minThreshold, 10) || 0,
      });
      setSkuCode('');
      setName('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create SKU in catalog database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add New Product SKU" subtitle="Create master SKU record in distribution database" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {errorMessage && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
            ⚠️ {errorMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
          <FormField label="SKU Code (Optional)">
            <input
              type="text"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="Auto-generated if empty"
              style={tokens.presets.input}
            />
          </FormField>

          <FormField label="Product Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunflower Cooking Oil 1L"
              style={tokens.presets.input}
              required
            />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={tokens.presets.input}>
              {SKU_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Distributor Partner">
            <select value={distributor} onChange={(e) => setDistributor(e.target.value)} style={tokens.presets.input}>
              {DISTRIBUTOR_NAMES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <FormField label="Unit Price ($)">
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>
          <FormField label="Initial Stock">
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>
          <FormField label="Min Threshold">
            <input
              type="number"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} style={tokens.presets.buttonSecondary} disabled={submitting}>Cancel</button>
          <button type="submit" style={tokens.presets.buttonPrimary} disabled={submitting}>
            {submitting ? 'Writing to DB...' : 'Create SKU'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
