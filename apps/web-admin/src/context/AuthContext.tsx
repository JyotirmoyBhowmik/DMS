import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { AppUser, UserRole } from '../types';

export interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  currentUser: AppUser | null;
  currentRole: UserRole;
  tenantId: string;
  authToken: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password?: string, role?: UserRole) => void;
  enterDemoMode: () => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ROLE: UserRole = 'admin';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(DEFAULT_ROLE);
  const [tenantId, setTenantId] = useState<string>(DEFAULT_TENANT_ID);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const login = (email: string, _password?: string, role?: UserRole) => {
    const assignedRole = role || DEFAULT_ROLE;
    const mockUser: AppUser = {
      id: `usr-${Date.now().toString(36)}`,
      email: email || 'admin@enterprise.com',
      status: 'ACTIVE',
      roles: assignedRole,
      lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    const token = `mock-jwt-${Date.now()}`;
    setCurrentUser(mockUser);
    setCurrentRole(assignedRole);
    setAuthToken(token);
    setIsAuthenticated(true);
    setIsDemoMode(false);
  };

  const enterDemoMode = () => {
    const mockDemoUser: AppUser = {
      id: 'usr-demo-admin',
      email: 'admin@enterprise.com',
      status: 'ACTIVE',
      roles: 'admin',
      lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setIsDemoMode(true);
    setIsAuthenticated(true);
    setCurrentRole('admin');
    setCurrentUser(mockDemoUser);
    setAuthToken('demo-bearer-token');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentUser(null);
    setCurrentRole(DEFAULT_ROLE);
    setTenantId(DEFAULT_TENANT_ID);
    setAuthToken(null);
  };

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        roles: role,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isDemoMode,
        currentUser,
        currentRole,
        tenantId,
        authToken,
        login,
        enterDemoMode,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
