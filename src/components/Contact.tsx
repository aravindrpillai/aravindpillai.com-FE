import { motion } from "framer-motion";
import { Mail, Phone, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! I'll get back to you soon.");
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <section id="contact" className="py-20 md:py-32 px-6 bg-gradient-subtle">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center gap-4 mb-4 justify-center">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-primary/30" />
            <h2 className="text-3xl md:text-5xl font-display font-light text-center">
              Get in <span className="text-gradient font-semibold">Touch</span>
            </h2>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-primary/30" />
          </div>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto font-light">
            Have a question or want to work together? Drop me a message!
          </p>

          <div className="grid md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="space-y-6"
            >
              <div className="p-6 bg-card rounded-2xl border border-border shadow-soft">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">Email</h3>
                    <a href="mailto:hello@aravindpillai.com" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                      hello@aravindpillai.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-card rounded-2xl border border-border shadow-soft">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">Phone</h3>
                    <a href="tel:+1 (416) 854-7092" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                      +1 (416) 854-7092
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-card rounded-2xl border border-border shadow-soft text-center">
                <p className="text-muted-foreground text-sm font-light">
                  Based in <span className="text-foreground font-medium">Canada</span> 🇨🇦
                  <br />
                  Originally from <span className="text-foreground font-medium">Kerala, India</span> 🇮🇳
                </p>
              </div>
            </motion.div>

            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="space-y-6"
            >
              <Input
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-12 bg-card border-border focus:border-primary"
              />
              <Input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-12 bg-card border-border focus:border-primary"
              />
              <Textarea
                placeholder="Your Message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={5}
                className="bg-card border-border focus:border-primary resize-none"
              />
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-warm hover:opacity-90 transition-opacity text-primary-foreground font-medium tracking-wide"
              >
                <Send size={18} className="mr-2" />
                Send Message
              </Button>
            </motion.form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
