'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { ActiveDelegation } from '@/app/lib/tools/delegation/DelegationManager';

interface DelegationStatusLineProps {
  activeDelegations: ActiveDelegation[];
}

/**
 * Thin status line shown above the chat stream when an agent is delegating
 * to another agent (e.g. consulting a specialist). Replaces the old
 * corner-toast DelegationStatusComponent for the split-panel layout.
 */
export function DelegationStatusLine({ activeDelegations }: DelegationStatusLineProps) {
  if (activeDelegations.length === 0) return null;

  const latest = activeDelegations[activeDelegations.length - 1];
  const lastStatus = latest.statusHistory[latest.statusHistory.length - 1];
  const statusText = lastStatus?.text || 'Thinking';
  const name = latest.agentName || latest.agentType || 'Delegated Agent';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-center justify-center gap-2 py-2 px-4 text-sm text-foreground"
    >
      <Loader2 className="h-3 w-3 animate-spin text-brand" />
      <span className="font-medium">
          <span className="capitalize">{name.replaceAll('-', ' ')}</span>
          {` is ${statusText.toLowerCase().replaceAll(".", "")}...`}
      </span>
      {activeDelegations.length > 1 && (
        <span>
          +{activeDelegations.length - 1} more
        </span>
      )}
    </motion.div>
  );
}
