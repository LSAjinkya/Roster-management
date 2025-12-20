import { Role } from '@/types/roster';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleStyles: Record<Role, string> = {
  TL: 'bg-primary/10 text-primary border-primary/20',
  L2: 'bg-shift-afternoon-light text-shift-afternoon border-shift-afternoon/20',
  L1: 'bg-shift-general-light text-shift-general border-shift-general/20',
  HR: 'bg-pink-100 text-pink-700 border-pink-200',
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
