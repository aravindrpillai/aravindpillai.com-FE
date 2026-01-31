import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛"],
  "Gestures": ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "🙏"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️"],
  "Objects": ["🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "⭐", "🌟", "✨", "💫", "🔥", "💯", "✅", "❌", "⚠️", "📌", "📍", "💡", "🔔", "🎵"],
};

const EmojiPicker = ({ onEmojiSelect }: EmojiPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-2"
      >
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {category}
              </p>
              <div className="grid grid-cols-10 gap-1">
                {emojis.map((emoji, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-7 h-7 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
