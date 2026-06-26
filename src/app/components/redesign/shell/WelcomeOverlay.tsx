'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WelcomeOverlayProps {
  title?: string;
  tagline?: string;
  visible: boolean;
  className?: string;
}

export function WelcomeOverlay({
  title = 'Welcome\nto Primer',
  tagline = 'Build the simulation your students need.',
  visible,
  className,
}: WelcomeOverlayProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className={cn('fixed inset-0 z-modal flex items-center justify-center', className)}
    >
      <div className="relative mx-4 flex max-w-2xl flex-col items-center justify-center rounded-2xl bg-slate-800 px-12 py-16 shadow-2xl md:px-20 md:py-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(100,116,139,0.3), transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(71,85,105,0.25), transparent 50%),
            linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)
          `,
        }}
      >
        {/* Chalk texture overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.03]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-center font-serif text-5xl leading-tight text-white md:text-6xl"
          style={{ whiteSpace: 'pre-line' }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-6 text-center font-serif text-lg italic text-white/70 md:text-xl"
        >
          {tagline}
        </motion.p>
      </div>
    </motion.div>
  );
}
