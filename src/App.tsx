import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useSavedSearchAutomation } from "@/hooks/useSavedSearchAutomation";
import { QuickActions, useQuickActions } from "@/components/common/QuickActions";
import { KeyboardShortcuts, useKeyboardNavigation } from "@/components/common/KeyboardShortcuts";
import { OnboardingWizard, useOnboarding } from "@/components/onboarding/OnboardingWizard";
import Index from "./pages/Index";
import Applications from "./pages/Applications";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to initialize realtime subscriptions and global features
function GlobalProviders({ children }: { children: React.ReactNode }) {
  useRealtimeNotifications();
  useSavedSearchAutomation();
  useKeyboardNavigation();
  
  const { open: quickActionsOpen, setOpen: setQuickActionsOpen } = useQuickActions();
  const { showOnboarding, setShowOnboarding } = useOnboarding();

  return (
    <>
      {children}
      <QuickActions open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />
      <KeyboardShortcuts />
      <OnboardingWizard open={showOnboarding} onOpenChange={setShowOnboarding} />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <GlobalProviders>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Layout><Index /></Layout>} />
              <Route path="/applications" element={<Layout><Applications /></Layout>} />
              <Route path="/jobs" element={<Layout><Jobs /></Layout>} />
              <Route path="/jobs/:jobId" element={<Layout><JobDetails /></Layout>} />
              <Route path="/profile" element={<Layout><Profile /></Layout>} />
              <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </GlobalProviders>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
