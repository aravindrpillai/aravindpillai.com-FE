 import { useState, useEffect, useRef, useCallback } from "react";
 import { useParams, useNavigate } from "react-router-dom";
 import { motion, AnimatePresence } from "framer-motion";
 import { Bell, Pause, Trash2, Send, Reply } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { useIsMobile } from "@/hooks/use-mobile";
 
 interface Message {
   id: string;
   content: string;
   sender: "me" | "other";
   senderName: string;
   timestamp: Date;
 }
 
 const QChatV3 = () => {
   const { name, sender } = useParams();
   const navigate = useNavigate();
   const isMobile = useIsMobile();
 
   const [messages, setMessages] = useState<Message[]>([]);
   const [inputValue, setInputValue] = useState("");
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
 
   // Auto-resize textarea
   const adjustTextareaHeight = useCallback(() => {
     const textarea = textareaRef.current;
     if (textarea) {
       textarea.style.height = "auto";
       textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
     }
   }, []);
 
   // Scroll to bottom
   const scrollToBottom = useCallback(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
   }, []);
 
   // Load demo messages
   useEffect(() => {
     setMessages([
       {
         id: "1",
         content: "Hey! How's it going?",
         sender: "other",
         senderName: sender || "Unknown",
         timestamp: new Date(Date.now() - 3600000),
       },
       {
         id: "2",
         content: "I'm doing great, thanks for asking! 😊",
         sender: "me",
         senderName: "Me",
         timestamp: new Date(Date.now() - 3500000),
       },
       {
         id: "3",
         content: "That's wonderful to hear. Did you finish the project?",
         sender: "other",
         senderName: sender || "Unknown",
         timestamp: new Date(Date.now() - 3400000),
       },
       {
         id: "4",
         content: "Yes! Just submitted it yesterday. The team loved it.",
         sender: "me",
         senderName: "Me",
         timestamp: new Date(Date.now() - 3300000),
       },
     ]);
   }, [sender]);
 
   // Scroll on new messages
   useEffect(() => {
     scrollToBottom();
   }, [messages, scrollToBottom]);
 
   // Adjust textarea on input change
   useEffect(() => {
     adjustTextareaHeight();
   }, [inputValue, adjustTextareaHeight]);
 
   const handleSend = () => {
     const trimmed = inputValue.trim();
     if (!trimmed) return;
 
     const newMessage: Message = {
       id: Date.now().toString(),
       content: trimmed,
       sender: "me",
       senderName: "Me",
       timestamp: new Date(),
     };
 
     setMessages((prev) => [...prev, newMessage]);
     setInputValue("");
     
     // Reset textarea height
     if (textareaRef.current) {
       textareaRef.current.style.height = "auto";
     }
   };
 
   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     // Mobile: Enter = new line, no send shortcut
     // Desktop: Enter = send, Shift+Enter = new line
     if (e.key === "Enter") {
       if (isMobile) {
         // On mobile, Enter always creates new line (default behavior)
         return;
       } else {
         // On desktop
         if (e.shiftKey) {
           // Shift+Enter = new line (default behavior)
           return;
         } else {
           // Enter = send
           e.preventDefault();
           handleSend();
         }
       }
     }
   };
 
   const formatTime = (date: Date) => {
     return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
   };
 
   const formatName = (str?: string) => {
     if (!str) return "Chat";
     return str.charAt(0).toUpperCase() + str.slice(1);
   };
 
   return (
     <div className="h-dvh bg-muted/30 flex flex-col overflow-hidden">
       <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full md:my-4 md:rounded-xl md:border md:shadow-lg bg-background overflow-hidden">
       {/* Fixed Header */}
       <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm z-40 md:rounded-t-xl">
         <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto w-full">
           <h1 className="text-lg font-semibold text-foreground truncate">
             {formatName(name)}
           </h1>
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" className="h-9 w-9">
               <Bell className="w-4 h-4" />
             </Button>
             <Button variant="ghost" size="icon" className="h-9 w-9">
               <Pause className="w-4 h-4" />
             </Button>
             <Button
               variant="ghost"
               size="icon"
               className="h-9 w-9 text-destructive hover:text-destructive"
             >
               <Trash2 className="w-4 h-4" />
             </Button>
           </div>
         </div>
       </header>
 
       {/* Scrollable Messages Area */}
       <main className="flex-1 overflow-y-auto px-4 py-4 bg-background">
         <div className="space-y-3">
           <AnimatePresence initial={false}>
             {messages.map((message) => (
               <MessageBubble key={message.id} message={message} formatTime={formatTime} />
             ))}
           </AnimatePresence>
           <div ref={messagesEndRef} />
         </div>
       </main>
 
       {/* Fixed Input Area */}
       <footer className="shrink-0 border-t bg-background md:rounded-b-xl">
         <div className="p-3">
           <div className="flex items-end gap-2">
             <textarea
               ref={textareaRef}
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="Type a message..."
               rows={1}
               className="flex-1 min-h-[44px] max-h-[150px] px-4 py-3 rounded-2xl bg-muted/50 border-0 resize-none text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
             />
             <Button
               onClick={handleSend}
               disabled={!inputValue.trim()}
               className="h-[44px] w-[44px] shrink-0 rounded-xl"
               size="icon"
             >
               <Send className="w-5 h-5" />
             </Button>
           </div>
         </div>
       </footer>
       </div>
     </div>
   );
 };
 
 // Separate message component for cleaner code
 interface MessageBubbleProps {
   message: Message;
   formatTime: (date: Date) => string;
 }
 
 const MessageBubble = ({ message, formatTime }: MessageBubbleProps) => {
   const isMe = message.sender === "me";
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 10 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -10 }}
       className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
     >
       <div className={`relative max-w-[80%] sm:max-w-[70%]`}>
         <div
           className={`px-4 py-2.5 rounded-2xl ${
             isMe
               ? "bg-primary text-primary-foreground rounded-br-md"
               : "bg-muted text-foreground rounded-bl-md"
           }`}
         >
           <p className="text-sm whitespace-pre-wrap break-words">
             {message.content}
           </p>
           <span
             className={`text-[10px] mt-1 block ${
               isMe ? "text-primary-foreground/70" : "text-muted-foreground"
             }`}
           >
             {message.senderName} · {formatTime(message.timestamp)}
           </span>
         </div>
 
         {/* Hover Actions */}
         <div
           className={`absolute top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
             isMe ? "-left-16" : "-right-16"
           }`}
         >
           <Button variant="ghost" size="icon" className="h-7 w-7">
             <Reply className="w-3.5 h-3.5" />
           </Button>
           <Button
             variant="ghost"
             size="icon"
             className="h-7 w-7 text-destructive hover:text-destructive"
           >
             <Trash2 className="w-3.5 h-3.5" />
           </Button>
         </div>
       </div>
     </motion.div>
   );
 };
 
 export default QChatV3;