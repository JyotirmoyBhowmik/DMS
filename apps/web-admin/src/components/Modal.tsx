import React from 'react';
import { useApp } from '../context/AppContext';

export const Modal = () => {
  const { newInvoiceCustomer, setNewSkuDistributor, setNewBeatAgent, setNewBeatName, invoices, setActiveModal, handleAddUserSubmit, setNewUserRole, setNewSkuPrice, handleAddSkuSubmit, newSkuDistributor, setNewSkuName, newSkuStock, newUserRole, newUserEmail, activeModal, newSkuPrice, setNewSkuStock, setNewUserEmail, newSkuCategory, users, setNewInvoiceCustomer, setNewSkuCategory, handleAddInvoiceSubmit, newBeatName, setNewBeatRadius, setNewInvoiceAmount, newInvoiceAmount, newUserStatus, handleAddBeatSubmit, setNewUserStatus, newBeatRadius, newSkuName, newBeatAgent, beatRoutes, inventory } = useApp();
  return (
    <>
      {/* --- MODAL 1: ADD SKU FORM MODAL --- */}
              {activeModal === 'add-sku' && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ backgroundColor: '#FFFFFF', width: '480px', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Add New Inventory SKU</h3>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Auto-Generated Code: <strong>SKU-FMCG-00{inventory.length + 1}</strong></div>
                      </div>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
                    </div>

                    <form onSubmit={handleAddSkuSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Product Description</label>
                        <input type="text" placeholder="e.g. Premium Olive Oil 500ml" value={newSkuName} onChange={(e) => setNewSkuName(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Product Category</label>
                          <select value={newSkuCategory} onChange={(e) => setNewSkuCategory(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="Cooking Oil">Cooking Oil</option>
                            <option value="Grains">Grains</option>
                            <option value="Sweeteners">Sweeteners</option>
                            <option value="Beverages">Beverages</option>
                            <option value="Dairy">Dairy</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Assigned Distributor</label>
                          <select value={newSkuDistributor} onChange={(e) => setNewSkuDistributor(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="Metro Wholesalers Ltd">Metro Wholesalers Ltd</option>
                            <option value="Global Distribution Corp">Global Distribution Corp</option>
                            <option value="Apex Logistics Inc">Apex Logistics Inc</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Unit Price ($)</label>
                          <input type="number" step="0.5" value={newSkuPrice} onChange={(e) => setNewSkuPrice(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Initial Stock Qty</label>
                          <input type="number" value={newSkuStock} onChange={(e) => setNewSkuStock(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        </div>
                      </div>

                      <button type="submit" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                        + Save SKU to Master Catalog
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* --- MODAL 2: ADD USER FORM MODAL --- */}
              {activeModal === 'add-user' && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ backgroundColor: '#FFFFFF', width: '440px', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Add User Account</h3>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Auto User ID: <strong>usr-{users.length + 1}</strong></div>
                      </div>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
                    </div>

                    <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>User Email Address</label>
                        <input type="email" placeholder="agent-sales@enterprise.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>RBAC Role</label>
                          <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="admin">admin</option>
                            <option value="agent">agent</option>
                            <option value="distributor">distributor</option>
                            <option value="auditor">auditor</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Account Status</label>
                          <select value={newUserStatus} onChange={(e) => setNewUserStatus(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                        </div>
                      </div>

                      <button type="submit" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                        + Create User Account
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* --- MODAL 3: ADD BEAT ROUTE FORM MODAL --- */}
              {activeModal === 'add-beat' && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ backgroundColor: '#FFFFFF', width: '460px', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Create Beat Route</h3>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Auto Beat Code: <strong>BEAT-NORTH-0{beatRoutes.length + 1}</strong></div>
                      </div>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
                    </div>

                    <form onSubmit={handleAddBeatSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Route Name</label>
                        <input type="text" placeholder="e.g. Westside Express Grocery Beat" value={newBeatName} onChange={(e) => setNewBeatName(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Assigned Agent</label>
                          <select value={newBeatAgent} onChange={(e) => setNewBeatAgent(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="Agent Sarah Jenkins">Agent Sarah Jenkins</option>
                            <option value="Agent Mark Vance">Agent Mark Vance</option>
                            <option value="Agent Elena Rostova">Agent Elena Rostova</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Geofence Radius</label>
                          <select value={newBeatRadius} onChange={(e) => setNewBeatRadius(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="1.5 km">1.5 km</option>
                            <option value="2.5 km">2.5 km</option>
                            <option value="4.0 km">4.0 km</option>
                            <option value="5.0 km">5.0 km</option>
                          </select>
                        </div>
                      </div>

                      <button type="submit" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                        + Save Beat Route
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* --- MODAL 4: ADD INVOICE FORM MODAL --- */}
              {activeModal === 'add-invoice' && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ backgroundColor: '#FFFFFF', width: '460px', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Generate Sales Invoice</h3>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Auto Invoice #: <strong>INV-2026-00{invoices.length + 1}</strong></div>
                      </div>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
                    </div>

                    <form onSubmit={handleAddInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Distributor / Customer</label>
                        <select value={newInvoiceCustomer} onChange={(e) => setNewInvoiceCustomer(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                          <option value="Metro Wholesalers Ltd">Metro Wholesalers Ltd</option>
                          <option value="Global Distribution Corp">Global Distribution Corp</option>
                          <option value="Apex Logistics Inc">Apex Logistics Inc</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Invoice Amount ($)</label>
                        <input type="number" step="100" value={newInvoiceAmount} onChange={(e) => setNewInvoiceAmount(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px', fontWeight: '600' }}>Calculated Tax (8%): ${(parseFloat(newInvoiceAmount || '0') * 0.08).toLocaleString()}.00</div>
                      </div>

                      <button type="submit" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                        + Issue Invoice Ledger Entry
                      </button>
                    </form>
                  </div>
                </div>
              )}
    </>
  );
};
