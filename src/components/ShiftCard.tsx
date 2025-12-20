import { ShiftType, TeamMember, SHIFT_DEFINITIONS } from '@/types/roster';
import { ShiftBadge } from './ShiftBadge';
import { TeamMemberCard } from './TeamMemberCard';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface ShiftCardProps {
  type: ShiftType;
  members: TeamMember[];
  date: string;
  className?: string;
}

export function ShiftCard({ type, members, date, className }: ShiftCardProps) {
  const shift = SHIFT_DEFINITIONS.find(s => s.id === type);
  if (!shift) return null;

  return (
    <div className={cn(
      'bg-card rounded-xl border border-border/50 overflow-hidden animate-fade-in',
      className
    )}>
      <div className={cn(
        'px-4 py-3 border-b',
        `border-b-shift-${type}/20`,
        `bg-shift-${type}-light/30`
      )}>
        <div className="flex items-center justify-between">
          <ShiftBadge type={type} showTime />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users size={14} />
            <span>{members.length} assigned</span>
          </div>
        </div>
      </div>
      <div className="p-2 max-h-[300px] overflow-y-auto">
        {members.length > 0 ? (
          <div className="space-y-1">
            {members.map((member) => (
              <TeamMemberCard key={member.id} member={member} compact />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 opacity-50" size={24} />
            <p className="text-sm">No assignments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
