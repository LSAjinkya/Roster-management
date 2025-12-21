import { Outlet, Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { LoadingScreen } from '@/components/LoadingScreen';

export function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <ImpersonationBanner />
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </>
  );
}
