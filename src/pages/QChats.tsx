import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import PasscodeModal from "@/components/chat/PasscodeModal";
import { toast } from "sonner";

interface Chat {
  id: string;
  name: string;
  code: string;
  emails: string;
  emailSubject: string;
  emailInterval: string;
}

const QChats = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      name: "marks",
      code: "1234",
      emails: "user@example.com",
      emailSubject: "New Message",
      emailInterval: "daily",
    },
    {
      id: "2",
      name: "study-group",
      code: "5678",
      emails: "group@example.com",
      emailSubject: "Study Updates",
      emailInterval: "weekly",
    },
  ]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newChat, setNewChat] = useState<Omit<Chat, "id">>({
    name: "",
    code: "",
    emails: "",
    emailSubject: "",
    emailInterval: "",
  });

  const handlePasscodeVerify = (passcode: string) => {
    if (passcode.length === 4) {
      setIsAuthenticated(true);
      toast.success("Access granted!");
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setSelectedChat(null);
    setNewChat({
      name: "",
      code: "",
      emails: "",
      emailSubject: "",
      emailInterval: "",
    });
  };

  const handleSaveNew = () => {
    if (!newChat.name.trim()) {
      toast.error("Please enter a chat name");
      return;
    }
    const chat: Chat = {
      id: Date.now().toString(),
      ...newChat,
    };
    setChats((prev) => [...prev, chat]);
    setSelectedChat(chat);
    setIsAddingNew(false);
    toast.success("Chat created successfully!");
  };

  const handleUpdateChat = (field: keyof Omit<Chat, "id">, value: string) => {
    if (selectedChat) {
      const updated = { ...selectedChat, [field]: value };
      setSelectedChat(updated);
      setChats((prev) =>
        prev.map((c) => (c.id === selectedChat.id ? updated : c))
      );
    }
  };

  const handleDeleteChat = () => {
    if (selectedChat) {
      setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
      setSelectedChat(null);
      toast.success("Chat deleted");
    }
  };

  const handleClearFields = () => {
    if (selectedChat) {
      const cleared = {
        ...selectedChat,
        code: "",
        emails: "",
        emailSubject: "",
        emailInterval: "",
      };
      setSelectedChat(cleared);
      setChats((prev) =>
        prev.map((c) => (c.id === selectedChat.id ? cleared : c))
      );
      toast.info("Fields cleared");
    }
  };

  return (
    <>
      <PasscodeModal isOpen={!isAuthenticated} onVerify={handlePasscodeVerify} />

      <AnimatePresence>
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-background flex flex-col"
          >
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-4 px-4 sm:px-6 py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Manage Chats
                </h1>
              </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row">
              {/* Left Sidebar - Chat List */}
              <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r bg-muted/30"
              >
                <div className="p-4">
                  <Button
                    onClick={handleAddNew}
                    className="w-full gap-2"
                    variant="default"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Chat
                  </Button>
                </div>

                <Separator />

                <ScrollArea className="h-48 md:h-[calc(100vh-180px)]">
                  <div className="p-2 space-y-1">
                    {chats.map((chat, index) => (
                      <motion.button
                        key={chat.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        onClick={() => handleSelectChat(chat)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                          selectedChat?.id === chat.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <MessageSquare className="w-5 h-5 shrink-0" />
                        <span className="font-medium truncate capitalize">
                          {chat.name}
                        </span>
                      </motion.button>
                    ))}

                    {chats.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No chats yet. Create one!
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </motion.aside>

              {/* Right Panel - Chat Details */}
              <motion.main
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 p-4 sm:p-6 lg:p-8"
              >
                <AnimatePresence mode="wait">
                  {isAddingNew ? (
                    <motion.div
                      key="add-new"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="max-w-lg mx-auto space-y-6"
                    >
                      <h2 className="text-xl font-semibold">Create New Chat</h2>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Chat Name</Label>
                          <Input
                            id="name"
                            placeholder="Enter chat name"
                            value={newChat.name}
                            onChange={(e) =>
                              setNewChat((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="code">Code</Label>
                          <Input
                            id="code"
                            placeholder="Enter code"
                            value={newChat.code}
                            onChange={(e) =>
                              setNewChat((prev) => ({
                                ...prev,
                                code: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="emails">Emails</Label>
                          <Input
                            id="emails"
                            type="email"
                            placeholder="Enter email addresses"
                            value={newChat.emails}
                            onChange={(e) =>
                              setNewChat((prev) => ({
                                ...prev,
                                emails: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="emailSubject">Email Subject</Label>
                          <Input
                            id="emailSubject"
                            placeholder="Enter email subject"
                            value={newChat.emailSubject}
                            onChange={(e) =>
                              setNewChat((prev) => ({
                                ...prev,
                                emailSubject: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="emailInterval">Email Interval</Label>
                          <Input
                            id="emailInterval"
                            placeholder="e.g., daily, weekly"
                            value={newChat.emailInterval}
                            onChange={(e) =>
                              setNewChat((prev) => ({
                                ...prev,
                                emailInterval: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button onClick={handleSaveNew} className="flex-1">
                          Create Chat
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsAddingNew(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  ) : selectedChat ? (
                    <motion.div
                      key={selectedChat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="max-w-lg mx-auto space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold capitalize">
                          {selectedChat.name}
                        </h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/qchat/${selectedChat.name}/${selectedChat.name}`
                            )
                          }
                        >
                          Open Chat →
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-code">Code</Label>
                          <Input
                            id="edit-code"
                            placeholder="Enter code"
                            value={selectedChat.code}
                            onChange={(e) =>
                              handleUpdateChat("code", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-emails">Emails</Label>
                          <Input
                            id="edit-emails"
                            type="email"
                            placeholder="Enter email addresses"
                            value={selectedChat.emails}
                            onChange={(e) =>
                              handleUpdateChat("emails", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-emailSubject">
                            Email Subject
                          </Label>
                          <Input
                            id="edit-emailSubject"
                            placeholder="Enter email subject"
                            value={selectedChat.emailSubject}
                            onChange={(e) =>
                              handleUpdateChat("emailSubject", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-emailInterval">
                            Email Interval
                          </Label>
                          <Input
                            id="edit-emailInterval"
                            placeholder="e.g., daily, weekly"
                            value={selectedChat.emailInterval}
                            onChange={(e) =>
                              handleUpdateChat("emailInterval", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleClearFields}
                          className="gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Clear
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteChat}
                          className="gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground"
                    >
                      <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg">Select a chat or create a new one</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QChats;
