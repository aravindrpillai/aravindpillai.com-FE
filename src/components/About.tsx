import { motion } from "framer-motion";
import { ExternalLink, TrendingUp, BarChart3 } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-20 md:py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-12 text-center">
            About <span className="text-gradient">Me</span>
          </h2>

          <div className="space-y-6 text-lg leading-relaxed text-foreground/90 font-body text-justify">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="first-letter:text-5xl first-letter:font-display first-letter:text-primary first-letter:mr-2 first-letter:float-left first-letter:leading-none"
            >
              Hello there, I'm a full-stack developer with a love for exploring the world and capturing its beauty through my lens. My obsession with coding is like a never-ending romance that just keeps getting stronger with each new technology I learn.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              I have an undying passion for photography, constantly seeking out new destinations to explore and capture their beauty through my lens. However, despite my best efforts, my wife often teases me that my photography skills are hit or miss - and to be honest, it's usually more miss than hit. But I don't let that stop me from snapping away!
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              As a firm believer in the power of science, I'd rather roll up my sleeves and get into some research and experiments rather than wasting time on prayers. I'm more likely to put my faith in the trusty scientific method than any divine intervention.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Originally hailing from the southern part of Kerala-India, I've now planted my roots in Canada after a brief chapter in the UK, but who knows where my wanderlust will lead me next? When I'm not busy coding or globe-trotting, I can be found at home (attempting to win debates with my charming wife) and devising ways to blend my passions. My ultimate goal? It's a work in progress, so stay tuned for updates!
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-muted-foreground italic text-center"
            >
              Feeling curious? Go ahead and click those icons below to take a closer peek into my world. Don't worry, it's not creepy if I've given you permission, right?
            </motion.p>
          </div>

          {/* Anonymous Message & Stock Analyzer Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-12 p-6 bg-card rounded-2xl border border-border shadow-soft"
          >
            <p className="text-foreground/90 mb-4 text-justify">
              And finally, if you've ever felt the urge to share something with me without the fuss of revealing your true identity, look no further:
            </p>
            <a
              href="/anonymous"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ExternalLink size={18} />
              Send an anonymous message
            </a>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-foreground/90 mb-4">
                Interested in the stock market? Check out my prediction analyzer:
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                >
                  <TrendingUp size={18} />
                  LongTerm
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                >
                  <BarChart3 size={18} />
                  Intraday
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;
