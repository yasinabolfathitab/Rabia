import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FullScreenLoaderProps {
  duration?: number;
  onFinished?: () => void;
}

export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  duration = 3000,
  onFinished,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Prevent document scrolling while initial loader is displaying
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      setIsVisible(false);
      document.body.style.overflow = originalOverflow;
      if (onFinished) {
        onFinished();
      }
    }, duration);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, [duration, onFinished]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="rabia-fullscreen-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: '#e8dac6' }}
        >
          {/* Subtle warm radial spotlight */}
          <div className="absolute inset-0 bg-radial from-white/35 via-transparent to-[#d2be9d]/20 pointer-events-none" />

          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center justify-center px-4"
          >
            {/* Centered Rabia Logo with soft glowing ring */}
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.35, 0.6, 0.35],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute -inset-3 rounded-3xl bg-[#C87D55]/25 blur-md"
              />

              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden shadow-2xl border-2 border-[#C87D55]/40 bg-[#f7ede1] p-2 flex items-center justify-center">
                <img
                  src="/Rabia_Logo.jpg"
                  alt="لوگوی کافه رابیا"
                  className="w-full h-full object-contain rounded-2xl drop-shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Brand Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.55 }}
              className="mt-6 text-center"
            >
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2B1F1A]">
                کافه رابیا
              </h1>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="h-[1px] w-6 bg-[#C87D55]/50"></span>
                <span className="text-xs sm:text-sm font-semibold tracking-widest text-[#8C5E45] font-mono">
                  RABIA CAFÉ
                </span>
                <span className="h-[1px] w-6 bg-[#C87D55]/50"></span>
              </div>
            </motion.div>

            {/* Elegant 3s Progress Line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="mt-8 w-44 sm:w-52 h-1 bg-[#2B1F1A]/12 rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.85, ease: 'easeInOut' }}
                className="h-full bg-gradient-to-r from-[#A85E39] via-[#C87D55] to-[#E0946B] rounded-full"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
