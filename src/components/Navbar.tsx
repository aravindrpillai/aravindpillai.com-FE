import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Menu, X } from "lucide-react";

/** Sticky brand bar on the home page. Turns into frosted glass once you scroll; a thin bar shows scroll progress. */
const LINKS = [
  { href: "#about", label: "About" },
  { href: "#playground", label: "Playground" },
  { href: "#contact", label: "Contact" },
];

const BRAND = ["Aravind", "Ramachandran", "Pillai"];

export const Brand = ({ className = "" }: { className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <a href="#top" className={`group inline-flex items-baseline font-display font-bold tracking-tight ${className}`} aria-label="Aravind Ramachandran Pillai, home">
      {BRAND.map((part, i) => (
        <motion.span
          key={part}
          initial={reduce ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 220, damping: 16 }}
          className={`inline-block transition-transform duration-300 group-hover:-translate-y-0.5 ${i === 1 ? "text-gradient" : ""}`}
          style={{ transitionDelay: `${i * 40}ms` }}
        >
          {part}
        </motion.span>
      ))}
      <motion.span
        aria-hidden
        className="ml-0.5 inline-block h-2 w-2 rounded-full bg-gradient-warm"
        animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
        transition={{ repeat: Infinity, duration: 2.2 }}
      />
    </a>
  );
};

const Navbar = () => {
  // Hidden while the hero fills the screen; slides in once the user has scrolled most of the way past it.
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.3 });

  useEffect(() => {
    const onScroll = () => {
      const show = window.scrollY > window.innerHeight * 0.75;
      setVisible(show);
      if (!show) setOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <motion.header
      initial={false}
      animate={visible ? { y: 0, opacity: 1 } : { y: "-110%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 22 }}
      className={`fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/75 shadow-soft backdrop-blur-xl ${
        visible ? "" : "pointer-events-none"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* remount on each reveal so the name plays its drop-in animation every time the bar appears */}
        <Brand key={visible ? "shown" : "hidden"} className="text-lg sm:text-xl" />

        <ul className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
                <span className="absolute inset-x-4 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-gradient-warm transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "x" : "menu"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-background/95 px-6 backdrop-blur-xl sm:hidden"
          >
            {LINKS.map((l, i) => (
              <motion.li key={l.href} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}>
                <a href={l.href} onClick={() => setOpen(false)} className="block py-3 font-medium text-foreground/90">
                  {l.label}
                </a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <motion.div aria-hidden className="absolute bottom-0 left-0 right-0 h-0.5 origin-left bg-gradient-warm" style={{ scaleX: progress }} />
    </motion.header>
  );
};

export default Navbar;
