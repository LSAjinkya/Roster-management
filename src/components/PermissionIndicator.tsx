import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Eye, Edit, Trash2, Plus, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Permission {
  action: 'view' | 'create' | 'edit' | 'delete' | 'manage';
  label: string;
  allowed: boolean;
}

interface PermissionIndicatorProps {
  feature: 'roster' | 'team' | 'shifts' | 'departments' | 'leave' | 'users';
  className?: string;
  showTooltip?: boolean;
}

const ACTION_ICONS = {
  view: Eye,
  create: Plus,
  edit: Edit,
  delete: Trash2,
  manage: UserCog,
};

export function PermissionIndicator({ feature, className, showTooltip = true }: PermissionIndicatorProps) {
  const { isAdmin, isHR, isTL } = useAuth();

  const getPermissions = (): Permission[] => {
    switch (feature) {
      case 'roster':
        return [
          { action: 'view', label: 'View roster', allowed: true },
          { action: 'edit', label: 'Edit shifts', allowed: isAdmin || isHR || isTL },
          { action: 'create', label: 'Create assignments', allowed: isAdmin || isHR || isTL },
        ];
      case 'team':
        return [
          { action: 'view', label: 'View team', allowed: true },
          { action: 'edit', label: 'Edit members', allowed: isAdmin || isHR },
          { action: 'manage', label: 'Manage roles', allowed: isAdmin || isHR },
        ];
      case 'shifts':
        return [
          { action: 'view', label: 'View shifts', allowed: isAdmin || isHR || isTL },
          { action: 'edit', label: 'Approve swaps', allowed: isAdmin || isHR || isTL },
          { action: 'create', label: 'Request swap', allowed: true },
        ];
      case 'departments':
        return [
          { action: 'view', label: 'View departments', allowed: isAdmin || isHR || isTL },
          { action: 'create', label: 'Create department', allowed: isAdmin || isHR },
          { action: 'edit', label: 'Edit department', allowed: isAdmin || isHR },
          { action: 'delete', label: 'Delete department', allowed: isAdmin || isHR },
        ];
      case 'leave':
        return [
          { action: 'view', label: 'View leave', allowed: true },
          { action: 'create', label: 'Request leave', allowed: true },
          { action: 'edit', label: 'Approve leave', allowed: isAdmin || isHR || isTL },
        ];
      case 'users':
        return [
          { action: 'view', label: 'View users', allowed: isAdmin || isHR },
          { action: 'edit', label: 'Edit roles', allowed: isAdmin || isHR },
          { action: 'manage', label: 'Manage access', allowed: isAdmin || isHR },
        ];
      default:
        return [];
    }
  };

  const permissions = getPermissions();
  const allowedCount = permissions.filter(p => p.allowed).length;

  const content = (
    <div className={cn('flex items-center gap-1', className)}>
      {permissions.map((perm) => {
        const Icon = ACTION_ICONS[perm.action];
        return (
          <div
            key={perm.action}
            className={cn(
              'p-1 rounded',
              perm.allowed 
                ? 'text-green-600 bg-green-500/10' 
                : 'text-muted-foreground/40 bg-muted/30'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        );
      })}
    </div>
  );

  if (!showTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-xs flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Your Permissions ({allowedCount}/{permissions.length})
          </p>
          <div className="space-y-0.5">
            {permissions.map((perm) => (
              <div key={perm.action} className="flex items-center gap-2 text-xs">
                <span className={perm.allowed ? 'text-green-600' : 'text-muted-foreground'}>
                  {perm.allowed ? '✓' : '✗'}
                </span>
                <span className={!perm.allowed ? 'text-muted-foreground' : ''}>
                  {perm.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function RolePermissionBadge({ className }: { className?: string }) {
  const { isAdmin, isHR, isTL } = useAuth();

  const getRoleInfo = () => {
    if (isAdmin) return { label: 'Full Access', color: 'bg-destructive/10 text-destructive border-destructive/30' };
    if (isHR) return { label: 'HR Access', color: 'bg-primary/10 text-primary border-primary/30' };
    if (isTL) return { label: 'TL Access', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' };
    return { label: 'View Only', color: 'bg-muted text-muted-foreground border-border' };
  };

  const { label, color } = getRoleInfo();

  return (
    <Badge variant="outline" className={cn(color, className)}>
      <Shield className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
