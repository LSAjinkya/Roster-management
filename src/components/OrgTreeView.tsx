import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ChevronDown, ChevronRight, User, Crown, Users, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  onMemberUpdate?: () => void;
}

interface DroppableTreeNodeProps {
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

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

function DroppableTreeNode({ member, children, allMembers, level, onMemberClick }: DroppableTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = children.length > 0;
  const isTL = member.role === 'TL';

  const getChildrenForMember = (memberId: string) => {
    return allMembers.filter(m => m.reporting_tl_id === memberId);
  };

  return (
    <div className="relative">
      {level > 0 && (
        <div className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-border rounded-bl-lg -translate-x-6" />
      )}
      
      {/* Manager node (droppable zone) */}
      <Droppable droppableId={`manager-${member.id}`} type="MEMBER">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
              isTL ? "border-primary/30 bg-primary/5" : "border-border",
              snapshot.isDraggingOver && "ring-2 ring-primary bg-primary/10"
            )}
            onClick={() => onMemberClick?.(member)}
          >
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

            <Avatar className={cn("h-10 w-10", isTL && "ring-2 ring-primary")}>
              <AvatarFallback className={cn(
                "text-sm font-medium",
                isTL ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>

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

            {hasChildren && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {children.length}
              </Badge>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Children (draggable) */}
      {isExpanded && hasChildren && (
        <Droppable droppableId={`children-${member.id}`} type="MEMBER">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "ml-8 mt-2 space-y-2 relative min-h-[20px]",
                snapshot.isDraggingOver && "bg-muted/30 rounded-lg p-2"
              )}
            >
              <div className="absolute left-0 top-0 bottom-4 w-0.5 bg-border -translate-x-2" />
              
              {children.map((child, index) => (
                <Draggable key={child.id} draggableId={child.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={cn(
                        "relative",
                        dragSnapshot.isDragging && "z-50"
                      )}
                    >
                      {/* Connector line */}
                      {!dragSnapshot.isDragging && (
                        <div className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-border rounded-bl-lg -translate-x-6" />
                      )}
                      
                      <div
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                          child.role === 'TL' ? "border-primary/30 bg-primary/5" : "border-border bg-card",
                          dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary"
                        )}
                      >
                        {/* Drag handle */}
                        <div
                          {...dragProvided.dragHandleProps}
                          className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <Avatar className={cn("h-10 w-10", child.role === 'TL' && "ring-2 ring-primary")}>
                          <AvatarFallback className={cn(
                            "text-sm font-medium",
                            child.role === 'TL' ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {getInitials(child.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0" onClick={() => onMemberClick?.(child)}>
                          <div className="flex items-center gap-2">
                            {child.role === 'TL' && <Crown className="h-4 w-4 text-amber-500" />}
                            <span className="font-medium truncate">{child.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", ROLE_COLORS[child.role] || "bg-muted")}
                            >
                              {child.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate">{child.department}</span>
                          </div>
                        </div>

                        {getChildrenForMember(child.id).length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {getChildrenForMember(child.id).length}
                          </Badge>
                        )}
                      </div>

                      {/* Nested children (non-draggable display) */}
                      {getChildrenForMember(child.id).length > 0 && (
                        <div className="ml-8 mt-2 space-y-2 relative">
                          <div className="absolute left-0 top-0 bottom-4 w-0.5 bg-border -translate-x-2" />
                          {getChildrenForMember(child.id).map((grandchild) => (
                            <DroppableTreeNode
                              key={grandchild.id}
                              member={grandchild}
                              children={getChildrenForMember(grandchild.id)}
                              allMembers={allMembers}
                              level={level + 2}
                              onMemberClick={onMemberClick}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}

export function OrgTreeView({ members, onMemberClick, onMemberUpdate }: OrgTreeViewProps) {
  const superAdmin = members.find(m => m.id === 'ajinkya-lawand');
  const teamLeads = members.filter(m => m.role === 'TL' && m.id !== 'ajinkya-lawand');
  
  const getDirectReports = (tlId: string) => {
    return members.filter(m => m.reporting_tl_id === tlId);
  };

  const unassignedMembers = members.filter(
    m => m.role !== 'TL' && !m.reporting_tl_id
  );

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination, source } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const memberId = draggableId;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    // Extract new manager ID from droppable ID
    let newManagerId: string | null = null;
    
    if (destination.droppableId.startsWith('manager-')) {
      newManagerId = destination.droppableId.replace('manager-', '');
    } else if (destination.droppableId.startsWith('children-')) {
      newManagerId = destination.droppableId.replace('children-', '');
    } else if (destination.droppableId === 'unassigned') {
      newManagerId = null;
    }

    // Don't allow assigning to self
    if (newManagerId === memberId) {
      toast.error("Cannot assign member to themselves");
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ reporting_tl_id: newManagerId })
        .eq('id', memberId);

      if (error) throw error;

      const newManager = newManagerId ? members.find(m => m.id === newManagerId) : null;
      toast.success(`${member.name} reassigned to ${newManager ? newManager.name : 'Unassigned'}`);
      onMemberUpdate?.();
    } catch (error) {
      console.error('Error reassigning member:', error);
      toast.error('Failed to reassign member');
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Super Admin tree */}
        {superAdmin && (
          <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
            <DroppableTreeNode
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
                <DroppableTreeNode
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

        {/* Unassigned members (droppable zone) */}
        <Droppable droppableId="unassigned" type="MEMBER">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "mt-6 p-4 rounded-xl border-2 border-dashed transition-colors",
                snapshot.isDraggingOver 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Unassigned Members
                </h3>
                <Badge variant="outline">{unassignedMembers.length}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">Drop here to unassign</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 min-h-[60px]">
                {unassignedMembers.map((member, index) => (
                  <Draggable key={member.id} draggableId={member.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border border-dashed border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors",
                          dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary"
                        )}
                        onClick={() => onMemberClick?.(member)}
                      >
                        <div
                          {...dragProvided.dragHandleProps}
                          className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
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
                    )}
                  </Draggable>
                ))}
                {unassignedMembers.length === 0 && !snapshot.isDraggingOver && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                    All members are assigned to managers
                  </p>
                )}
              </div>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}
