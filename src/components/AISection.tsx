import { motion } from "framer-motion";
import { Sparkles, BrainCircuit } from "lucide-react";

const AISection = () => {
  return (
    <section className="py-20 md:py-32 px-6 bg-card/50">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-primary/20 text-primary text-xs tracking-[0.15em] uppercase font-body"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Sparkles size={14} />
            Beep boop, human attempting AI
          </motion.div>

          <h2 className="text-3xl md:text-5xl font-display font-light mb-6">
            So I Poked the{" "}
            <span className="text-gradient font-semibold">AI Bear</span> 🐻
          </h2>

          <div className="space-y-4 text-base md:text-lg text-muted-foreground font-body font-light max-w-2xl mx-auto mb-10">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Turns out, telling a machine to "be smart" is harder than it sounds.
              But hey, I gave it a shot anyway — because why let a lack of expertise
              stop anyone in 2025, right?
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-foreground/50 italic"
            >
              Fair warning: the robots haven't taken over yet… but I'm working on it. 🤖
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <a
              href="https://ai.aravindpillai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-warm text-primary-foreground rounded-full font-medium text-base shadow-glow hover:shadow-xl hover:scale-105 transition-all duration-300 tracking-wide"
            >
              <BrainCircuit size={20} />
              Explore My AI Playground
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default AISection;
