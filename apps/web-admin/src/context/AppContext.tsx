import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { RouteId } from '../types';

export interface AppState {
  isLiveApiMode: boolean;
  activeRoute: RouteId;
  lastRefreshed: string;
  notifications: string[];
}

export interface AppContextType extends AppState {
  toggleApiMode: () => void;
  navigate: (routeId: RouteId) => void;
  refresh: () => void;
  addNotification: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [isLiveApiMode, setIsLiveApiMode] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<RouteId>('dashboard');
  const [lastRefreshed, setLastRefreshed] = useState<string>(
    new Date().toLocaleTimeString()
  );
  const [notifications, setNotifications] = useState<string[]>([]);

  const toggleApiMode = () => {
    setIsLiveApiMode((prev) => !prev);
  };

  const navigate = (routeId: RouteId) => {
    setActiveRoute(routeId);
  };

  const refresh = () => {
    setLastRefreshed(new Date().toLocaleTimeString());
  };

  const addNotification = (msg: string) => {
    if (msg) {
      setNotifications((prev) => [msg, ...prev]);
    }
  };

  return (
    <AppContext.Provider
      value={{
        isLiveApiMode,
        activeRoute,
        lastRefreshed,
        notifications,
        toggleApiMode,
        navigate,
        refresh,
        addNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
