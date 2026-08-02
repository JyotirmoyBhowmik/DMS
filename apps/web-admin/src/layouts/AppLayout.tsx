import React, { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#1E293B', display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header />
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </div>
      </main>
      <Modal />
    </div>
  );
};
