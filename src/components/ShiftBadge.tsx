import { ShiftType, SHIFT_DEFINITIONS } from '@/types/roster';
import { cn } from '@/lib/utils';
import { Sun, Sunset, Moon, Clock } from 'lucide-react';

interface ShiftBadgeProps {
  type: ShiftType;
  showTime?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const shiftIcons = {
  morning: Sun,
  afternoon: Sunset,
  night: Moon,
  general: Clock,
};

export function ShiftBadge({ type, showTime = false, size = 'md', className }: ShiftBadgeProps) {
  const shift = SHIFT_DEFINITIONS.find(s => s.id === type);
  if (!shift) return null;

  const Icon = shiftIcons[type];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        shift.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      <span>{shift.name}</span>
      {showTime && (
        <span className="opacity-75 ml-1">
          {shift.startTime} - {shift.endTime}
        </span>
      )}
    </span>
  );
}
