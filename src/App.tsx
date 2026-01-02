import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Team from "./pages/Team";
import Shifts from "./pages/Shifts";
import Departments from "./pages/Departments";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import RoleManagement from "./pages/RoleManagement";
import LeaveRequests from "./pages/LeaveRequests";
import OrgChartPage from "./pages/OrgChartPage";
import PermissionsMatrix from "./pages/PermissionsMatrix";
import RosterSettings from "./pages/RosterSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/roster" element={<Roster />} />
              <Route path="/team" element={<Team />} />
              <Route path="/shifts" element={
                <ProtectedRoute requiredRoles={['admin', 'hr', 'tl']}>
                  <Shifts />
                </ProtectedRoute>
              } />
              <Route path="/departments" element={
                <ProtectedRoute requiredRoles={['admin', 'hr', 'tl']}>
                  <Departments />
                </ProtectedRoute>
              } />
              <Route path="/leave" element={<LeaveRequests />} />
              <Route path="/admin/roles" element={
                <ProtectedRoute requiredRoles={['admin', 'hr']}>
                  <RoleManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/permissions" element={
                <ProtectedRoute requiredRoles={['admin', 'hr']}>
                  <PermissionsMatrix />
                </ProtectedRoute>
              } />
              <Route path="/roster-settings" element={
                <ProtectedRoute requiredRoles={['admin', 'hr']}>
                  <RosterSettings />
                </ProtectedRoute>
              } />
              <Route path="/org-chart" element={<OrgChartPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
