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
import { Loader2, Shield, UserCog, LogIn, History, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { DEPARTMENTS, Department } from '@/types/roster';

type AppRole = 'admin' | 'hr' | 'tl' | 'member';
type UserStatus = 'available' | 'on-leave' | 'unavailable';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  status: UserStatus;
  roles: AppRole[];
}

interface ImpersonationLog {
  id: string;
  admin_email: string;
  target_email: string;
  action: string;
  ip_address: string | null;
  created_at: string;
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

export default function RoleManagement() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ImpersonationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Access denied. Admin only.');
      navigate('/');
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAuditLogs();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, department, status')
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

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('impersonation_logs')
        .select('id, admin_email, target_email, action, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;

      toast.success('Role updated successfully');
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
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
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

      const response = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: selectedUser.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Impersonation failed');
      }

      const { access_token, refresh_token } = response.data;

      await supabase.auth.signOut();
      
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) throw setSessionError;

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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Users & Roles
          </CardTitle>
          <CardDescription>
            Assign roles to control what users can access and modify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
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
                      <SelectTrigger className="w-32">
                        <SelectValue />
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
                    <Select
                      value={u.roles[0] || 'member'}
                      onValueChange={(value) => handleRoleChange(u.id, value as AppRole)}
                      disabled={u.id === user?.id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['admin', 'hr', 'tl', 'member'] as AppRole[]).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImpersonateClick(u)}
                      disabled={u.id === user?.id}
                    >
                      <LogIn className="h-4 w-4 mr-1" />
                      Login As
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Impersonation Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Impersonation Audit Log
          </CardTitle>
          <CardDescription>
            Track when admins login as other users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No impersonation logs yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-medium">{log.admin_email}</TableCell>
                    <TableCell>{log.target_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {log.ip_address || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
