"use client";
import React, { useEffect, useState } from 'react';
import { getDelegationManager, subscribeToStateUpdates, ActiveDelegation } from '../../delegation/DelegationManager';
import { Loader2 } from 'lucide-react';
import { getToolDisplayName } from './toolDisplayNames';

// ASCII spinner frames using Braille dots
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * ASCII Spinner Component
 * Cycles through Braille dot patterns for a retro CLI feel
 */
const AsciiSpinner: React.FC = () => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80); // 80ms = ~12.5 fps for smooth animation

    return () => clearInterval(interval);
  }, []);

  // Return just the character, no wrapper - inherits parent styles
  return <>{SPINNER_FRAMES[frame]}</>;
};

export const DelegationStatusComponent: React.FC = () => {
  const [activeDelegations, setActiveDelegations] = useState<ActiveDelegation[]>([]);

  // Inject CSS animations into the document
  useEffect(() => {
    // Check if styles already exist
    if (!document.getElementById('delegation-status-styles')) {
      const style = document.createElement('style');
      style.id = 'delegation-status-styles';
      style.textContent = `
        @keyframes delegation-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes delegation-slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Subscribe to delegation manager state updates
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates(() => {
      const manager = getDelegationManager();
      setActiveDelegations(manager.getActiveDelegations());
    });
    return () => unsubscribe();
  }, []);

  // Don't render anything if there are no active delegations
  if (activeDelegations.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      pointerEvents: 'none',
      zIndex: 99999
    }}>
      {activeDelegations.map((delegation, index) => (
        <div
          key={delegation.id}
          style={{
            position: 'fixed',
            top: `${20 + (index * 100)}px`,
            right: '20px',
            minWidth: '280px',
            maxWidth: '320px',
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.6)), rgba(16, 255, 255, 0.15)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
            pointerEvents: 'auto',
            animation: 'delegation-slideInFromRight 0.3s ease-out',
            zIndex: 99999
          }}
        >
          {/* Agent Name and Spinner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <Loader2 
              style={{
                width: '20px',
                height: '20px',
                color: 'rgba(255, 255, 255, 0.95)',
                animation: 'delegation-spin 1s linear infinite'
              }}
            />
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.95)',
              letterSpacing: '0.3px',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}>
              {delegation.agentName || 'Starting Delegate'}
            </div>
          </div>

          {/* Status History */}
          <div style={{
            paddingLeft: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {delegation.statusHistory.map((statusItem, idx) => {
              // If this is a tool status with toolName, humanize it
              const displayText = statusItem.toolName 
                ? getToolDisplayName(statusItem.toolName, statusItem.action)
                : statusItem.text;
              
              // Check if this is a "Thinking" message (with or without ellipsis)
              const isThinking = displayText === 'Thinking...' || displayText === 'Thinking';
              
              return (
                <div
                  key={`${delegation.id}-status-${idx}`}
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: '1.4',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                    fontFamily: '"Fira Code Custom", ui-monospace, Menlo, Consolas, monospace'
                  }}
                >
                  {displayText}
                  &nbsp;
                  {isThinking && <AsciiSpinner />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

