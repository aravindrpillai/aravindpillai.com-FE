import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";

const themes = [
  { id: "warm", label: "Warm Amber", color: "#e07830" },
  { id: "dark", label: "Dark & Moody", color: "#c084fc" },
  { id: "cool", label: "Cool Minimal", color: "#38bdf8" },
  { id: "earth", label: "Nature Earth", color: "#4ade80" },
  { id: "noir", label: "Mono Noir", color: "#a1a1aa" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

const ThemeSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(() => {
    return (localStorage.getItem("site-theme") as ThemeId) || "warm";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", current);
    localStorage.setItem("site-theme", current);
  }, [current]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-14 right-0 bg-card border border-border rounded-2xl p-3 shadow-lg min-w-[180px]"
          >
            <p className="text-xs text-muted-foreground font-medium mb-2 px-1">Choose Theme</p>
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => { setCurrent(theme.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  current === theme.id
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-border shrink-0"
                  style={{ background: theme.color }}
                />
                {theme.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
        aria-label="Switch theme"
      >
        <Palette size={20} />
      </motion.button>
    </div>
  );
};

export default ThemeSwitcher;
