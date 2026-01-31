import { motion } from "framer-motion";
import { ArrowLeft, Send, Shield, Lock, Eye } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Anonymous = () => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please write something before sending!");
      return;
    }
    
    setIsSending(true);
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success("Message sent anonymously! Thank you for sharing.");
    setMessage("");
    setIsSending(false);
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 px-4 sm:px-6 py-8 sm:py-12 max-w-2xl mx-auto">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6 sm:mb-8 hover:bg-primary/10 group"
          >
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Button>
        </motion.div>

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-8 sm:mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-warm rounded-full flex items-center justify-center shadow-lg"
          >
            <Shield className="text-primary-foreground w-8 h-8 sm:w-10 sm:h-10" />
          </motion.div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-3 sm:mb-4">
            <span className="text-gradient">Anonymous</span> Message
          </h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto leading-relaxed px-2"
          >
            You are <span className="text-primary font-semibold">completely anonymous</span>. 
            Go ahead and spill the beans! 🫘
          </motion.p>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-10"
        >
          {[
            { icon: Lock, text: "Encrypted" },
            { icon: Eye, text: "No Tracking" },
            { icon: Shield, text: "100% Private" },
          ].map((badge, index) => (
            <motion.div
              key={badge.text}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-card border border-border rounded-full text-xs sm:text-sm"
            >
              <badge.icon size={14} className="text-primary" />
              <span className="text-muted-foreground">{badge.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Message Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-4 sm:space-y-6"
        >
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your anonymous message here... Share feedback, confessions, thoughts, or anything you'd like to say without revealing who you are."
              className="min-h-[200px] sm:min-h-[250px] md:min-h-[300px] text-base sm:text-lg bg-card border-2 border-border focus:border-primary rounded-2xl p-4 sm:p-6 resize-none shadow-soft transition-all duration-300 focus:shadow-lg"
              disabled={isSending}
            />
            <motion.div
              className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 text-xs sm:text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: message.length > 0 ? 1 : 0 }}
            >
              {message.length} characters
            </motion.div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="flex-1 h-12 sm:h-14 text-base sm:text-lg rounded-xl border-2 hover:bg-muted order-2 sm:order-1"
              disabled={isSending}
            >
              <ArrowLeft size={18} className="mr-2" />
              Go Back
            </Button>
            
            <Button
              type="submit"
              disabled={isSending || !message.trim()}
              className="flex-1 h-12 sm:h-14 text-base sm:text-lg bg-gradient-warm hover:opacity-90 transition-all duration-300 rounded-xl text-primary-foreground font-medium shadow-lg hover:shadow-xl disabled:opacity-50 order-1 sm:order-2"
            >
              {isSending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Send size={18} className="mr-2" />
                  Send Anonymously
                </>
              )}
            </Button>
          </div>
        </motion.form>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8 px-2"
        >
          Your identity remains completely hidden. No IP addresses, no cookies, 
          no way to trace back to you. Feel free to speak your mind! 💭
        </motion.p>
      </div>
    </main>
  );
};

export default Anonymous;
