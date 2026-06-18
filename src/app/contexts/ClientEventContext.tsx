"use client";

import React, { createContext, useContext } from 'react';

type ClientEventContextValue = {
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
};

// Create a default implementation that does nothing
const warningSendClientEvent = (_eventObj: any, _eventNameSuffix?: string) => {
  // Silently fail - this is expected when ClientEventProvider is not properly initialized
};

// Default context with warning implementation
const defaultContext: ClientEventContextValue = {
  sendClientEvent: warningSendClientEvent
};

const ClientEventContext = createContext<ClientEventContextValue>(defaultContext);

export function ClientEventProvider({ children, sendClientEvent }: { 
  children: React.ReactNode, 
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void 
}) {
  return (
    <ClientEventContext.Provider value={{ sendClientEvent }}>
      {children}
    </ClientEventContext.Provider>
  );
}

export function useClientEvent() {
  return useContext(ClientEventContext);
} 