import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('admin' | 'hr' | 'tl' | 'member')[];
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  fallbackPath = '/' 
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isHR, isTL, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // Check if user is authenticated
    if (!user) {
      navigate('/auth');
      return;
    }

    // If no required roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) return;

    // Check if user has any of the required roles
    const hasAccess = requiredRoles.some(role => {
      if (role === 'admin') return isAdmin;
      if (role === 'hr') return isHR;
      if (role === 'tl') return isTL;
      return roles.includes(role);
    });

    if (!hasAccess) {
      toast.error('Access denied. You do not have permission to view this page.');
      navigate(fallbackPath);
    }
  }, [user, loading, isAdmin, isHR, isTL, roles, requiredRoles, navigate, fallbackPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If required roles exist, check access
  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = requiredRoles.some(role => {
      if (role === 'admin') return isAdmin;
      if (role === 'hr') return isHR;
      if (role === 'tl') return isTL;
      return roles.includes(role);
    });

    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
