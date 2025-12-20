import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserX, ArrowLeft } from 'lucide-react';

interface ImpersonationData {
  adminEmail: string;
  adminName: string;
  impersonatedEmail: string;
  impersonatedName: string;
  timestamp: string;
}

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('impersonation_session');
    if (data) {
      try {
        setImpersonationData(JSON.parse(data));
      } catch {
        localStorage.removeItem('impersonation_session');
      }
    }
  }, []);

  const handleReturnToAdmin = async () => {
    setReturning(true);
    try {
      // Sign out of impersonated session
      await supabase.auth.signOut();
      
      // Clear impersonation data
      localStorage.removeItem('impersonation_session');
      
      toast.success('Logged out of impersonated session. Please sign in as admin again.');
      navigate('/auth');
      window.location.reload();
    } catch (error: any) {
      console.error('Error returning to admin:', error);
      toast.error('Failed to end impersonation session');
    } finally {
      setReturning(false);
    }
  };

  if (!impersonationData) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-2 px-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4" />
          <span className="text-sm font-medium">
            Impersonating: <strong>{impersonationData.impersonatedName}</strong> ({impersonationData.impersonatedEmail})
          </span>
          <span className="text-xs opacity-75 ml-2">
            Admin: {impersonationData.adminEmail}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReturnToAdmin}
          disabled={returning}
          className="bg-background text-foreground hover:bg-background/90"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {returning ? 'Returning...' : 'Return to Admin'}
        </Button>
      </div>
    </div>
  );
}
