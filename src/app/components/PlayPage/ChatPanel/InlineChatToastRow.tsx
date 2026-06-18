'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type InlineChatToast,
  subscribeToInlineChatToasts,
} from '@/app/lib/inlineChatToasts';

export function InlineChatToastRow() {
  const [toasts, setToasts] = useState<InlineChatToast[]>([]);

  useEffect(() => subscribeToInlineChatToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="inline-flex self-center items-center rounded-full bg-background border border-border px-4 py-1.5 text-sm font-medium text-foreground shadow-sm"
          >
            {t.title}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
