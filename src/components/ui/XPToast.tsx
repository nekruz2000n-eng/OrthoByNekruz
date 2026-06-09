'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPToastProps {
  xp: number;
  visible: boolean;
  onDone?: () => void;
}

export function XPToast({ xp, visible, onDone }: XPToastProps) {
  useEffect(() => {
    if (!visible || xp <= 0) return;
    const t = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(t);
  }, [visible, xp, onDone]);

  return (
    <AnimatePresence>
      {visible && xp > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] px-5 py-2.5 rounded-full font-bold text-sm shadow-lg"
          style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
        >
          +{xp} XP ⚡
        </motion.div>
      )}
    </AnimatePresence>
  );
}
