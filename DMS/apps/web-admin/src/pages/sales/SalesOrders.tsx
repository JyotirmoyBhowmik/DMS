import React, { useState, useEffect } from 'react';
import { UserRole, SalesOrder, Outlet } from '../../types';
import { dbService } from '../../services/dbService';
import { StatusBadge } from '../../components/StatusBadge';

export const SalesOrders: React.FC<{ role: UserRole }> = ({ role }) => {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const myAgentName = "Agent Sarah Jenkins";
  const myDistributorId = "Dist-001";

  useEffect(() => {
    dbService.getSalesOrders().then(setOrders);
    dbService.getOutlets().then(setOutlets);
  }, []);

  let visibleOrders = orders;
  if (role === 'agent') {
    visibleOrders = orders.filter((o: SalesOrder) => o.agent === myAgentName);
  } else if (role === 'distributor') {
    visibleOrders = orders;
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Sales Orders</h1>
        {role === 'agent' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Create New Order
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Order ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Retail Outlet</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Field Agent</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Amount</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Items</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Date</th>
              {role === 'admin' && <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o: SalesOrder) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px' }}>{o.id}</td>
                <td style={{ padding: '12px 16px' }}>{o.outlet}</td>
                <td style={{ padding: '12px 16px' }}>{o.agent}</td>
                <td style={{ padding: '12px 16px' }}>{o.totalAmount.startsWith('$') ? o.totalAmount : `$${o.totalAmount}`}</td>
                <td style={{ padding: '12px 16px' }}>{o.items}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={o.status} /></td>
                <td style={{ padding: '12px 16px' }}>{o.date}</td>
                {role === 'admin' && (
                  <td style={{ padding: '12px 16px' }}>
                    {o.status === 'PENDING_APPROVAL' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ padding: '4px 8px', backgroundColor: '#15803D', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                        <button style={{ padding: '4px 8px', backgroundColor: '#B91C1C', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>Create New Order</h2>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {outlets?.map((out: Outlet) => <option key={out.id} value={out.name}>{out.name}</option>)}
              </select>
              <input type="number" placeholder="Items Count" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <input type="number" placeholder="Amount" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
