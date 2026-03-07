import { motion } from "framer-motion";
import { Bot, Sparkles, BrainCircuit } from "lucide-react";

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
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Sparkles size={16} />
            Beep boop, human attempting AI
          </motion.div>

          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
            So I Poked the <span className="text-gradient">AI Bear</span> 🐻
          </h2>

          <div className="space-y-4 text-lg text-muted-foreground font-body max-w-2xl mx-auto mb-10">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Teaching a machine to be smart isn’t that hard. Convincing humans they’re not already smart is the real
              problem.
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
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium text-lg shadow-glow hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              <BrainCircuit size={22} />
              Explore My AI Playground
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default AISection;
