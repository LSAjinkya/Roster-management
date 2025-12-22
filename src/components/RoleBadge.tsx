import { Role } from '@/types/roster';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleStyles: Record<Role, string> = {
  Admin: 'bg-destructive/10 text-destructive border-destructive/20',
  Manager: 'bg-violet-100 text-violet-700 border-violet-200',
  TL: 'bg-primary/10 text-primary border-primary/20',
  L3: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  L2: 'bg-shift-afternoon-light text-shift-afternoon border-shift-afternoon/20',
  L1: 'bg-shift-general-light text-shift-general border-shift-general/20',
  HR: 'bg-pink-100 text-pink-700 border-pink-200',
  Trainee: 'bg-amber-100 text-amber-700 border-amber-200',
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border',
        roleStyles[role],
        className
      )}
    >
      {role}
    </span>
  );
}
