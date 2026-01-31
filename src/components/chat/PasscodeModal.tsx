import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface PasscodeModalProps {
  isOpen: boolean;
  onVerify: (passcode: string) => void;
}

const PasscodeModal = ({ isOpen, onVerify }: PasscodeModalProps) => {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (passcode.length === 4) {
      onVerify(passcode);
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`relative w-full max-w-sm mx-4 p-8 rounded-2xl bg-card border shadow-2xl ${
              error ? "animate-shake" : ""
            }`}
            onKeyDown={handleKeyDown}
          >
            <div className="flex flex-col items-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Lock className="w-8 h-8 text-primary" />
              </motion.div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Enter Passcode
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your 4-digit passcode to access this conversation
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={4}
                  value={passcode}
                  onChange={(value) => setPasscode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full gap-2"
                disabled={passcode.length !== 4}
              >
                <ShieldCheck className="w-4 h-4" />
                Verify & Enter
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasscodeModal;
