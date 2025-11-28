"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session storage on initial load
    const sessionActive = sessionStorage.getItem('aqua-trace-auth') === 'true';
    setIsAuthenticated(sessionActive);
    setIsLoading(false);
  }, []);
  
  const login = (username: string, password: string): boolean => {
    if (username === "stormwater" && password === "hamiltonwater") {
      setIsAuthenticated(true);
      sessionStorage.setItem('aqua-trace-auth', 'true');
      return true;
    }
    return false;
  };
  
  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('aqua-trace-auth');
  };

  const value = {
    isAuthenticated,
    login,
    logout,
  };

  // While checking session storage, you might want to show a loader
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
