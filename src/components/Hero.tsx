import { motion } from "framer-motion";
import { BookOpen, Video, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import SocialLinks from "./SocialLinks";
import profileImage from "@/assets/profile.png";

const taglineItems = [
  "Fullstack Developer",
  "Science Enthusiast", 
  "Hobbyist Photographer",
];

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-subtle">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="w-36 h-36 md:w-44 md:h-44 mx-auto rounded-full bg-gradient-warm p-1 shadow-glow animate-float">
            <img
              src={profileImage}
              alt="Aravind R Pillai"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-6 tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Aravind R <span className="text-gradient">Pillai</span>
        </motion.h1>

        {/* Animated Tagline */}
        <motion.div
          className="flex flex-wrap justify-center items-center gap-2 md:gap-3 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {taglineItems.map((item, index) => (
            <motion.span
              key={item}
              className="text-base md:text-lg text-muted-foreground font-body"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.15, duration: 0.5 }}
            >
              <motion.span
                className="inline-block"
                whileHover={{ scale: 1.05, color: "hsl(24, 80%, 55%)" }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {item}
              </motion.span>
              {index < taglineItems.length - 1 && (
                <motion.span
                  className="ml-2 md:ml-3 text-primary"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2, delay: index * 0.3 }}
                >
                  |
                </motion.span>
              )}
            </motion.span>
          ))}
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8"
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-card border border-border rounded-full font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-soft hover:shadow-glow text-sm md:text-base"
          >
            <BookOpen size={18} />
            Blog
          </Link>
          <Link
            to="/videos"
            className="inline-flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-card border border-border rounded-full font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-soft hover:shadow-glow text-sm md:text-base"
          >
            <Video size={18} />
            Videos
          </Link>
          <Link
            to="/photos"
            className="inline-flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-card border border-border rounded-full font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-soft hover:shadow-glow text-sm md:text-base"
          >
            <Camera size={18} />
            Photos
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="flex justify-center"
        >
          <SocialLinks size="lg" />
        </motion.div>

        <motion.div
          className="mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <a
            href="#about"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="text-sm font-medium">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              ↓
            </motion.div>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
