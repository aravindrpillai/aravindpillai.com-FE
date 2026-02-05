import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import Videos from "./pages/Videos";
import Photos from "./pages/Photos";
import NotFound from "./pages/NotFound";
import Anonymous from "./pages/anonymous/Anonymous";
import QChat from "./pages/qchat/QChat";
import QChats from "./pages/qchat/QChats";
import QChatV3 from "./pages/qchat/QChatV3";
import ReadAnonymous from "./pages/anonymous/ReadAnonymous";
import TextBoxPage from "./pages/textbox/Index";
import QChatOld from "./pages/qchat/QChatOld";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/photos" element={<Photos />} />
          
          {/* Anonymous */}
          <Route path="/anonymous" element={<Anonymous />} />
          <Route path="/anonymous/read" element={<ReadAnonymous />} />
          
          {/* Textbox */}
          <Route path="/textbox" element={<TextBoxPage />} />
          <Route path="/textbox/:code" element={<TextBoxPage />} />
          


          {/* Anonymous */}
          <Route path="/qchat/:conversationName/:personName" element={<QChat />} />
          <Route path="/qc/:name/:sender" element={<QChatV3 />} />
          <Route path="/qchatold/:name/:sender" element={<QChatOld />} />
          <Route path="/qchats" element={<QChats />} />
          

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
