"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "dots" | "circles" | "notes";

interface FloatingElementsProps {
  variant?: Variant;
  className?: string;
}

interface FloatingItem {
  id: number;
  x: string;
  y: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color?: string;
  content?: string;
}

function generateCircles(): FloatingItem[] {
  const colors = [
    "bg-primary/15",
    "bg-amber-500/10",
    "bg-orange-400/20",
    "bg-primary/10",
    "bg-amber-400/15",
    "bg-orange-500/12",
  ];
  return [
    { id: 0, x: "10%", y: "15%", size: 60, duration: 5, delay: 0, opacity: 0.2, color: colors[0] },
    { id: 1, x: "75%", y: "10%", size: 40, duration: 6, delay: 0.5, opacity: 0.15, color: colors[1] },
    { id: 2, x: "85%", y: "60%", size: 80, duration: 7, delay: 1.0, opacity: 0.1, color: colors[2] },
    { id: 3, x: "20%", y: "70%", size: 50, duration: 4.5, delay: 1.5, opacity: 0.2, color: colors[3] },
    { id: 4, x: "50%", y: "30%", size: 30, duration: 5.5, delay: 0.8, opacity: 0.25, color: colors[4] },
    { id: 5, x: "60%", y: "80%", size: 45, duration: 6.5, delay: 2.0, opacity: 0.15, color: colors[5] },
  ];
}

function generateDots(): FloatingItem[] {
  return [
    { id: 0, x: "8%", y: "20%", size: 6, duration: 3.5, delay: 0, opacity: 0.3 },
    { id: 1, x: "25%", y: "50%", size: 4, duration: 4, delay: 0.4, opacity: 0.25 },
    { id: 2, x: "70%", y: "15%", size: 5, duration: 5, delay: 0.8, opacity: 0.3 },
    { id: 3, x: "90%", y: "45%", size: 3, duration: 3, delay: 1.2, opacity: 0.2 },
    { id: 4, x: "45%", y: "75%", size: 5, duration: 4.5, delay: 0.6, opacity: 0.25 },
    { id: 5, x: "15%", y: "85%", size: 4, duration: 5.5, delay: 1.6, opacity: 0.3 },
    { id: 6, x: "80%", y: "70%", size: 6, duration: 3.8, delay: 2.0, opacity: 0.2 },
    { id: 7, x: "55%", y: "10%", size: 3, duration: 4.2, delay: 1.0, opacity: 0.25 },
  ];
}

function generateNotes(): FloatingItem[] {
  const notes = ["🎵", "🎶", "🎸", "🎹", "🥁"];
  return [
    { id: 0, x: "12%", y: "18%", size: 24, duration: 5, delay: 0, opacity: 0.3, content: notes[0] },
    { id: 1, x: "78%", y: "12%", size: 20, duration: 6, delay: 0.6, opacity: 0.25, content: notes[1] },
    { id: 2, x: "88%", y: "55%", size: 28, duration: 7, delay: 1.2, opacity: 0.2, content: notes[2] },
    { id: 3, x: "22%", y: "72%", size: 22, duration: 4.5, delay: 1.8, opacity: 0.3, content: notes[3] },
    { id: 4, x: "55%", y: "35%", size: 18, duration: 5.5, delay: 0.9, opacity: 0.25, content: notes[4] },
    { id: 5, x: "40%", y: "85%", size: 26, duration: 6.5, delay: 2.2, opacity: 0.2, content: notes[0] },
  ];
}

const generators: Record<Variant, () => FloatingItem[]> = {
  circles: generateCircles,
  dots: generateDots,
  notes: generateNotes,
};

export default function FloatingElements({
  variant = "circles",
  className,
}: FloatingElementsProps) {
  const items = generators[variant]();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ y: 0 }}
          animate={{ y: [-8, 8, -8] }}
          transition={{
            duration: item.duration,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
            delay: item.delay,
          }}
          className="absolute"
          style={{
            left: item.x,
            top: item.y,
          }}
        >
          {variant === "circles" && (
            <div
              className={cn("rounded-full blur-xl", item.color)}
              style={{
                width: item.size,
                height: item.size,
                opacity: item.opacity,
              }}
            />
          )}
          {variant === "dots" && (
            <div
              className="rounded-full bg-primary"
              style={{
                width: item.size,
                height: item.size,
                opacity: item.opacity,
              }}
            />
          )}
          {variant === "notes" && (
            <span
              style={{
                fontSize: item.size,
                opacity: item.opacity,
              }}
            >
              {item.content}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}
