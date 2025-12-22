import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Crown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reporting_tl_id: string | null;
}

interface OrgTreeViewProps {
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
}

interface TreeNodeProps {
  member: TeamMember;
  children: TeamMember[];
  allMembers: TeamMember[];
  level: number;
  onMemberClick?: (member: TeamMember) => void;
}

const ROLE_COLORS: Record<string, string> = {
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L1': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'L2': 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  'L3': 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'Admin': 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'Manager': 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  'Trainee': 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
};

function TreeNode({ member, children, allMembers, level, onMemberClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = children.length > 0;
  const isTL = member.role === 'TL';

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get children for each child member
  const getChildrenForMember = (memberId: string) => {
    return allMembers.filter(m => m.reporting_tl_id === memberId);
  };

  return (
    <div className="relative">
      {/* Connector line from parent */}
      {level > 0 && (
        <div className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-border rounded-bl-lg -translate-x-6" />
      )}
      
      {/* Node content */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
          "hover:bg-muted/50 border",
          isTL ? "border-primary/30 bg-primary/5" : "border-border"
        )}
        onClick={() => onMemberClick?.(member)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Avatar */}
        <Avatar className={cn("h-10 w-10", isTL && "ring-2 ring-primary")}>
          <AvatarFallback className={cn(
            "text-sm font-medium",
            isTL ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>

        {/* Member info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isTL && <Crown className="h-4 w-4 text-amber-500" />}
            <span className="font-medium truncate">{member.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge 
              variant="outline" 
              className={cn("text-xs", ROLE_COLORS[member.role] || "bg-muted")}
            >
              {member.role}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">{member.department}</span>
          </div>
        </div>

        {/* Children count */}
        {hasChildren && (
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {children.length}
          </Badge>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="ml-8 mt-2 space-y-2 relative">
          {/* Vertical connecting line */}
          <div className="absolute left-0 top-0 bottom-4 w-0.5 bg-border -translate-x-2" />
          
          {children.map((child, index) => (
            <TreeNode
              key={child.id}
              member={child}
              children={getChildrenForMember(child.id)}
              allMembers={allMembers}
              level={level + 1}
              onMemberClick={onMemberClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgTreeView({ members, onMemberClick }: OrgTreeViewProps) {
  // Find root nodes (TLs without a reporting TL, or special super admin)
  const superAdmin = members.find(m => m.id === 'ajinkya-lawand');
  const teamLeads = members.filter(m => m.role === 'TL' && m.id !== 'ajinkya-lawand');
  
  // Get direct reports for each TL
  const getDirectReports = (tlId: string) => {
    return members.filter(m => m.reporting_tl_id === tlId);
  };

  // Members without TL assignment (orphans)
  const unassignedMembers = members.filter(
    m => m.role !== 'TL' && !m.reporting_tl_id
  );

  return (
    <div className="space-y-4">
      {/* Super Admin tree */}
      {superAdmin && (
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
          <TreeNode
            member={superAdmin}
            children={teamLeads.filter(tl => tl.reporting_tl_id === superAdmin.id || !tl.reporting_tl_id)}
            allMembers={members}
            level={0}
            onMemberClick={onMemberClick}
          />
        </div>
      )}

      {/* Team Leads not under super admin */}
      {!superAdmin && teamLeads.length > 0 && (
        <div className="space-y-3">
          {teamLeads.map(tl => (
            <div key={tl.id} className="p-4 rounded-xl border bg-card">
              <TreeNode
                member={tl}
                children={getDirectReports(tl.id)}
                allMembers={members}
                level={0}
                onMemberClick={onMemberClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* Unassigned members */}
      {unassignedMembers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Unassigned Members</h3>
            <Badge variant="outline">{unassignedMembers.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {unassignedMembers.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onMemberClick?.(member)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.department}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
