"use client";

import React, { createContext, useContext, useState, useRef, useCallback, FC, PropsWithChildren } from "react";
import { generateUUID } from '@/app/lib/uuid';
import { TranscriptItem } from "@/app/lib/types";

type ActiveAgent = { key: string; name: string } | null;

type TranscriptContextValue = {
  transcriptItems: TranscriptItem[];
  addTranscriptMessage: (itemId: string, role: "user" | "assistant", text: string, hidden?: boolean) => void;
  updateTranscriptMessage: (itemId: string, text: string, isDelta: boolean) => void;
  addTranscriptBreadcrumb: (title: string, data?: Record<string, any>) => void;
  addTranscriptBreadcrumbWithId: (itemId: string, title: string, data?: Record<string, any>, status?: "IN_PROGRESS" | "DONE") => void;
  addTranscriptHandoff: (fromName: string | undefined, toName: string | undefined, rationale?: string) => void;
  addTranscriptToolError: (toolName: string, message: string, data?: Record<string, any>) => void;
  updateTranscriptBreadcrumb: (itemId: string, title?: string, data?: Record<string, any>) => void;
  toggleTranscriptItemExpand: (itemId: string) => void;
  updateTranscriptItemStatus: (itemId: string, newStatus: "IN_PROGRESS" | "DONE") => void;
  clearTranscript: () => void;
  setActiveAgent: (key: string, name: string) => void;
  activeAgent: ActiveAgent;
};

const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined);

export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [activeAgent, setActiveAgentState] = useState<ActiveAgent>(null);
  const activeAgentRef = useRef<ActiveAgent>(null);

  function newTimestampPretty(): string {
    return new Date().toLocaleTimeString([], {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function stampAgent<T extends Partial<TranscriptItem>>(item: T): T {
    const a = activeAgentRef.current;
    if (!a) return item;
    return { ...item, agentKey: a.key, agentName: a.name };
  }

  const setActiveAgent = useCallback((key: string, name: string) => {
    activeAgentRef.current = { key, name };
    setActiveAgentState({ key, name });
  }, []);

  const addTranscriptMessage: TranscriptContextValue["addTranscriptMessage"] = (itemId, role, text = "", isHidden = false) => {
    setTranscriptItems((prev) => {
      if (prev.some((log) => log.itemId === itemId && log.type === "MESSAGE")) {
        return prev;
      }

      const newItem: TranscriptItem = stampAgent({
        itemId,
        type: "MESSAGE",
        role,
        title: text,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "IN_PROGRESS",
        isHidden,
      }) as TranscriptItem;

      return [...prev, newItem];
    });
  };

  const updateTranscriptMessage: TranscriptContextValue["updateTranscriptMessage"] = (itemId, newText, append = false) => {
    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId && item.type === "MESSAGE") {
          return {
            ...item,
            title: append ? (item.title ?? "") + newText : newText,
          };
        }
        return item;
      })
    );
  };

  const addTranscriptBreadcrumb: TranscriptContextValue["addTranscriptBreadcrumb"] = (title, data) => {
    setTranscriptItems((prev) => [
      ...prev,
      stampAgent({
        itemId: `breadcrumb-${generateUUID()}`,
        type: "BREADCRUMB",
        title,
        data,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
      }) as TranscriptItem,
    ]);
  };

  const addTranscriptBreadcrumbWithId: TranscriptContextValue["addTranscriptBreadcrumbWithId"] = (itemId, title, data, status = "DONE") => {
    setTranscriptItems((prev) => {
      // Don't add if already exists
      if (prev.some((item) => item.itemId === itemId && item.type === "BREADCRUMB")) {
        return prev;
      }

      return [
        ...prev,
        stampAgent({
          itemId,
          type: "BREADCRUMB",
          title,
          data,
          expanded: false,
          timestamp: newTimestampPretty(),
          createdAtMs: Date.now(),
          status,
          isHidden: false,
        }) as TranscriptItem,
      ];
    });
  };

  const addTranscriptHandoff: TranscriptContextValue["addTranscriptHandoff"] = (fromName, toName, rationale) => {
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `handoff-${generateUUID()}`,
        type: "BREADCRUMB",
        title: `Handed off to ${toName ?? "?"}`,
        data: { from: fromName, to: toName, rationale },
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
        breadcrumbKind: "handoff",
        agentKey: activeAgentRef.current?.key,
        agentName: fromName,
      },
    ]);
  };

  const addTranscriptToolError: TranscriptContextValue["addTranscriptToolError"] = (
    toolName,
    message,
    data
  ) => {
    // Always surfaces in the chat stream (not gated by debug mode) so the
    // user can see when a tool call has failed without having to open the
    // full event log.
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `tool-error-${generateUUID()}`,
        type: "BREADCRUMB",
        title: `${toolName} failed: ${message}`,
        data: { toolName, message, ...(data ?? {}) },
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
        breadcrumbKind: "tool-error",
        agentKey: activeAgentRef.current?.key,
        agentName: activeAgentRef.current?.name,
      },
    ]);
  };

  const updateTranscriptBreadcrumb: TranscriptContextValue["updateTranscriptBreadcrumb"] = (itemId, title, data) => {
    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId && item.type === "BREADCRUMB") {
          return {
            ...item,
            ...(title !== undefined && { title }),
            ...(data !== undefined && { data: { ...item.data, ...data } }),
          };
        }
        return item;
      })
    );
  };

  const toggleTranscriptItemExpand: TranscriptContextValue["toggleTranscriptItemExpand"] = (itemId) => {
    setTranscriptItems((prev) =>
      prev.map((log) =>
        log.itemId === itemId ? { ...log, expanded: !log.expanded } : log
      )
    );
  };

  const updateTranscriptItemStatus: TranscriptContextValue["updateTranscriptItemStatus"] = (itemId, newStatus) => {
    setTranscriptItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, status: newStatus } : item
      )
    );
  };

  const clearTranscript = () => {
    setTranscriptItems([]);
  };

  return (
    <TranscriptContext.Provider
      value={{
        transcriptItems,
        addTranscriptMessage,
        updateTranscriptMessage,
        addTranscriptBreadcrumb,
        addTranscriptBreadcrumbWithId,
        addTranscriptHandoff,
        addTranscriptToolError,
        updateTranscriptBreadcrumb,
        toggleTranscriptItemExpand,
        updateTranscriptItemStatus,
        clearTranscript,
        setActiveAgent,
        activeAgent,
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
};

export function useTranscript() {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error("useTranscript must be used within a TranscriptProvider");
  }
  return context;
}
