import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Shield, UserCog, LogIn, Upload, Clock, Filter, Search, FileUp, Users, UserCheck, Trash2, Plus, Link2, Unlink, RefreshCw, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { MemberDetailDialog } from '@/components/MemberDetailDialog';
import { TeamMember as FullTeamMember, WorkLocation, Role as RosterRole, Department as RosterDepartment } from '@/types/roster';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { DEPARTMENTS, Department, ROLES, Role, TEAM_GROUPS, TeamGroup } from '@/types/roster';
import { BulkTeamAssignment } from '@/components/BulkTeamAssignment';

type AppRole = 'admin' | 'hr' | 'tl' | 'member';
type UserStatus = 'available' | 'on-leave' | 'unavailable';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  status: UserStatus;
  roles: AppRole[];
  is_active: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  team: string | null;
  status: string;
  reporting_tl_id: string | null;
  isInitialized?: boolean;
}

interface StatusHistoryLog {
  id: string;
  user_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  user_name?: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  hr: 'HR',
  tl: 'Team Lead',
  member: 'Member',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  hr: 'bg-primary text-primary-foreground',
  tl: 'bg-secondary text-secondary-foreground',
  member: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  available: 'Available',
  'on-leave': 'On Leave',
  unavailable: 'Unavailable',
};

const STATUS_COLORS: Record<UserStatus, string> = {
  available: 'bg-green-500/20 text-green-700 border-green-500/30',
  'on-leave': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  unavailable: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const TEAM_ROLE_COLORS: Record<string, string> = {
  'Admin': 'bg-destructive/20 text-destructive border-destructive/30',
  'Manager': 'bg-violet-500/20 text-violet-700 border-violet-500/30',
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L3': 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  'L2': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'Trainee': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
};

export default function RoleManagement() {
  const { isAdmin, isHR, loading: authLoading, user, roles } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryLog[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(true);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [importing, setImporting] = useState(false);
  const [accessFilter, setAccessFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState<string>('all');
  const [teamRoleFilter, setTeamRoleFilter] = useState<string>('all');
  const [teamInitFilter, setTeamInitFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    id: '',
    name: '',
    email: '',
    department: DEPARTMENTS[0] as string,
    role: 'L1' as string,
  });
  const [addingMember, setAddingMember] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linkingUser, setLinkingUser] = useState<string | null>(null);
  const [initializingAll, setInitializingAll] = useState(false);
  
  // Member detail dialog state
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<FullTeamMember | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);

  const canAccess = isAdmin || isHR;

  useEffect(() => {
    if (!authLoading && roles.length >= 0 && user) {
      if (!canAccess) {
        toast.error('Access denied. Admin or HR only.');
        navigate('/');
      }
    }
  }, [authLoading, canAccess, navigate, roles, user]);

  useEffect(() => {
    if (canAccess) {
      fetchUsers();
      fetchTeamMembers();
      fetchStatusHistory();
      fetchWorkLocations();
    }
  }, [canAccess]);

  const fetchWorkLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const locations: WorkLocation[] = (data || []).map(loc => ({
        id: loc.id,
        name: loc.name,
        code: loc.code,
        address: loc.address,
        min_night_shift_count: loc.min_night_shift_count,
        work_from_home_if_below_min: loc.work_from_home_if_below_min,
        is_active: loc.is_active,
        location_type: loc.location_type as WorkLocation['location_type'],
        city: loc.city || undefined,
      }));
      setWorkLocations(locations);
    } catch (error) {
      console.error('Error fetching work locations:', error);
    }
  };

  const handleOpenMemberDetail = (member: TeamMember) => {
    const fullMember: FullTeamMember = {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role as RosterRole,
      department: member.department as RosterDepartment,
      team: member.team as FullTeamMember['team'],
      status: (member.status as 'available' | 'on-leave' | 'unavailable') || 'available',
      reportingTLId: member.reporting_tl_id || undefined,
      weekOffEntitlement: 2,
      isHybrid: false,
      hybridOfficeDays: 5,
      hybridWfhDays: 0,
    };
    setSelectedMemberDetail(fullMember);
    setMemberDetailOpen(true);
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, department, status, is_active')
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        department: profile.department,
        status: (profile.status as UserStatus) || 'available',
        is_active: profile.is_active ?? true,
        roles: (allRoles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role, department, team, status, reporting_tl_id')
        .order('name');

      if (error) throw error;

      // Fetch rotation states to determine initialization status
      const { data: rotationStates } = await supabase
        .from('member_rotation_state')
        .select('member_id');

      const initializedMemberIds = new Set((rotationStates || []).map(rs => rs.member_id));

      const membersWithInitStatus = (data || []).map(member => ({
        ...member,
        isInitialized: initializedMemberIds.has(member.id),
      }));

      setTeamMembers(membersWithInitStatus);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const handleAccessToggle = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(isActive ? 'User access enabled' : 'User access disabled');
      fetchUsers();
    } catch (error) {
      console.error('Error updating user access:', error);
      toast.error('Failed to update user access');
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const { data: history, error: historyError } = await supabase
        .from('status_history')
        .select('id, user_id, old_status, new_status, changed_at')
        .order('changed_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      const userIds = [...new Set((history || []).map(h => h.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      const historyWithNames: StatusHistoryLog[] = (history || []).map(h => ({
        ...h,
        user_name: profileMap.get(h.user_id) || 'Unknown',
      }));

      setStatusHistory(historyWithNames);
    } catch (error) {
      console.error('Error fetching status history:', error);
    } finally {
      setStatusHistoryLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === '' || 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAccess = 
      accessFilter === 'all' || 
      (accessFilter === 'active' && u.is_active) || 
      (accessFilter === 'disabled' && !u.is_active);
    
    return matchesSearch && matchesAccess;
  });

  const filteredTeamMembers = teamMembers.filter(m => {
    const matchesSearch = teamSearchQuery === '' || 
      m.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(teamSearchQuery.toLowerCase());
    
    const matchesDept = teamDeptFilter === 'all' || m.department === teamDeptFilter;
    const matchesRole = teamRoleFilter === 'all' || m.role === teamRoleFilter;
    const matchesInit = teamInitFilter === 'all' || 
      (teamInitFilter === 'initialized' && m.isInitialized) ||
      (teamInitFilter === 'not-initialized' && !m.isInitialized);
    
    return matchesSearch && matchesDept && matchesRole && matchesInit;
  });

  const initializedCount = teamMembers.filter(m => m.isInitialized).length;
  const notInitializedCount = teamMembers.length - initializedCount;
  const uninitializedMembers = teamMembers.filter(m => !m.isInitialized);

  const SHIFT_TYPES = ['morning', 'afternoon', 'night'] as const;

  const handleInitializeAll = async () => {
    if (uninitializedMembers.length === 0) {
      toast.info('All members are already initialized');
      return;
    }

    setInitializingAll(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = uninitializedMembers.map((member, index) => ({
        member_id: member.id,
        current_shift_type: SHIFT_TYPES[index % SHIFT_TYPES.length],
        cycle_start_date: today,
      }));

      const { error } = await supabase
        .from('member_rotation_state')
        .insert(records);

      if (error) throw error;

      toast.success(`Initialized ${uninitializedMembers.length} members`);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error initializing members:', error);
      toast.error('Failed to initialize members');
    } finally {
      setInitializingAll(false);
    }
  };

  const handleDeleteMemberClick = (member: TeamMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) throw error;

      toast.success(`${memberToDelete.name} has been removed`);
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast.error('Failed to delete team member');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.id.trim() || !newMember.name.trim() || !newMember.email.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMember.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setAddingMember(true);
    try {
      // Check if ID already exists
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', newMember.id)
        .maybeSingle();

      if (existing) {
        toast.error('A team member with this ID already exists');
        setAddingMember(false);
        return;
      }

      const { error } = await supabase
        .from('team_members')
        .insert({
          id: newMember.id.trim(),
          name: newMember.name.trim(),
          email: newMember.email.trim().toLowerCase(),
          department: newMember.department,
          role: newMember.role,
          status: 'available',
        });

      if (error) throw error;

      toast.success(`${newMember.name} has been added`);
      setAddMemberDialogOpen(false);
      setNewMember({
        id: '',
        name: '',
        email: '',
        department: DEPARTMENTS[0] as string,
        role: 'L1',
      });
      fetchTeamMembers();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error('Failed to add team member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableUsers = filteredUsers.filter(u => u.id !== user?.id);
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkAction = async (action: 'enable' | 'disable') => {
    if (selectedUsers.size === 0) {
      toast.error('No users selected');
      return;
    }

    setBulkActionLoading(true);
    try {
      const isActive = action === 'enable';
      const userIds = Array.from(selectedUsers);

      for (const userId of userIds) {
        await supabase
          .from('profiles')
          .update({ is_active: isActive })
          .eq('user_id', userId);
      }

      toast.success(`${userIds.length} user(s) ${action}d successfully`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error(`Failed to ${action} users`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleRoleToggle = async (userId: string, role: AppRole, isAdding: boolean) => {
    try {
      if (isAdding) {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: role });
        if (error) {
          if (error.code === '23505') {
            toast.error('User already has this role');
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      }

      toast.success(isAdding ? 'Role added' : 'Role removed');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDepartmentChange = async (userId: string, department: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department: department === 'none' ? null : department })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Department updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Failed to update department');
    }
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Status updated successfully');
      fetchUsers();
      fetchStatusHistory();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  // Team member handlers
  const handleTeamMemberRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Team member role updated');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team member role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleTeamMemberDepartmentChange = async (memberId: string, department: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ department })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Team member department updated');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team member department:', error);
      toast.error('Failed to update department');
    }
  };

  const handleTeamMemberStatusChange = async (memberId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Team member status updated');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team member status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleTeamMemberTeamChange = async (memberId: string, team: string | null) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ team: team === 'none' ? null : team })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Team assignment updated');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error('Failed to update team');
    }
  };

  // Sync functions for linking users with team members
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      let linkedCount = 0;
      
      for (const userProfile of users) {
        const matchingMember = teamMembers.find(
          m => m.email.toLowerCase() === userProfile.email.toLowerCase()
        );
        
        if (matchingMember) {
          await supabase
            .from('profiles')
            .update({ 
              team_member_id: matchingMember.id,
              department: matchingMember.department 
            })
            .eq('user_id', userProfile.id);
          
          linkedCount++;
        }
      }
      
      toast.success(`Synced ${linkedCount} user(s) with team members`);
      fetchUsers();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync users');
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkUserToMember = async (userId: string, memberId: string | null) => {
    setLinkingUser(userId);
    try {
      const member = memberId ? teamMembers.find(m => m.id === memberId) : null;
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          team_member_id: memberId,
          department: member?.department || null
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(memberId ? 'User linked to team member' : 'User unlinked');
      fetchUsers();
    } catch (error) {
      console.error('Error linking user:', error);
      toast.error('Failed to update link');
    } finally {
      setLinkingUser(null);
    }
  };

  const getSyncedUsersCount = () => {
    return users.filter(u => {
      const matchingMember = teamMembers.find(
        m => m.email.toLowerCase() === u.email.toLowerCase()
      );
      return !!matchingMember;
    }).length;
  };

  const getSyncedUsers = () => {
    return users.map(u => {
      const matchingMember = teamMembers.find(
        m => m.email.toLowerCase() === u.email.toLowerCase()
      );
      return { ...u, linkedMember: matchingMember || null };
    });
  };

  const handleCsvImport = async () => {
    if (!csvData.trim()) {
      toast.error('Please enter CSV data');
      return;
    }

    setImporting(true);
    try {
      const lines = csvData.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const nameIdx = headers.indexOf('name');
      const emailIdx = headers.indexOf('email');
      const deptIdx = headers.indexOf('department');

      if (nameIdx === -1 || emailIdx === -1) {
        throw new Error('CSV must have "name" and "email" columns');
      }

      let imported = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const name = values[nameIdx];
        const email = values[emailIdx];
        const department = deptIdx !== -1 ? values[deptIdx] : null;

        if (!name || !email) continue;

        const { data: existing } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              full_name: name, 
              department: department && DEPARTMENTS.includes(department as Department) ? department : null 
            })
            .eq('email', email);

          if (error) {
            errors++;
          } else {
            imported++;
          }
        }
      }

      toast.success(`Imported ${imported} users. ${errors > 0 ? `${errors} errors.` : ''}`);
      setCsvImportOpen(false);
      setCsvData('');
      fetchUsers();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import users');
    } finally {
      setImporting(false);
    }
  };

  const handleImpersonateClick = (user: UserWithRoles) => {
    setSelectedUser(user);
    setImpersonateDialogOpen(true);
  };

  const handleImpersonate = async () => {
    if (!selectedUser) return;
    
    setImpersonating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const adminInfo = users.find(u => u.id === user?.id);
      const impersonationData = {
        adminEmail: user?.email || '',
        adminName: adminInfo?.full_name || user?.email || '',
        impersonatedEmail: selectedUser.email,
        impersonatedName: selectedUser.full_name,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('impersonation_session', JSON.stringify(impersonationData));

      const response = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: selectedUser.id },
      });

      if (response.error) {
        localStorage.removeItem('impersonation_session');
        throw new Error(response.error.message || 'Impersonation failed');
      }

      const { access_token, refresh_token } = response.data;

      await supabase.auth.signOut();
      
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) {
        localStorage.removeItem('impersonation_session');
        throw setSessionError;
      }

      toast.success(`Now logged in as ${selectedUser.full_name}`);
      setImpersonateDialogOpen(false);
      navigate('/');
      window.location.reload();
    } catch (error: any) {
      console.error('Impersonation error:', error);
      toast.error(error.message || 'Failed to impersonate user');
    } finally {
      setImpersonating(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Users & Roles</h1>
            <p className="text-muted-foreground">Manage user access, departments, and roles</p>
          </div>
        </div>
        <Button onClick={() => setCsvImportOpen(true)} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Auth Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{initializedCount}</p>
                <p className="text-xs text-muted-foreground">Initialized</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{notInitializedCount}</p>
                <p className="text-xs text-muted-foreground">Not Initialized</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-2xl font-bold">{[...new Set(teamMembers.map(m => m.department))].length}</p>
              <p className="text-xs text-muted-foreground">Departments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team-members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team-members" className="gap-2">
            <Users className="h-4 w-4" />
            Team Members ({teamMembers.length})
          </TabsTrigger>
          <TabsTrigger value="auth-users" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Auth Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Link2 className="h-4 w-4" />
            Sync ({getSyncedUsersCount()}/{users.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            Status History
          </TabsTrigger>
        </TabsList>

        {/* Team Members Tab */}
        <TabsContent value="team-members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Team Members
                  </CardTitle>
                  <CardDescription>
                    Manage department and role assignments for all team members
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={teamDeptFilter} onValueChange={setTeamDeptFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={teamRoleFilter} onValueChange={setTeamRoleFilter}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {ROLES.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={teamInitFilter} onValueChange={setTeamInitFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="initialized">Initialized</SelectItem>
                      <SelectItem value="not-initialized">Not Initialized</SelectItem>
                    </SelectContent>
                  </Select>
                  {notInitializedCount > 0 && (
                    <Button 
                      onClick={handleInitializeAll} 
                      disabled={initializingAll}
                      variant="outline"
                      className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                    >
                      {initializingAll ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Initialize All ({notInitializedCount})
                    </Button>
                  )}
                  <BulkTeamAssignment 
                    teamMembers={teamMembers.map(m => ({ 
                      id: m.id, 
                      name: m.name, 
                      email: m.email, 
                      department: m.department, 
                      role: m.role, 
                      team: m.team 
                    }))} 
                    onComplete={fetchTeamMembers} 
                  />
                  <Button onClick={() => setAddMemberDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {teamMembersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Initialized</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{member.email}</TableCell>
                        <TableCell>
                          <Select
                            value={member.department}
                            onValueChange={(value) => handleTeamMemberDepartmentChange(member.id, value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.team || 'none'}
                            onValueChange={(value) => handleTeamMemberTeamChange(member.id, value === 'none' ? null : value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="Select team">
                                <span className={
                                  member.team === 'Alpha' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                                  member.team === 'Gamma' ? 'text-green-700 dark:text-green-400 font-medium' :
                                  member.team === 'Beta' ? 'text-orange-700 dark:text-orange-400 font-medium' :
                                  'text-muted-foreground'
                                }>
                                  {member.team || 'None'}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover border shadow-md">
                              <SelectItem value="none" className="text-muted-foreground">
                                No Team
                              </SelectItem>
                              {TEAM_GROUPS.map((team) => (
                                <SelectItem key={team} value={team} className={
                                  team === 'Alpha' ? 'text-blue-700 dark:text-blue-400' :
                                  team === 'Gamma' ? 'text-green-700 dark:text-green-400' :
                                  'text-orange-700 dark:text-orange-400'
                                }>
                                  {team}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleTeamMemberRoleChange(member.id, value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue placeholder="Select role">
                                <span className="text-foreground font-medium">{member.role}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover border shadow-md">
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role} className="text-foreground">
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {member.isInitialized ? (
                            <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.status}
                            onValueChange={(value) => handleTeamMemberStatusChange(member.id, value)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select status">
                                <span className={
                                  member.status === 'available' ? 'text-green-700 dark:text-green-400 font-medium' :
                                  member.status === 'on-leave' ? 'text-amber-700 dark:text-amber-400 font-medium' :
                                  'text-red-700 dark:text-red-400 font-medium'
                                }>
                                  {STATUS_LABELS[member.status as UserStatus] || member.status}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              {(['available', 'on-leave', 'unavailable']).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {STATUS_LABELS[status as UserStatus] || status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenMemberDetail(member)}
                              title="View Details"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteMemberClick(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTeamMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No team members found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth Users Tab */}
        <TabsContent value="auth-users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    Authenticated Users
                  </CardTitle>
                  <CardDescription>
                    Manage access and system roles for users who have signed up
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={accessFilter} onValueChange={(value: 'all' | 'active' | 'disabled') => setAccessFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="disabled">Disabled Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {selectedUsers.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedUsers.size} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('enable')}
                      disabled={bulkActionLoading}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('disable')}
                      disabled={bulkActionLoading}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Disable All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUsers(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredUsers.filter(u => u.id !== user?.id).length > 0 && 
                                 filteredUsers.filter(u => u.id !== user?.id).every(u => selectedUsers.has(u.id))}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(u.id)}
                          onCheckedChange={(checked) => handleSelectUser(u.id, !!checked)}
                          disabled={u.id === user?.id}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.full_name}
                        {!u.is_active && (
                          <Badge variant="destructive" className="ml-2 text-xs">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={u.department || 'none'}
                          onValueChange={(value) => handleDepartmentChange(u.id, value)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Dept</SelectItem>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.status}
                          onValueChange={(value) => handleStatusChange(u.id, value as UserStatus)}
                        >
                          <SelectTrigger className="w-36">
                            <Badge 
                              variant="outline" 
                              className={STATUS_COLORS[u.status]}
                            >
                              {STATUS_LABELS[u.status]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {(['available', 'on-leave', 'unavailable'] as UserStatus[]).map((status) => (
                              <SelectItem key={status} value={status}>
                                <Badge variant="outline" className={STATUS_COLORS[status]}>
                                  {STATUS_LABELS[status]}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 min-w-[140px]">
                          {u.roles.length > 0 ? (
                            u.roles.map((role) => (
                              <Badge 
                                key={role} 
                                className={`${ROLE_COLORS[role]} cursor-pointer hover:opacity-80`}
                                onClick={() => {
                                  if (u.id !== user?.id) {
                                    handleRoleToggle(u.id, role, false);
                                  }
                                }}
                              >
                                {ROLE_LABELS[role]} ×
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          )}
                          {u.id !== user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Add Role</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(['admin', 'hr', 'tl', 'member'] as AppRole[])
                                  .filter((role) => !u.roles.includes(role))
                                  .map((role) => (
                                    <DropdownMenuItem
                                      key={role}
                                      onClick={() => handleRoleToggle(u.id, role, true)}
                                    >
                                      <Badge className={ROLE_COLORS[role]}>
                                        {ROLE_LABELS[role]}
                                      </Badge>
                                    </DropdownMenuItem>
                                  ))}
                                {u.roles.length === 4 && (
                                  <DropdownMenuItem disabled>All roles assigned</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={u.is_active ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleAccessToggle(u.id, !u.is_active)}
                          disabled={u.id === user?.id}
                          className={u.is_active ? 'text-destructive hover:bg-destructive hover:text-destructive-foreground' : 'bg-green-600 hover:bg-green-700'}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonateClick(u)}
                          disabled={u.id === user?.id || !u.is_active}
                        >
                          <LogIn className="h-4 w-4 mr-1" />
                          Login As
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No users found matching your search
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status Change History
              </CardTitle>
              <CardDescription>
                Track when users changed their availability status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : statusHistory.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No status changes yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Previous Status</TableHead>
                      <TableHead>New Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusHistory.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.changed_at), 'MMM d, yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell>
                          {log.old_status ? (
                            <Badge variant="outline" className={STATUS_COLORS[log.old_status as UserStatus] || ''}>
                              {STATUS_LABELS[log.old_status as UserStatus] || log.old_status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[log.new_status as UserStatus] || ''}>
                            {STATUS_LABELS[log.new_status as UserStatus] || log.new_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    User & Org Chart Sync
                  </CardTitle>
                  <CardDescription>
                    Link authenticated users to team members in the org chart
                  </CardDescription>
                </div>
                <Button onClick={handleSyncAll} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Auto-Sync All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{getSyncedUsersCount()}</p>
                    <p className="text-xs text-muted-foreground">Synced Users</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{users.length - getSyncedUsersCount()}</p>
                    <p className="text-xs text-muted-foreground">Unsynced Users</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{teamMembers.length}</p>
                    <p className="text-xs text-muted-foreground">Team Members</p>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auth User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Linked Team Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSyncedUsers().map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell>
                        {u.linkedMember ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={TEAM_ROLE_COLORS[u.linkedMember.role] || ''}>
                              {u.linkedMember.role}
                            </Badge>
                            <span className="text-sm">{u.linkedMember.name}</span>
                            <span className="text-xs text-muted-foreground">({u.linkedMember.department})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.linkedMember ? (
                          <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30">
                            <Link2 className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                            <Unlink className="h-3 w-3 mr-1" />
                            Unsynced
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.linkedMember ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLinkUserToMember(u.id, null)}
                            disabled={linkingUser === u.id}
                            className="text-destructive"
                          >
                            {linkingUser === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Unlink className="h-4 w-4 mr-1" />
                                Unlink
                              </>
                            )}
                          </Button>
                        ) : (
                          <Select
                            onValueChange={(value) => handleLinkUserToMember(u.id, value)}
                            disabled={linkingUser === u.id}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Link to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Impersonate Dialog */}
      <Dialog open={impersonateDialogOpen} onOpenChange={setImpersonateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Impersonation</DialogTitle>
            <DialogDescription>
              You are about to login as <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email}).
              This action will be logged. You will need to sign out and sign back in to return to your admin account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImpersonate} disabled={impersonating}>
              {impersonating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              Upload a CSV file or paste data to update user departments. Format: name,email,department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file" className="text-sm font-medium">Upload CSV File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        setCsvData(text);
                        toast.success(`File "${file.name}" loaded`);
                      };
                      reader.onerror = () => {
                        toast.error('Failed to read file');
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="flex-1"
                />
                <FileUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or paste data</span>
              </div>
            </div>

            <Textarea
              placeholder={`name,email,department\nJohn Doe,john@leapswitch.com,Support\nJane Smith,jane@leapswitch.com,Monitoring`}
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Supported departments: {DEPARTMENTS.join(', ')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCsvImport} disabled={importing || !csvData.trim()}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToDelete?.name}</strong> ({memberToDelete?.email}) from the system? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMember}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Team Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Team Member</DialogTitle>
            <DialogDescription>
              Add a new team member to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-id">Member ID *</Label>
              <Input
                id="member-id"
                placeholder="e.g., EMP001"
                value={newMember.id}
                onChange={(e) => setNewMember({ ...newMember, id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-name">Full Name *</Label>
              <Input
                id="member-name"
                placeholder="Enter full name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email *</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="name@leapswitch.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={newMember.department}
                  onValueChange={(value) => setNewMember({ ...newMember, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newMember.role}
                  onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={addingMember}>
              {addingMember ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      {selectedMemberDetail && (
        <MemberDetailDialog
          member={selectedMemberDetail}
          open={memberDetailOpen}
          onOpenChange={setMemberDetailOpen}
          workLocations={workLocations}
          allMembers={teamMembers.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role as RosterRole,
            department: m.department as RosterDepartment,
            team: m.team as FullTeamMember['team'],
            status: (m.status as 'available' | 'on-leave' | 'unavailable') || 'available',
            reportingTLId: m.reporting_tl_id || undefined,
            weekOffEntitlement: 2,
            isHybrid: false,
            hybridOfficeDays: 5,
            hybridWfhDays: 0,
          }))}
          onUpdate={fetchTeamMembers}
        />
      )}
    </div>
  );
}
