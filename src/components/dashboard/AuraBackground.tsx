"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AuraBackgroundProps {
  variant?: "emerald" | "blue" | "purple" | "amber";
}

const VARIANTS = {
  emerald: ["rgba(16, 185, 129, 0.12)", "rgba(5, 150, 105, 0.08)"],
  blue: ["rgba(59, 130, 246, 0.12)", "rgba(29, 78, 216, 0.08)"],
  purple: ["rgba(168, 85, 247, 0.12)", "rgba(126, 34, 206, 0.08)"],
  amber: ["rgba(245, 158, 11, 0.12)", "rgba(180, 83, 9, 0.08)"],
};

export default function AuraBackground({ variant = "emerald" }: AuraBackgroundProps) {
  const [colors, setColors] = useState(VARIANTS[variant]);

  useEffect(() => {
    setColors(VARIANTS[variant]);
  }, [variant]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0a0a0c]">
      {/* Top Left Blob */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[120px] opacity-60"
        style={{ background: colors[0] }}
      />

      {/* Bottom Right Blob */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -70, 0],
          y: [0, -40, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -bottom-[10%] -right-[10%] w-[80%] h-[80%] rounded-full blur-[150px] opacity-40"
        style={{ background: colors[1] }}
      />
    </div>
  );
}
