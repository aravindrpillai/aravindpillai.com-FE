import { Github, Facebook, Instagram, Linkedin, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const socialLinks = [
  { icon: Github, href: "https://github.com/aravindrpillai", label: "GitHub" },
  { icon: Facebook, href: "https://facebook.com/aravind.pillai.948", label: "Facebook" },
  { icon: Instagram, href: "https://instagram.com/aravind.ramachandran.pillai/", label: "Instagram" },
  { icon: Linkedin, href: "https://linkedin.com/in/aravindrpillai1992", label: "LinkedIn" },
  { icon: MessageCircle, href: "https://wa.me/+919447020535", label: "WhatsApp" },
];

interface SocialLinksProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SocialLinks = ({ size = "md", className = "" }: SocialLinksProps) => {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-11 h-11",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {socialLinks.map((social, index) => (
        <motion.a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${sizeClasses[size]} flex items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * index, duration: 0.5 }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.95 }}
          aria-label={social.label}
        >
          <social.icon size={iconSizes[size]} />
        </motion.a>
      ))}
    </div>
  );
};

export default SocialLinks;
