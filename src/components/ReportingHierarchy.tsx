import { useState, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, UserCog, Users, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reporting_tl_id: string | null;
}

interface ReportingHierarchyProps {
  members: TeamMember[];
  onUpdate: () => void;
  canManage?: boolean;
}

export function ReportingHierarchy({ members, onUpdate, canManage = false }: ReportingHierarchyProps) {
  const [expandedTLs, setExpandedTLs] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkTL, setBulkTL] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);
  const [individualReassign, setIndividualReassign] = useState<string | null>(null);
  const [draggedMember, setDraggedMember] = useState<TeamMember | null>(null);
  const [dragOverTL, setDragOverTL] = useState<string | null>(null);

  // Get all TLs
  const teamLeads = members.filter(m => m.role === 'TL');
  
  // Group members by their reporting TL
  const membersByTL = members.reduce((acc, member) => {
    if (member.role === 'TL') return acc;
    const tlId = member.reporting_tl_id || 'unassigned';
    if (!acc[tlId]) {
      acc[tlId] = [];
    }
    acc[tlId].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const toggleTL = (tlId: string) => {
    const newExpanded = new Set(expandedTLs);
    if (newExpanded.has(tlId)) {
      newExpanded.delete(tlId);
    } else {
      newExpanded.add(tlId);
    }
    setExpandedTLs(newExpanded);
  };

  const toggleMemberSelection = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const selectAllUnder = (tlId: string) => {
    const membersUnderTL = membersByTL[tlId] || [];
    const newSelected = new Set(selectedMembers);
    membersUnderTL.forEach(m => newSelected.add(m.id));
    setSelectedMembers(newSelected);
  };

  const handleBulkReassign = async () => {
    if (!bulkTL || selectedMembers.size === 0) {
      toast.error('Select members and a Team Lead');
      return;
    }

    setReassigning(true);
    try {
      const memberIds = Array.from(selectedMembers);
      const { error } = await supabase
        .from('team_members')
        .update({ reporting_tl_id: bulkTL === 'none' ? null : bulkTL })
        .in('id', memberIds);

      if (error) throw error;

      toast.success(`${memberIds.length} member(s) reassigned successfully`);
      setSelectedMembers(new Set());
      setBulkTL('');
      onUpdate();
    } catch (error) {
      console.error('Bulk reassign error:', error);
      toast.error('Failed to reassign members');
    } finally {
      setReassigning(false);
    }
  };

  const handleIndividualReassign = async (memberId: string, newTLId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ reporting_tl_id: newTLId === 'none' ? null : newTLId })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Reporting TL updated');
      setIndividualReassign(null);
      onUpdate();
    } catch (error) {
      console.error('Reassign error:', error);
      toast.error('Failed to update reporting TL');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, member: TeamMember) => {
    if (!canManage) return;
    setDraggedMember(member);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', member.id);
  };

  const handleDragEnd = () => {
    setDraggedMember(null);
    setDragOverTL(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, tlId: string) => {
    if (!canManage || !draggedMember) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTL(tlId);
  };

  const handleDragLeave = () => {
    setDragOverTL(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, tlId: string) => {
    e.preventDefault();
    if (!canManage || !draggedMember) return;
    
    // Don't do anything if dropping on the same TL
    if (draggedMember.reporting_tl_id === tlId || 
        (!draggedMember.reporting_tl_id && tlId === 'unassigned')) {
      setDraggedMember(null);
      setDragOverTL(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ reporting_tl_id: tlId === 'unassigned' ? null : tlId })
        .eq('id', draggedMember.id);

      if (error) throw error;

      const tlName = tlId === 'unassigned' ? 'Unassigned' : teamLeads.find(t => t.id === tlId)?.name;
      toast.success(`${draggedMember.name} moved to ${tlName}`);
      onUpdate();
    } catch (error) {
      console.error('Drop reassign error:', error);
      toast.error('Failed to reassign member');
    } finally {
      setDraggedMember(null);
      setDragOverTL(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderMemberRow = (member: TeamMember) => (
    <div
      key={member.id}
      draggable={canManage}
      onDragStart={(e) => handleDragStart(e, member)}
      onDragEnd={handleDragEnd}
      className={cn(
        "flex items-center justify-between py-2 px-2 hover:bg-muted/30 rounded-md transition-all",
        canManage && "cursor-grab active:cursor-grabbing",
        draggedMember?.id === member.id && "opacity-50 bg-muted"
      )}
    >
      <div className="flex items-center gap-3">
        {canManage && (
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        )}
        <Checkbox
          checked={selectedMembers.has(member.id)}
          onCheckedChange={() => toggleMemberSelection(member.id)}
        />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{member.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{member.role}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{member.department}</span>
          </div>
        </div>
      </div>
      
      {canManage && (
        individualReassign === member.id ? (
          <div className="flex items-center gap-2">
            <Select onValueChange={(value) => handleIndividualReassign(member.id, value)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Select TL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamLeads.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIndividualReassign(null)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setIndividualReassign(member.id)}
          >
            <UserCog className="h-3 w-3 mr-1" />
            Reassign
          </Button>
        )
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Drag hint */}
      {canManage && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg flex items-center gap-2">
          <GripVertical className="h-4 w-4" />
          <span>Drag and drop team members between Team Leads to reassign them</span>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedMembers.size > 0 && canManage && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                {selectedMembers.size} selected
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Reassign to:</span>
                <Select value={bulkTL} onValueChange={setBulkTL}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Team Lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No TL (Unassigned)</SelectItem>
                    {teamLeads.map(tl => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleBulkReassign} 
                  disabled={!bulkTL || reassigning}
                  size="sm"
                >
                  {reassigning ? 'Reassigning...' : 'Reassign'}
                </Button>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedMembers(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hierarchy by TL */}
      <div className="space-y-3">
        {teamLeads.map(tl => {
          const reportingMembers = membersByTL[tl.id] || [];
          const isExpanded = expandedTLs.has(tl.id);
          const isDropTarget = dragOverTL === tl.id;

          return (
            <Collapsible key={tl.id} open={isExpanded} onOpenChange={() => toggleTL(tl.id)}>
              <Card 
                className={cn(
                  "transition-all",
                  isDropTarget && "ring-2 ring-primary border-primary bg-primary/5"
                )}
                onDragOver={(e) => handleDragOver(e, tl.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tl.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(tl.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {tl.name}
                            <Badge variant="secondary" className="text-xs">TL</Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{tl.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {reportingMembers.length} reports
                        </Badge>
                        {reportingMembers.length > 0 && canManage && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllUnder(tl.id);
                            }}
                          >
                            Select All
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {reportingMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
                        {isDropTarget ? 'Drop here to assign' : 'No direct reports - drag members here'}
                      </p>
                    ) : (
                      <div className="divide-y">
                        {reportingMembers
                          .sort((a, b) => a.department.localeCompare(b.department))
                          .map(member => renderMemberRow(member))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {/* Unassigned Members */}
        <Collapsible open={expandedTLs.has('unassigned')} onOpenChange={() => toggleTL('unassigned')}>
          <Card 
            className={cn(
              "border-dashed transition-all",
              dragOverTL === 'unassigned' && "ring-2 ring-amber-500 border-amber-500 bg-amber-500/5"
            )}
            onDragOver={(e) => handleDragOver(e, 'unassigned')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'unassigned')}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedTLs.has('unassigned') ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-muted">?</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-base text-muted-foreground">Unassigned Members</CardTitle>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {membersByTL['unassigned']?.length || 0}
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0">
                {!membersByTL['unassigned']?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
                    No unassigned members
                  </p>
                ) : (
                  <div className="divide-y">
                    {membersByTL['unassigned'].map(member => renderMemberRow(member))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
