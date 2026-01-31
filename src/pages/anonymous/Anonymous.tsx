import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import profileImage from "@/assets/profile.png";
import ApiClient from "@/lib/api";

type AlertState = {
  type: "success" | "error";
  text: string;
} | null;

const Anonymous = () => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const alertTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const clearAlertTimer = () => {
    if (alertTimerRef.current) {
      window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  };

  const showAlert = (type: "success" | "error", text: string) => {
    clearAlertTimer();
    setAlert({ type, text });

    alertTimerRef.current = window.setTimeout(() => {
      setAlert(null);
      alertTimerRef.current = null;
    }, 10000);
  };

  useEffect(() => {
    return () => {
      clearAlertTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const msg = message.trim();
    if (!msg) {
      showAlert("error", "Please write something before sending!");
      return;
    }

    setIsSending(true);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        token: "1234",
      };

      const url = ApiClient.buildFullUrl(import.meta.env.VITE_ANONYMOUS);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: msg }),
      });

      let respData: any = null;
      try {
        respData = await response.json();
      } catch {
        // ignore if backend returns empty/non-json
      }

      if (response.ok) {
        showAlert("success", "Message sent successfully.");
        setMessage("");
      } else {
        const backendMsg =
          respData?.message ||
          respData?.detail ||
          respData?.error ||
          "Failed to send message.";
        showAlert("error", backendMsg);
      }
    } catch (err) {
      console.error("Request error", err);
      showAlert("error", "Error sending message");
    } finally {
      setIsSending(false);
    }
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
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-8 sm:mb-12"
        >
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

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-3 sm:mb-4">
            Ready to <span className="text-gradient">spill the beans?</span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8 px-2"
          >
            Your identity remains completely hidden. Feel free to speak your mind! 💭
          </motion.p>

          {/* ✅ Inline Alert placed right after the subtitle */}
          <AnimatePresence>
            {alert && (
              <motion.div
                key="inline-alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className={`mt-4 mx-auto max-w-md text-center px-4 py-3 rounded-xl font-medium shadow-sm border
                  ${
                    alert.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
              >
                {alert.text}
              </motion.div>
            )}
          </AnimatePresence>
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
      </div>
    </main>
  );
};

export default Anonymous;
