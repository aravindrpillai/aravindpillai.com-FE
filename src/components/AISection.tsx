import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import ProjectsGrid from "./ProjectsGrid";

const heading: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: -80, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 140, damping: 14 },
  },
};

// Same colours as --gradient-warm, repeated so it can slide across the text.
const SHIMMER = "linear-gradient(90deg, hsl(24 80% 55%), hsl(350 70% 60%), hsl(24 80% 55%), hsl(350 70% 60%))";

const AISection = () => {
  const reduce = useReducedMotion();

  return (
    <section id="playground" className="scroll-mt-16 py-20 md:py-32 px-6 bg-card/50">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
          className="mb-6"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
            animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <motion.span
              animate={reduce ? undefined : { rotate: [0, 20, -10, 0], scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 2.4, repeatDelay: 0.8 }}
              className="inline-flex"
            >
              <Sparkles size={16} />
            </motion.span>
            Beep boop, human attempting AI
          </motion.div>
        </motion.div>

        <motion.h2
          className="text-3xl md:text-5xl font-display font-bold mb-6 [perspective:800px]"
          variants={heading}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          aria-label="So I Poked the AI Bear"
        >
          {["So", "I", "Poked", "the"].map((w) => (
            <motion.span key={w} variants={word} className="inline-block mr-[0.25em] origin-bottom" aria-hidden>
              {w}
            </motion.span>
          ))}
          <motion.span variants={word} className="inline-block mr-[0.25em] origin-bottom" aria-hidden>
            <motion.span
              className="inline-block bg-clip-text text-transparent"
              style={{ backgroundImage: SHIMMER, backgroundSize: "300% 100%" }}
              animate={reduce ? undefined : { backgroundPosition: ["0% 50%", "100% 50%"] }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 4, ease: "easeInOut" }}
            >
              AI Bear
            </motion.span>
          </motion.span>
          <motion.span
            variants={{
              hidden: { opacity: 0, scale: 0, rotate: -90 },
              show: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 12 } },
            }}
            className="inline-block origin-bottom"
            aria-hidden
          >
            <motion.span
              className="inline-block origin-bottom cursor-default"
              animate={reduce ? undefined : { rotate: [0, -12, 10, -6, 0], y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, repeatDelay: 2.5, ease: "easeInOut" }}
              whileHover={{ scale: 1.4, rotate: 15 }}
            >
              🐻
            </motion.span>
          </motion.span>
        </motion.h2>

        <motion.div
          className="mx-auto mb-6 h-1 w-24 rounded-full bg-gradient-warm origin-center"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.7, ease: "easeOut" }}
        />

        <div className="space-y-4 text-lg text-muted-foreground font-body max-w-2xl mx-auto mb-14">
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 0.7 }}
          >
            Teaching a machine to be smart isn’t that hard, convincing humans they’re not is the real challenge
          </motion.p>
        </div>

        <ProjectsGrid />
      </div>
    </section>
  );
};

export default AISection;
