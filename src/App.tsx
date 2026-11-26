import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { lazy, Suspense } from "react";  // only used by Resolver (disabled below)
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import Videos from "./pages/Videos";
import Photos from "./pages/Photos";
import NotFound from "./pages/NotFound";
import Anonymous from "./pages/anonymous/Anonymous";
import QChatV3 from "./pages/qchat/QChatV3";
import TextBoxPage from "./pages/textbox/Index";
import CAA from "./pages/CAA";
import Beneva from "./pages/Beneva";
import AdminPage from "./pages/admin/AdminPage";
import AIChat from "./pages/ai/AIChat";
import StocksPage from "./pages/stocks/StocksPage";
import PlaygroundGate from "./pages/playground/PlaygroundGate";
import { EXAMPREP, FILE_ANALYSER, FINANCE } from "./pages/playground/apps";
import ExamPrepHome from "./pages/playground/examprep/Home";
import ExamPrepQuiz from "./pages/playground/examprep/Quiz";
import FileAnalyserUpload from "./pages/playground/fileanalyser/Upload";
import FileAnalyserChat from "./pages/playground/fileanalyser/Chat";
import FinanceQuestions from "./pages/playground/finance/Questions";
import FinanceSummary from "./pages/playground/finance/Summary";

// Resolver (AI conflict resolution) is DISABLED for now (code kept in src/pages/resolver).
// To re-enable: uncomment this, the react import above and the /resolver route below.
// const ResolverApp = lazy(() => import("./pages/resolver/app/ResolverApp"));

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
          
          {/* Textbox */}
          <Route path="/textbox" element={<TextBoxPage />} />
          <Route path="/textbox/:code" element={<TextBoxPage />} />

          {/* Admin panel: anonymous, QuickChat, notepad, stocks users, AI settings.
              Password = ADMIN_PANEL_PW in the backend env (QuickChat also asks for QCHAT_ADMIN_PW). */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/:tab" element={<AdminPage />} />
          {/* Old admin pages now live in the admin panel */}
          <Route path="/links" element={<Navigate to="/admin" replace />} />
          <Route path="/anonymous/read" element={<Navigate to="/admin/anonymous" replace />} />
          <Route path="/listall/textbox" element={<Navigate to="/admin/notepad" replace />} />
          <Route path="/quickchat/register" element={<Navigate to="/admin/qchat" replace />} />

          {/* AI conversations: /ai/<user>/<chat>. Users + their 4-digit codes, keys and models: admin panel -> AI */}
          <Route path="/ai" element={<AIChat />} />
          <Route path="/ai/:user" element={<AIChat />} />
          <Route path="/ai/:user/:convName" element={<AIChat />} />

          {/* Stocks: news -> analysis -> Claude review -> top picks. Everyone signs in with a user from admin panel -> Stocks (the owner too) */}
          <Route path="/stocks" element={<StocksPage />} />

          {/* Resolver: AI-assisted conflict resolution. Backend: Django `resolver` app (arp/resolver/). DISABLED for now. */}
          {/* <Route
            path="/resolver/*"
            element={
              <Suspense fallback={null}>
                <ResolverApp />
              </Suspense>
            }
          /> */}

          {/* Playground apps. Each asks for its own 4-digit code (admin panel -> Playground) or offers a free
              30-minute trial per IP (then a 24-hour wait). AI keys and models: admin panel -> AI. */}
          <Route path="/examprep" element={<PlaygroundGate app="examprep" meta={EXAMPREP} />}>
            <Route index element={<ExamPrepHome />} />
            <Route path="quiz" element={<ExamPrepQuiz />} />
          </Route>
          <Route path="/file-analyser" element={<PlaygroundGate app="file-analyser" meta={FILE_ANALYSER} />}>
            <Route index element={<FileAnalyserUpload />} />
            <Route path="chat/:sessionId" element={<FileAnalyserChat />} />
          </Route>
          <Route path="/finance-advisor" element={<PlaygroundGate app="finance" meta={FINANCE} />}>
            <Route index element={<FinanceQuestions />} />
            <Route path="questions/:sessionId" element={<FinanceQuestions />} />
            <Route path="summary/:sessionId" element={<FinanceSummary />} />
          </Route>



          {/* Quick Chat */}
          <Route path="/qchat/:name/:sender" element={<QChatV3 />} />
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
