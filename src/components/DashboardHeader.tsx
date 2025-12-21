import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ReactNode } from 'react';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/hooks/useAuth';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function DashboardHeader({ title, subtitle, children }: DashboardHeaderProps) {
  const { user, profile, roles } = useAuth();
  
  const getInitials = (name: string | undefined, email: string | undefined) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (!email) return 'U';
    const emailName = email.split('@')[0];
    return emailName.slice(0, 2).toUpperCase();
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const primaryRole = roles[0] || 'member';
  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    hr: 'HR Manager',
    tl: 'Team Lead',
    member: 'Team Member',
  };

  return (
    <header className="bg-card border-b border-border min-h-16 px-6 py-3 flex items-center justify-between sticky top-0 z-10 gap-4">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search..." 
            className="pl-10 w-64 bg-secondary border-0"
          />
        </div>
        
        <NotificationBell />
        
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {getInitials(profile?.full_name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[primaryRole]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
