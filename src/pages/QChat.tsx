import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Pause, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import PasscodeModal from "@/components/chat/PasscodeModal";
import ImagePreviewModal from "@/components/chat/ImagePreviewModal";
import ChatMessage, { Message } from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import { toast } from "sonner";

const QChat = () => {
  const { conversationName, personName } = useParams();
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handlePasscodeVerify = (passcode: string) => {
    // For demo, accept any 4-digit passcode
    if (passcode.length === 4) {
      setIsAuthenticated(true);
      toast.success("Welcome back!");
    }
  };

  // Simulate loading messages
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        setMessages([
          {
            id: "1",
            content: "Hey! How did the exam go?",
            sender: "other",
            timestamp: new Date(Date.now() - 3600000),
          },
          {
            id: "2",
            content: "It was tough but I think I did well 😊",
            sender: "me",
            timestamp: new Date(Date.now() - 3500000),
          },
          {
            id: "3",
            content: "That's great! Did you study the chapters I mentioned?",
            sender: "other",
            timestamp: new Date(Date.now() - 3400000),
          },
          {
            id: "4",
            content: "Yes! They were really helpful. Thanks for the notes 🙏",
            sender: "me",
            timestamp: new Date(Date.now() - 3300000),
          },
        ]);
        setIsLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = (content: string, imageUrl?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: "me",
      timestamp: new Date(),
      imageUrl,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleReply = (content: string) => {
    if (content) {
      setInputValue(content + "\n--\n");
    }
  };

  const handlePushEmail = () => {
    toast.success("Conversation pushed to email!");
  };

  const handlePause = () => {
    toast.info("Conversation paused");
  };

  const handleDelete = () => {
    toast.error("Conversation deleted");
    navigate("/");
  };

  const formatConversationName = (name?: string) => {
    if (!name) return "Conversation";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <>
      <PasscodeModal isOpen={!isAuthenticated} onVerify={handlePasscodeVerify} />

      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage || ""}
        onClose={() => setPreviewImage(null)}
      />

      <AnimatePresence>
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-background flex flex-col"
          >
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
              <div className="flex items-center justify-between px-3 sm:px-6 py-3">
                <div className="flex items-center gap-2 sm:gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/")}
                    className="shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold text-foreground">
                      {formatConversationName(conversationName)}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      with {personName || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePushEmail}
                    className="hidden sm:flex gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Push Email
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePushEmail}
                    className="sm:hidden"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePause}
                    className="hidden sm:flex gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePause}
                    className="sm:hidden"
                  >
                    <Pause className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="hidden sm:flex gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    className="sm:hidden text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 sm:px-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Loader2 className="w-10 h-10 text-primary" />
                  </motion.div>
                  <p className="text-muted-foreground">
                    Loading conversation...
                  </p>
                </div>
              ) : (
                <div className="py-4 space-y-3">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      onReply={handleReply}
                      onImageClick={setPreviewImage}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QChat;
