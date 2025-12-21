import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Settings, 
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from './ThemeToggle';
import leapswitchLogo from '@/assets/leapswitch-logo-alt.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', adminOnly: false },
  { icon: Calendar, label: 'Roster', path: '/roster', adminOnly: false },
  { icon: Users, label: 'Team', path: '/team', adminOnly: false },
  { icon: Clock, label: 'Shifts', path: '/shifts', adminOnly: false },
  { icon: CalendarDays, label: 'Leave', path: '/leave', adminOnly: false },
  { icon: Building2, label: 'Departments', path: '/departments', adminOnly: false },
  { icon: Shield, label: 'Role Management', path: '/admin/roles', adminOnly: true },
  { icon: Settings, label: 'Settings', path: '/settings', adminOnly: false },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut, roles, isHR, isTL, isAdmin } = useAuth();

  const getRoleBadge = () => {
    if (isAdmin) return 'Admin';
    if (isHR) return 'HR';
    if (isTL) return 'TL';
    return 'Member';
  };

  return (
    <aside className={cn(
      'bg-sidebar h-screen sticky top-0 flex flex-col border-r border-sidebar-border transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img 
              src={leapswitchLogo} 
              alt="Leapswitch Networks" 
              className="h-8 object-contain dark:brightness-0 dark:invert"
            />
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-[#e74c3c] flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems
          .filter(item => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-primary' 
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon size={20} />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
      </nav>

      {/* User Info & Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-3">
        {user && (
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50',
            collapsed && 'justify-center'
          )}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {user.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.email?.split('@')[0]}
                </p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {getRoleBadge()}
                </Badge>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
              collapsed && 'px-2'
            )}
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <>
                <ChevronLeft size={18} className="mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
          
          {!collapsed && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut size={18} />
            </Button>
          )}
        </div>
        
        {collapsed && user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut size={18} />
          </Button>
        )}
      </div>
    </aside>
  );
}
