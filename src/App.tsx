import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import TestsPage from "./pages/TestsPage";
import TestEntry from "./pages/TestEntry";
import TestInterface from "./pages/TestInterface";
import Results from "./pages/Results";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import TestEditor from "./pages/TestEditor";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/tests" element={<TestsPage />} />
              <Route path="/enter/:testId" element={<TestEntry />} />
              <Route path="/test/:attemptId" element={<TestInterface />} />
              <Route path="/results/:attemptId" element={<Results />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/urecheater" element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } />
              <Route path="/urecheater/test/:testId" element={
                <ProtectedRoute requireAdmin>
                  <TestEditor />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
