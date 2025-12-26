import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Save, 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Clock, 
  Building2, 
  CalendarDays,
  Network,
  Settings,
  UserCog,
  Eye,
  Edit,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'hr' | 'tl' | 'member';
type Permission = 'view' | 'create' | 'edit' | 'delete';

interface FeatureConfig {
  feature: string;
  icon: typeof LayoutDashboard;
  description: string;
  availablePermissions: Permission[];
}

const ROLE_INFO: { role: Role; label: string; color: string }[] = [
  { 
    role: 'admin', 
    label: 'Admin', 
    color: 'bg-destructive/10 text-destructive border-destructive/30'
  },
  { 
    role: 'hr', 
    label: 'HR', 
    color: 'bg-primary/10 text-primary border-primary/30'
  },
  { 
    role: 'tl', 
    label: 'Team Lead', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
  },
  { 
    role: 'member', 
    label: 'Member', 
    color: 'bg-muted text-muted-foreground border-border'
  },
];

const FEATURES: FeatureConfig[] = [
  {
    feature: 'Dashboard',
    icon: LayoutDashboard,
    description: 'View dashboard and statistics',
    availablePermissions: ['view'],
  },
  {
    feature: 'Roster',
    icon: Calendar,
    description: 'View and manage shift schedules',
    availablePermissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    feature: 'Team Members',
    icon: Users,
    description: 'View and manage team directory',
    availablePermissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    feature: 'Shifts & Swaps',
    icon: Clock,
    description: 'Manage shift assignments and swap requests',
    availablePermissions: ['view', 'create', 'edit'],
  },
  {
    feature: 'Departments',
    icon: Building2,
    description: 'Manage organizational departments',
    availablePermissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    feature: 'Leave Requests',
    icon: CalendarDays,
    description: 'Request and manage leave',
    availablePermissions: ['view', 'create', 'edit'],
  },
  {
    feature: 'Org Chart',
    icon: Network,
    description: 'View organizational structure',
    availablePermissions: ['view'],
  },
  {
    feature: 'Users & Roles',
    icon: UserCog,
    description: 'Manage user accounts and role assignments',
    availablePermissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    feature: 'Settings',
    icon: Settings,
    description: 'Application and account settings',
    availablePermissions: ['view', 'edit'],
  },
];

const PERMISSION_ICONS = {
  view: Eye,
  create: Plus,
  edit: Edit,
  delete: Trash2,
};

const PERMISSION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

// Default permissions for each role
const DEFAULT_PERMISSIONS: Record<Role, Record<string, Permission[]>> = {
  admin: {
    'Dashboard': ['view'],
    'Roster': ['view', 'create', 'edit', 'delete'],
    'Team Members': ['view', 'create', 'edit', 'delete'],
    'Shifts & Swaps': ['view', 'create', 'edit'],
    'Departments': ['view', 'create', 'edit', 'delete'],
    'Leave Requests': ['view', 'create', 'edit'],
    'Org Chart': ['view'],
    'Users & Roles': ['view', 'create', 'edit', 'delete'],
    'Settings': ['view', 'edit'],
  },
  hr: {
    'Dashboard': ['view'],
    'Roster': ['view', 'create', 'edit', 'delete'],
    'Team Members': ['view', 'create', 'edit', 'delete'],
    'Shifts & Swaps': ['view', 'create', 'edit'],
    'Departments': ['view', 'create', 'edit', 'delete'],
    'Leave Requests': ['view', 'create', 'edit'],
    'Org Chart': ['view'],
    'Users & Roles': ['view', 'create', 'edit'],
    'Settings': ['view'],
  },
  tl: {
    'Dashboard': ['view'],
    'Roster': ['view', 'create', 'edit', 'delete'],
    'Team Members': ['view'],
    'Shifts & Swaps': ['view', 'create', 'edit'],
    'Departments': ['view'],
    'Leave Requests': ['view', 'create', 'edit'],
    'Org Chart': ['view'],
    'Users & Roles': [],
    'Settings': ['view'],
  },
  member: {
    'Dashboard': ['view'],
    'Roster': ['view'],
    'Team Members': ['view'],
    'Shifts & Swaps': ['create'],
    'Departments': [],
    'Leave Requests': ['view', 'create'],
    'Org Chart': ['view'],
    'Users & Roles': [],
    'Settings': ['view'],
  },
};

interface RolePermissionEditorProps {
  onSave?: () => void;
}

export function RolePermissionEditor({ onSave }: RolePermissionEditorProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>('member');
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch saved permissions from database
  const { data: savedPermissions, isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'role_permissions')
        .maybeSingle();

      if (error) throw error;
      return data?.value as Record<Role, Record<string, Permission[]>> | null;
    },
  });

  // Initialize permissions when role changes
  useEffect(() => {
    if (savedPermissions && savedPermissions[selectedRole]) {
      setPermissions(savedPermissions[selectedRole]);
    } else {
      setPermissions(DEFAULT_PERMISSIONS[selectedRole]);
    }
    setHasChanges(false);
  }, [selectedRole, savedPermissions]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const allPermissions = savedPermissions || DEFAULT_PERMISSIONS;
      const updatedPermissions = {
        ...allPermissions,
        [selectedRole]: permissions,
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'role_permissions',
          value: updatedPermissions,
          description: 'Role-based permission configuration',
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      setHasChanges(false);
      toast.success(`Permissions for ${ROLE_INFO.find(r => r.role === selectedRole)?.label} saved`);
      onSave?.();
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error('Failed to save permissions');
    },
  });

  const togglePermission = (feature: string, permission: Permission) => {
    setPermissions(prev => {
      const featurePerms = prev[feature] || [];
      const hasPermission = featurePerms.includes(permission);
      
      const newPerms = hasPermission
        ? featurePerms.filter(p => p !== permission)
        : [...featurePerms, permission];
      
      return {
        ...prev,
        [feature]: newPerms,
      };
    });
    setHasChanges(true);
  };

  const hasPermission = (feature: string, permission: Permission) => {
    return permissions[feature]?.includes(permission) || false;
  };

  const resetToDefaults = () => {
    setPermissions(DEFAULT_PERMISSIONS[selectedRole]);
    setHasChanges(true);
  };

  const roleInfo = ROLE_INFO.find(r => r.role === selectedRole);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Permission Editor</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={saveMutation.isPending}
            >
              Reset to Defaults
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
        <CardDescription>
          Configure permissions for each role. Select a role to modify its access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Selector */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Select Role:</Label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_INFO.map(({ role, label, color }) => (
                <SelectItem key={role} value={role} textValue={label}>
                  <Badge variant="outline" className={cn(color, 'text-xs')}>
                    {label}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roleInfo && (
            <Badge variant="outline" className={cn(roleInfo.color)}>
              Currently editing: {roleInfo.label}
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
              Unsaved changes
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* Permission Grid */
          <div className="space-y-4">
            {FEATURES.map((feature) => {
              const FeatureIcon = feature.icon;
              
              return (
                <div 
                  key={feature.feature}
                  className="p-4 rounded-lg border border-border/50 bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                        <FeatureIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{feature.feature}</p>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {feature.availablePermissions.map((perm) => {
                        const Icon = PERMISSION_ICONS[perm];
                        const isEnabled = hasPermission(feature.feature, perm);
                        
                        return (
                          <div key={perm} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground w-16">
                              <Icon className="h-3.5 w-3.5" />
                              <span>{PERMISSION_LABELS[perm]}</span>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => togglePermission(feature.feature, perm)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}