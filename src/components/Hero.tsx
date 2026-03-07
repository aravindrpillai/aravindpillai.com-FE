import { motion } from "framer-motion";
import SocialLinks from "./SocialLinks";
import profileImage from "@/assets/profile.png";

const taglineItems = [
  "Fullstack Developer",
  "Science Enthusiast",
  "Hobbyist Photographer",
];

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-subtle relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/3 rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="mb-10"
        >
          <div className="w-36 h-36 md:w-44 md:h-44 mx-auto rounded-full p-[2px] bg-gradient-warm shadow-glow animate-float">
            <img
              src={profileImage}
              alt="Aravind R Pillai"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </motion.div>

        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <span className="inline-block text-xs md:text-sm tracking-[0.3em] uppercase text-primary/70 font-body font-light">
            Welcome to my world
          </span>
        </motion.div>

        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-display font-light mb-6 tracking-tight leading-[0.95]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          Aravind{" "}
          <span className="text-gradient font-semibold">R.</span>{" "}
          Pillai
        </motion.h1>

        {/* Divider */}
        <motion.div
          className="flex items-center justify-center gap-4 mb-8"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
        </motion.div>

        {/* Tagline */}
        <motion.div
          className="flex flex-wrap justify-center items-center gap-3 md:gap-5 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {taglineItems.map((item, index) => (
            <motion.span
              key={item}
              className="text-sm md:text-base text-muted-foreground font-body font-light tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.15, duration: 0.5 }}
            >
              <motion.span
                className="inline-block"
                whileHover={{ color: "hsl(42, 75%, 55%)" }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {item}
              </motion.span>
              {index < taglineItems.length - 1 && (
                <span className="ml-3 md:ml-5 text-primary/30">◆</span>
              )}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex justify-center"
        >
          <SocialLinks size="lg" />
        </motion.div>

        <motion.div
          className="mt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          <a
            href="#about"
            className="inline-flex flex-col items-center gap-2 text-muted-foreground/50 hover:text-primary/70 transition-colors"
          >
            <span className="text-[10px] tracking-[0.25em] uppercase font-body">Scroll</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-px h-8 bg-gradient-to-b from-primary/40 to-transparent"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
