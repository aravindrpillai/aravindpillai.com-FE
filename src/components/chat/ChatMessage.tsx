import { motion } from "framer-motion";
import { Reply } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Message {
  id: string;
  content: string;
  sender: "me" | "other";
  timestamp: Date;
  imageUrl?: string;
}

interface ChatMessageProps {
  msg_sender: string,
  message: Message;
  onReply: (content: string) => void;
  onImageClick: (imageUrl: string) => void;
}

const ChatMessage = ({ msg_sender, message, onReply, onImageClick }: ChatMessageProps) => {
  const isMe = message.sender === "me";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
    >
      <div
        className={`relative max-w-[75%] sm:max-w-[60%] ${
          isMe ? "order-2" : "order-1"
        }`}
      >
        <div
          className={`px-4 py-2.5 rounded-2xl bg-muted text-foreground rounded-bl-md `}
        >
          {message.imageUrl && (
            <motion.img
              src={message.imageUrl}
              alt="Shared image"
              className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick(message.imageUrl!)}
              whileHover={{ scale: 1.02 }}
            />
          )}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          <span
            className={`text-[10px] mt-1 block text-muted-foreground`}
          >
            {msg_sender} @ {formatTime(message.timestamp)}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 ${
            isMe ? "-left-9" : "-right-9"
          }`}
          onClick={() => onReply(message.content)}
        >
          <Reply className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
