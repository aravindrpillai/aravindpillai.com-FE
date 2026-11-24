import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowUp, ArrowUpRight, Heart, Mail, Phone } from "lucide-react";
import SocialLinks from "./SocialLinks";
import { Brand } from "./Navbar";
import { PROJECTS } from "./ProjectsGrid";

const col: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.12, duration: 0.6 } }),
};

const Footer = () => {
  const year = new Date().getFullYear();
  const reduce = useReducedMotion();

  return (
    <footer className="relative overflow-hidden border-t border-border bg-card/60 px-6 pt-16 pb-8">
      {/* drifting gradient line on top */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(24 80% 55%), hsl(350 70% 60%), transparent)", backgroundSize: "200% 100%" }}
        animate={reduce ? undefined : { backgroundPosition: ["0% 0%", "200% 0%"] }}
        transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
      />
      {/* soft glows */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-warm opacity-10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-0 h-60 w-60 rounded-full bg-gradient-warm opacity-[0.07] blur-3xl" />

      <motion.div
        className="relative mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr_1fr]"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div custom={0} variants={col}>
          <Brand className="text-2xl" />
          <p className="mt-4 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
            Fullstack developer, science enthusiast and a photographer of questionable skill. Building things on weekends
            and occasionally poking AI with a stick.
          </p>
          <SocialLinks size="sm" className="mt-6 justify-start" />
        </motion.div>

        <motion.div custom={1} variants={col}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Playground</h3>
          <ul className="space-y-2.5">
            {PROJECTS.map((p) => (
              <li key={p.title}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <span className="relative">
                    {p.title}
                    <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                  </span>
                  <ArrowUpRight size={13} className="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div custom={2} variants={col}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Say hello</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <a href="mailto:hello@aravindpillai.com" className="inline-flex items-center gap-2 transition-colors hover:text-primary">
                <Mail size={15} /> hello@aravindpillai.com
              </a>
            </li>
            <li>
              <a href="tel:+14168547092" className="inline-flex items-center gap-2 transition-colors hover:text-primary">
                <Phone size={15} /> +1 (416) 854-7092
              </a>
            </li>
            <li>
              <a href="/anonymous" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition-colors hover:text-primary">
                <ArrowUpRight size={15} /> Send an anonymous message
              </a>
            </li>
          </ul>
        </motion.div>
      </motion.div>

      <div className="relative mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          © {year} Aravind Ramachandran Pillai. Made with
          <motion.span
            className="inline-flex"
            animate={reduce ? undefined : { scale: [1, 1.3, 1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.6, repeatDelay: 0.6 }}
          >
            <Heart size={14} className="fill-primary text-primary" />
          </motion.span>
          and too much coffee.
        </p>
        <motion.a
          href="#top"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.92 }}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-soft transition-colors hover:border-primary hover:text-primary"
        >
          Back to top
          <ArrowUp size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
        </motion.a>
      </div>
    </footer>
  );
};

export default Footer;
