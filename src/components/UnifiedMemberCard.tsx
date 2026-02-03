import { useState } from 'react';
import { TeamMember, WorkLocation } from '@/types/roster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Settings, 
  IdCard,
  Circle,
} from 'lucide-react';

interface UnifiedMemberCardProps {
  member: TeamMember & { phoneNumber?: string; avatarUrl?: string };
  workLocation?: WorkLocation;
  onEdit?: (member: TeamMember) => void;
  onGenerateIDCard?: (member: TeamMember) => void;
  isAdmin?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  'Admin': 'bg-destructive/20 text-destructive border-destructive/30',
  'Manager': 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L3': 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  'L2': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'Trainee': 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

export function UnifiedMemberCard({ 
  member, 
  workLocation, 
  onEdit, 
  onGenerateIDCard,
  isAdmin = false,
}: UnifiedMemberCardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOnline = member.status === 'available';
  const locationName = workLocation?.name || 'Not Assigned';

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/20">
      <CardContent className="p-5">
        <div className="flex flex-col items-center text-center">
          {/* Avatar with Status */}
          <div className="relative mb-4">
            <Avatar className="h-20 w-20 ring-2 ring-offset-2 ring-offset-background ring-border">
              {member.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt={member.name} />
              ) : null}
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            {/* Status Indicator */}
            <div 
              className={cn(
                "absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-card flex items-center justify-center",
                isOnline ? 'bg-green-500' : 'bg-red-500'
              )}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>

          {/* Name */}
          <h3 className="font-semibold text-lg text-foreground mb-1">{member.name}</h3>

          {/* Role Badge */}
          <Badge 
            variant="outline" 
            className={cn("mb-2", ROLE_COLORS[member.role] || 'bg-muted text-muted-foreground')}
          >
            {member.role}
          </Badge>

          {/* Department */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Building2 size={14} />
            <span>{member.department}</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 text-sm mb-3">
            <Circle size={8} className={cn("fill-current", isOnline ? 'text-green-500' : 'text-red-500')} />
            <span className={cn("font-medium", isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Details Grid */}
          <div className="w-full space-y-2 pt-3 border-t border-border/50">
            {/* Email */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={14} className="shrink-0" />
              <span className="truncate" title={member.email}>{member.email}</span>
            </div>

            {/* Phone */}
            {member.phoneNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} className="shrink-0" />
                <span>{member.phoneNumber}</span>
              </div>
            )}

            {/* Work Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate" title={locationName}>{locationName}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-border/50 w-full">
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => onEdit(member)}
              >
                <Settings size={14} className="mr-1.5" />
                Edit
              </Button>
            )}
            {isAdmin && onGenerateIDCard && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => onGenerateIDCard(member)}
              >
                <IdCard size={14} className="mr-1.5" />
                ID Card
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
