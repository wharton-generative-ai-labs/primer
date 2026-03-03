"use client";

import React, { createContext, useContext, useState, FC, PropsWithChildren, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { LoggedEvent } from "@/app/lib/types";

type EventContextValue = {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logServerEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  toggleExpand: (id: number | string) => void;
  showAudioTranscriptDeltas: boolean;
  toggleShowAudioTranscriptDeltas: () => void;
  showClientEvents: boolean;
  showServerEvents: boolean;
  toggleShowClientEvents: () => void;
  toggleShowServerEvents: () => void;
  clearLoggedEvents: () => void;
};

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);
  const [showAudioTranscriptDeltas, setShowAudioTranscriptDeltas] = useState<boolean>(false);
  const [showClientEvents, setShowClientEvents] = useState<boolean>(true);
  const [showServerEvents, setShowServerEvents] = useState<boolean>(true);

  function addLoggedEvent(direction: "client" | "server", eventName: string, eventData: Record<string, any>) {
    const id = eventData.event_id || uuidv4();
    setLoggedEvents((prev) => [
      ...prev,
      {
        id,
        direction,
        eventName,
        eventData,
        timestamp: new Date().toLocaleTimeString(),
        expanded: false,
      },
    ]);
  }

  const logClientEvent: EventContextValue["logClientEvent"] = (eventObj, eventNameSuffix = "") => {
    if (!showClientEvents) return;
    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    addLoggedEvent("client", name, eventObj);
  };

  const logServerEvent: EventContextValue["logServerEvent"] = (eventObj, eventNameSuffix = "") => {
    if (!showServerEvents) return;
    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    if (!showAudioTranscriptDeltas && eventObj.type?.toString().includes(".delta"))
    {
      return;
    }
    addLoggedEvent("server", name, eventObj);
  };

  const toggleExpand: EventContextValue["toggleExpand"] = (id) => {
    setLoggedEvents((prev) =>
      prev.map((log) => {
        if (log.id === id) {
          return { ...log, expanded: !log.expanded };
        }
        return log;
      })
    );
  };

  const toggleShowAudioTranscriptDeltas = () => {
    setShowAudioTranscriptDeltas(prev => !prev);
    localStorage.setItem("showAudioTranscriptDeltas", (!showAudioTranscriptDeltas).toString());
  };

  const toggleShowClientEvents = () => {
    setShowClientEvents(prev => !prev);
    localStorage.setItem("showClientEvents", (!showClientEvents).toString());
  };

  const toggleShowServerEvents = () => {
    setShowServerEvents(prev => !prev);
    localStorage.setItem("showServerEvents", (!showServerEvents).toString());
  };

  const clearLoggedEvents = () => {
    setLoggedEvents([]);
  };

  useEffect(() => {
    const storedAudioDeltas = localStorage.getItem("showAudioTranscriptDeltas");
    const storedClientEvents = localStorage.getItem("showClientEvents");
    const storedServerEvents = localStorage.getItem("showServerEvents");

    if (storedAudioDeltas !== null) {
      setShowAudioTranscriptDeltas(storedAudioDeltas === "true");
    }
    if (storedClientEvents !== null) {
      setShowClientEvents(storedClientEvents === "true");
    }
    if (storedServerEvents !== null) {
      setShowServerEvents(storedServerEvents === "true");
    }
  }, []);

  return (
    <EventContext.Provider
      value={{ 
        loggedEvents, 
        logClientEvent, 
        logServerEvent, 
        toggleExpand,
        showAudioTranscriptDeltas,
        toggleShowAudioTranscriptDeltas,
        showClientEvents,
        showServerEvents,
        toggleShowClientEvents,
        toggleShowServerEvents,
        clearLoggedEvents
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}