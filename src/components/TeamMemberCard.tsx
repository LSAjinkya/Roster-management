import { TeamMember } from '@/types/roster';
import { RoleBadge } from './RoleBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserCheck, Settings } from 'lucide-react';

interface TeamMemberCardProps {
  member: TeamMember;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
  reportingTL?: TeamMember;
  onEdit?: (member: TeamMember) => void;
}

export function TeamMemberCard({ member, compact = false, className, style, reportingTL, onEdit }: TeamMemberCardProps) {
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const statusColors = {
    available: 'bg-status-available',
    'on-leave': 'bg-status-leave',
    unavailable: 'bg-status-unavailable',
  };

  if (compact) {
    return (
      <div style={style} className={cn('flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors', className)}>
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card',
            statusColors[member.status]
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.department}</p>
        </div>
        <RoleBadge role={member.role} />
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onEdit(member)}
          >
            <Settings size={14} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div 
      style={style}
      className={cn(
        'bg-card p-4 rounded-xl border border-border/50 hover:border-primary/20 hover:shadow-soft transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
            statusColors[member.status]
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold truncate">{member.name}</p>
            <RoleBadge role={member.role} />
          </div>
          <p className="text-sm text-muted-foreground">{member.department}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{member.email}</p>
        </div>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onEdit(member)}
          >
            <Settings size={16} />
          </Button>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className={cn(
            'font-medium capitalize',
            member.status === 'available' && 'text-status-available',
            member.status === 'on-leave' && 'text-status-leave',
            member.status === 'unavailable' && 'text-status-unavailable'
          )}>
            {member.status.replace('-', ' ')}
          </span>
        </div>
        {reportingTL && member.role !== 'TL' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <UserCheck size={14} />
              Reporting TL
            </span>
            <span className="font-medium text-primary truncate max-w-[120px]">
              {reportingTL.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
