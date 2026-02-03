import { useState, useEffect } from 'react';
import { TeamMember, Department, Role, DEPARTMENTS, ROLES, WorkLocation, ShiftAssignment, ShiftType } from '@/types/roster';
import { TeamMemberCard } from './TeamMemberCard';
import { UnifiedMemberCard } from './UnifiedMemberCard';
import { EmployeeIDCard } from './EmployeeIDCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Grid, List, LayoutGrid, Building2, ChevronDown, ChevronUp, Mail, Circle, GripVertical, MapPin, Settings, Sun, Sunset, Moon, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MemberDetailDialog } from './MemberDetailDialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface TeamOverviewProps {
  members: TeamMember[];
  workLocations?: WorkLocation[];
  assignments?: ShiftAssignment[];
  onMemberUpdate?: () => void;
}

const ROLE_COLORS: Record<Role, string> = {
  'Admin': 'bg-destructive/20 text-destructive border-destructive/30',
  'Manager': 'bg-violet-500/20 text-violet-700 border-violet-500/30',
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L3': 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  'L2': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'Trainee': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
};

const ROLE_LABELS: Record<Role, string> = {
  'Admin': 'Administrators',
  'Manager': 'Managers',
  'TL': 'Team Leads',
  'L3': 'Level 3',
  'L2': 'Level 2',
  'L1': 'Level 1',
  'HR': 'HR Team',
  'Trainee': 'Trainees',
};

const STATUS_COLORS: Record<string, string> = {
  'available': 'text-green-500',
  'on-leave': 'text-amber-500',
  'unavailable': 'text-red-500',
};

type ShiftFilter = 'morning' | 'afternoon' | 'night' | 'general' | 'all';

const SHIFT_FILTER_CONFIG: { type: ShiftFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'morning', label: 'Morning', icon: <Sun size={18} />, color: 'bg-amber-500 hover:bg-amber-600' },
  { type: 'afternoon', label: 'Afternoon', icon: <Sunset size={18} />, color: 'bg-sky-500 hover:bg-sky-600' },
  { type: 'night', label: 'Night', icon: <Moon size={18} />, color: 'bg-violet-600 hover:bg-violet-700' },
  { type: 'general', label: 'General', icon: <Clock size={18} />, color: 'bg-emerald-500 hover:bg-emerald-600' },
];

export function TeamOverview({ members, workLocations = [], assignments = [], onMemberUpdate }: TeamOverviewProps) {
  const { isAdmin, isHR, canEditShifts } = useAuth();
  
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'roles' | 'departments' | 'locations'>('grid');
  const [expandedRoles, setExpandedRoles] = useState<Set<Role>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<Department>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [idCardDialogOpen, setIdCardDialogOpen] = useState(false);
  const [idCardMember, setIdCardMember] = useState<TeamMember | null>(null);
  
  // Get today's date for shift filtering
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get today's assignments for shift counts
  const todayAssignments = assignments.filter(a => a.date === today);
  
  // Count members per shift for today
  const shiftCounts: Record<ShiftFilter, number> = {
    morning: todayAssignments.filter(a => a.shiftType === 'morning').length,
    afternoon: todayAssignments.filter(a => a.shiftType === 'afternoon').length,
    night: todayAssignments.filter(a => a.shiftType === 'night').length,
    general: todayAssignments.filter(a => a.shiftType === 'general').length,
    all: members.filter(m => m.status !== 'unavailable').length,
  };
  
  // Get member IDs for today's shift filter
  const getMemberIdsForShift = (shift: ShiftFilter): Set<string> => {
    if (shift === 'all') return new Set(members.map(m => m.id));
    return new Set(todayAssignments.filter(a => a.shiftType === shift).map(a => a.memberId));
  };

  const handleOpenMemberEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setEditDialogOpen(true);
  };

  const handleGenerateIDCard = (member: TeamMember) => {
    setIdCardMember(member);
    setIdCardDialogOpen(true);
  };

  const getLocationName = (locationId?: string) => {
    if (!locationId) return 'Unassigned';
    const loc = workLocations.find(l => l.id === locationId);
    return loc?.name || 'Unknown';
  };

  const handleLocationChange = async (memberId: string, locationId: string | null) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ work_location_id: locationId })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Work location updated');
      onMemberUpdate?.();
    } catch (error) {
      console.error('Error updating work location:', error);
      toast.error('Failed to update work location');
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(search.toLowerCase()) ||
                         member.email.toLowerCase().includes(search.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter;
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesLocation = locationFilter === 'all' || 
                           (locationFilter === 'unassigned' ? !member.workLocationId : member.workLocationId === locationFilter);
    
    // Shift filter - check if member is in today's shift
    const memberIdsForShift = getMemberIdsForShift(shiftFilter);
    const matchesShift = shiftFilter === 'all' || memberIdsForShift.has(member.id);
    
    return matchesSearch && matchesDepartment && matchesRole && matchesLocation && matchesShift;
  });

  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = members.filter(m => m.department === dept).length;
    return acc;
  }, {} as Record<Department, number>);

  const roleCounts = ROLES.reduce((acc, role) => {
    acc[role] = members.filter(m => m.role === role).length;
    return acc;
  }, {} as Record<Role, number>);

  // Group members by role
  const membersByRole = ROLES.reduce((acc, role) => {
    acc[role] = filteredMembers.filter(m => m.role === role);
    return acc;
  }, {} as Record<Role, TeamMember[]>);

  // Group members by department
  const membersByDepartment = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = filteredMembers.filter(m => m.department === dept);
    return acc;
  }, {} as Record<Department, TeamMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const toggleRoleExpand = (role: Role) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedRoles(newExpanded);
  };

  const toggleDeptExpand = (dept: Department) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepts(newExpanded);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const memberId = draggableId;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    // Determine if we're in roles or departments view
    if (viewMode === 'roles') {
      const newRole = destination.droppableId.replace('role-', '') as Role;
      if (!ROLES.includes(newRole)) return;

      try {
        const { error } = await supabase
          .from('team_members')
          .update({ role: newRole })
          .eq('id', memberId);

        if (error) throw error;

        toast.success(`${member.name} moved to ${ROLE_LABELS[newRole]}`);
        onMemberUpdate?.();
      } catch (error) {
        console.error('Error updating role:', error);
        toast.error('Failed to update role');
      }
    } else if (viewMode === 'departments') {
      const newDept = destination.droppableId.replace('dept-', '') as Department;
      if (!DEPARTMENTS.includes(newDept)) return;

      try {
        const { error } = await supabase
          .from('team_members')
          .update({ department: newDept })
          .eq('id', memberId);

        if (error) throw error;

        toast.success(`${member.name} moved to ${newDept}`);
        onMemberUpdate?.();
      } catch (error) {
        console.error('Error updating department:', error);
        toast.error('Failed to update department');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Department Filter Dropdown */}
      <div className="flex items-center gap-3">
        <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
          <SelectTrigger className="w-[200px] bg-card">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map(dept => (
              <SelectItem key={dept} value={dept}>
                {dept} ({departmentCounts[dept]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {departmentFilter !== 'all' && (
          <Badge variant="secondary" className="gap-1">
            {departmentFilter}
            <button 
              onClick={() => setDepartmentFilter('all')}
              className="ml-1 hover:text-destructive"
            >
              ×
            </button>
          </Badge>
        )}
      </div>

      {/* Shift Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* All Shifts Button */}
        <div
          onClick={() => setShiftFilter('all')}
          className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
            shiftFilter === 'all' 
              ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]' 
              : 'bg-card border border-border/50 hover:border-primary/30 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${shiftFilter === 'all' ? 'bg-white/20' : 'bg-muted'}`}>
                <Users size={18} />
              </div>
              <span className="font-semibold">All Shifts</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{shiftCounts.all}</span>
            <span className={`text-sm ${shiftFilter === 'all' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              members
            </span>
          </div>
        </div>
        
        {SHIFT_FILTER_CONFIG.map(shift => {
          const isActive = shiftFilter === shift.type;
          const count = shiftCounts[shift.type];
          
          return (
            <div
              key={shift.type}
              onClick={() => setShiftFilter(isActive ? 'all' : shift.type)}
              className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                isActive 
                  ? `${shift.color} text-white shadow-lg scale-[1.02]` 
                  : 'bg-card border border-border/50 hover:border-primary/30 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-muted'}`}>
                    {shift.icon}
                  </div>
                  <span className="font-semibold">{shift.label}</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{count}</span>
                <span className={`text-sm ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                  members
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Active filter summary */}
      <p className="text-center text-sm text-muted-foreground">
        Showing {filteredMembers.length} of {members.filter(m => m.status !== 'unavailable').length} active team members
        {shiftFilter !== 'all' && ` in ${shiftFilter} shift`}
        {departmentFilter !== 'all' && ` from ${departmentFilter}`}
      </p>

      {/* Search and View Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map(role => (
                <SelectItem key={role} value={role}>{role} ({roleCounts[role]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workLocations.length > 0 && (
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {workLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1 bg-secondary">
            <Button
              variant={viewMode === 'roles' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('roles')}
              title="Group by Role (Drag & Drop)"
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant={viewMode === 'departments' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('departments')}
              title="Group by Department (Drag & Drop)"
            >
              <Building2 size={16} />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid size={16} />
            </Button>
            <Button
              variant={viewMode === 'locations' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('locations')}
              title="Group by Location"
            >
              <MapPin size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Drag & Drop hint */}
      {(viewMode === 'roles' || viewMode === 'departments') && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
          <GripVertical size={16} />
          <span>Drag members between groups to change their {viewMode === 'roles' ? 'role' : 'department'}</span>
        </div>
      )}

      {/* Role-wise Groups View with Drag & Drop */}
      {viewMode === 'roles' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ROLES.map((role) => {
              const roleMembers = membersByRole[role];
              const isExpanded = expandedRoles.has(role);
              
              return (
                <Droppable key={role} droppableId={`role-${role}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`bg-card rounded-xl border overflow-hidden transition-all ${
                        snapshot.isDraggingOver 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-border/50'
                      }`}
                    >
                      <div className={`px-4 py-3 border-b border-border/50 ${ROLE_COLORS[role].replace('text-', 'bg-').split(' ')[0]}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={ROLE_COLORS[role]}>
                              {role}
                            </Badge>
                            <span className="font-semibold">{ROLE_LABELS[role]}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {roleMembers.length} members
                            </Badge>
                            {roleMembers.length > 0 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => toggleRoleExpand(role)}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 min-h-[60px]">
                        {roleMembers.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            Drop members here
                          </div>
                        ) : !isExpanded ? (
                          <div className="flex flex-wrap gap-2">
                            {roleMembers.map((member, index) => (
                              <Draggable key={member.id} draggableId={member.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors cursor-grab ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                    }`}
                                    onClick={() => handleOpenMemberEdit(member)}
                                  >
                                    <GripVertical size={12} className="text-muted-foreground" />
                                    <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                                    <span className="text-sm font-medium">{member.name}</span>
                                    <Settings size={12} className="text-muted-foreground hover:text-foreground" />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {roleMembers.map((member, index) => (
                              <Draggable key={member.id} draggableId={member.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div {...provided.dragHandleProps} className="cursor-grab">
                                        <GripVertical size={16} className="text-muted-foreground" />
                                      </div>
                                      <Avatar className="h-10 w-10">
                                        <AvatarFallback className={`text-sm ${ROLE_COLORS[role]}`}>
                                          {getInitials(member.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenMemberEdit(member);
                                        }}
                                      >
                                        <Settings size={14} />
                                      </Button>
                                      <div>
                                        <p className="font-medium">{member.name}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Mail size={12} />
                                          <span>{member.email}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="text-xs">
                                        {member.department}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenMemberEdit(member);
                                        }}
                                        title="Edit member settings"
                                      >
                                        <Settings size={14} />
                                      </Button>
                                      <div className="flex items-center gap-1.5">
                                        <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                                        <span className={`text-xs capitalize ${STATUS_COLORS[member.status]}`}>
                                          {member.status.replace('-', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Department-wise Groups View with Drag & Drop */}
      {viewMode === 'departments' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEPARTMENTS.map((dept) => {
              const deptMembers = membersByDepartment[dept];
              const isExpanded = expandedDepts.has(dept);
              
              return (
                <Droppable key={dept} droppableId={`dept-${dept}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`bg-card rounded-xl border overflow-hidden transition-all ${
                        snapshot.isDraggingOver 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-border/50'
                      }`}
                    >
                      <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{dept}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {deptMembers.length} members
                            </Badge>
                            {deptMembers.length > 0 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => toggleDeptExpand(dept)}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 min-h-[60px]">
                        {deptMembers.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            Drop members here
                          </div>
                        ) : !isExpanded ? (
                          <div className="flex flex-wrap gap-2">
                            {deptMembers.map((member, index) => (
                              <Draggable key={member.id} draggableId={member.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors cursor-grab ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                    }`}
                                  >
                                    <GripVertical size={12} className="text-muted-foreground" />
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[member.role]}`}>
                                      {member.role}
                                    </Badge>
                                    <span className="text-sm font-medium">{member.name}</span>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {deptMembers.map((member, index) => (
                              <Draggable key={member.id} draggableId={member.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div {...provided.dragHandleProps} className="cursor-grab">
                                        <GripVertical size={16} className="text-muted-foreground" />
                                      </div>
                                      <Avatar className="h-10 w-10">
                                        <AvatarFallback className={`text-sm ${ROLE_COLORS[member.role]}`}>
                                          {getInitials(member.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium">{member.name}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Mail size={12} />
                                          <span>{member.email}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                                        {member.role}
                                      </Badge>
                                      <div className="flex items-center gap-1.5">
                                        <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                                        <span className={`text-xs capitalize ${STATUS_COLORS[member.status]}`}>
                                          {member.status.replace('-', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Team Grid */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member) => {
            const location = workLocations.find(l => l.id === member.workLocationId);
            return (
              <UnifiedMemberCard 
                key={member.id} 
                member={member}
                workLocation={location}
                onEdit={(isAdmin || isHR) ? handleOpenMemberEdit : undefined}
                onGenerateIDCard={handleGenerateIDCard}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>
      )}

      {/* Team List */}
      {viewMode === 'list' && (
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border">
          {filteredMembers.map((member) => {
            const reportingTL = member.reportingTLId 
              ? members.find(m => m.id === member.reportingTLId) 
              : undefined;
            return (
              <TeamMemberCard 
                key={member.id} 
                member={member} 
                reportingTL={reportingTL}
                onEdit={handleOpenMemberEdit}
                compact 
                className="hover:bg-secondary/30"
              />
            );
          })}
        </div>
      )}

      {/* Locations View */}
      {viewMode === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Unassigned */}
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-muted-foreground" />
                  <span className="font-semibold">Unassigned</span>
                </div>
                <Badge variant="secondary">{filteredMembers.filter(m => !m.workLocationId).length}</Badge>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {filteredMembers.filter(m => !m.workLocationId).map((member) => (
                <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50" onClick={() => handleOpenMemberEdit(member)}>
                  <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                  <span className="text-sm font-medium">{member.name}</span>
                </div>
              ))}
              {filteredMembers.filter(m => !m.workLocationId).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No members</p>
              )}
            </div>
          </div>
          {/* By Location */}
          {workLocations.map((location) => {
            const locationMembers = filteredMembers.filter(m => m.workLocationId === location.id);
            return (
              <div key={location.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-primary" />
                      <span className="font-semibold">{location.name}</span>
                    </div>
                    <Badge variant="outline">{locationMembers.length}</Badge>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {locationMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50" onClick={() => handleOpenMemberEdit(member)}>
                      <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                  ))}
                  {locationMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No members</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto text-muted-foreground opacity-50 mb-3" size={48} />
          <p className="text-muted-foreground">No team members found matching your filters</p>
        </div>
      )}

      {/* Member Detail Dialog */}
      <MemberDetailDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        member={selectedMember}
        workLocations={workLocations}
        allMembers={members}
        onUpdate={onMemberUpdate}
      />

      {/* Employee ID Card Dialog */}
      {idCardMember && (
        <EmployeeIDCard
          open={idCardDialogOpen}
          onOpenChange={setIdCardDialogOpen}
          member={idCardMember}
          workLocation={workLocations.find(l => l.id === idCardMember.workLocationId)}
          avatarUrl={idCardMember.avatarUrl}
        />
      )}
    </div>
  );
}