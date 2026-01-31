import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Send, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmojiPicker from "./EmojiPicker";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, imageUrl?: string) => void;
}

const ChatInput = ({ value, onChange, onSend }: ChatInputProps) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const msg = value.trim();
    if (msg || imagePreview) {
      onSend(msg, imagePreview || undefined);
      onChange("");
      setImagePreview(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiSelect = (emoji: string) => {
    onChange(value + emoji);
    textareaRef.current?.focus();
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <footer className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm">
      <div className="p-3 sm:p-4">
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-3 relative inline-block"
          >
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-24 rounded-lg border"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={removeImage}
              type="button"
            >
              <X className="w-3 h-3" />
            </Button>
          </motion.div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={2}
              className={[
                "resize-none pr-20 rounded-2xl bg-muted/50 border-0 focus-visible:ring-1",
                // fixed 3-row feel: lock height + comfy line height/padding
                "h-[70px] leading-relaxed py-3",
              ].join(" ")}
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSubmit}
              size="icon"
              className="rounded-full h-11 w-11 shrink-0"
              disabled={!value.trim() && !imagePreview}
              type="button"
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </footer>
  );
};

export default ChatInput;
