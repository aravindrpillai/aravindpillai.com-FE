import { Mail, Phone, Heart } from "lucide-react";
import SocialLinks from "./SocialLinks";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 px-6 border-t border-border bg-card/50">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Contact Info */}
          <div className="flex flex-col sm:flex-row items-center gap-6 text-sm text-muted-foreground">
            <a
              href="mailto:aravind@example.com"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Mail size={16} />
              aravind@example.com
            </a>
            <a
              href="tel:+1234567890"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone size={16} />
              +1 (234) 567-890
            </a>
          </div>

          {/* Social Links */}
          <SocialLinks size="sm" />
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            © {currentYear} Aravind Ramachandran Pillai. Made with{" "}
            <Heart size={14} className="text-primary fill-primary" /> in Canada
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
