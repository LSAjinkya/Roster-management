import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function DashboardHeader({ title, subtitle, children }: DashboardHeaderProps) {
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
        
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </Button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
        </div>
      </div>
    </header>
  );
}
