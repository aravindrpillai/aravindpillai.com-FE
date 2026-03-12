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
import QChats from "./pages/qchat/QChats";
import QChatV3 from "./pages/qchat/QChatV3";
import QChatStable from "./pages/qchat/QChatStable";
import ReadAnonymous from "./pages/anonymous/ReadAnonymous";
import TextBoxPage from "./pages/textbox/Index";
 import FileGallery from "./pages/file/FileGallery";
import CAA from "./pages/CAA";
import Beneva from "./pages/Beneva";

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
          <Route path="/qchat/:name/:sender" element={<QChatV3 />} />
          <Route path="/qchatstable/:name/:sender" element={<QChatStable />} />
          
          <Route path="/qchats" element={<QChats />} />

          <Route path="/file/:name/:sender" element={<FileGallery />} />
          <Route path="/caa" element={<CAA />} />
          <Route path="/beneva" element={<Beneva />} />


          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
