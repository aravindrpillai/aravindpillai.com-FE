import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Send, ImagePlus, X, Image, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmojiPicker from "./EmojiPicker";
import ImagePreviewModal from "./ImagePreviewModal";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, imageUrl?: string) => void;
}

const ChatInput = ({ value, onChange, onSend }: ChatInputProps) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      setDrawerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiSelect = (emoji: string) => {
    onChange(value + emoji);
    textareaRef.current?.focus();
    setDrawerOpen(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <ImagePreviewModal
        isOpen={showImageModal}
        imageUrl={imagePreview || ""}
        onClose={() => setShowImageModal(false)}
      />
      
      <footer className="shrink-0 border-t bg-background w-full">
        <div className="p-3 sm:p-4">
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-3 flex items-center gap-2"
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => setShowImageModal(true)}
              >
                <Image className="w-4 h-4" />
                Image attached
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={removeImage}
                type="button"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          <div className="flex items-stretch gap-2 w-full">
            {/* Drawer for emoji and image */}
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-[70px] w-11 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Add to message</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 pb-8 space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="w-5 h-5" />
                    Add Image
                  </Button>
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Emojis</p>
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} inline />
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            <div className="flex-1 min-w-0">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={2}
                className="resize-none rounded-2xl bg-muted/50 border-0 focus-visible:ring-1 h-[70px] leading-relaxed py-3 w-full"
              />
            </div>

            <Button
              onClick={handleSubmit}
              size="icon"
              className="h-[70px] w-11 shrink-0"
              disabled={!value.trim() && !imagePreview}
              type="button"
            >
              <Send className="w-5 h-5" />
            </Button>
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
    </>
  );
};

export default ChatInput;