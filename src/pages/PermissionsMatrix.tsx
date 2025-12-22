import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { 
  Shield, 
  Check, 
  X, 
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
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'hr' | 'tl' | 'member';
type Permission = 'view' | 'create' | 'edit' | 'delete';

interface FeaturePermission {
  feature: string;
  icon: typeof LayoutDashboard;
  description: string;
  permissions: {
    [key in Permission]?: {
      admin: boolean;
      hr: boolean;
      tl: boolean;
      member: boolean;
    };
  };
}

const ROLE_INFO: { role: Role; label: string; color: string; description: string }[] = [
  { 
    role: 'admin', 
    label: 'Admin', 
    color: 'bg-destructive/10 text-destructive border-destructive/30',
    description: 'Full system access with all permissions'
  },
  { 
    role: 'hr', 
    label: 'HR', 
    color: 'bg-primary/10 text-primary border-primary/30',
    description: 'Manage users, leave, and HR functions'
  },
  { 
    role: 'tl', 
    label: 'Team Lead', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    description: 'Manage team shifts and approve requests'
  },
  { 
    role: 'member', 
    label: 'Member', 
    color: 'bg-muted text-muted-foreground border-border',
    description: 'View access and personal actions only'
  },
];

const FEATURES: FeaturePermission[] = [
  {
    feature: 'Dashboard',
    icon: LayoutDashboard,
    description: 'View dashboard and statistics',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
    },
  },
  {
    feature: 'Roster',
    icon: Calendar,
    description: 'View and manage shift schedules',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
      create: { admin: true, hr: true, tl: true, member: false },
      edit: { admin: true, hr: true, tl: true, member: false },
      delete: { admin: true, hr: true, tl: true, member: false },
    },
  },
  {
    feature: 'Team Members',
    icon: Users,
    description: 'View and manage team directory',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
      create: { admin: true, hr: true, tl: false, member: false },
      edit: { admin: true, hr: true, tl: false, member: false },
      delete: { admin: true, hr: true, tl: false, member: false },
    },
  },
  {
    feature: 'Shifts & Swaps',
    icon: Clock,
    description: 'Manage shift assignments and swap requests',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: false },
      create: { admin: true, hr: true, tl: true, member: true },
      edit: { admin: true, hr: true, tl: true, member: false },
    },
  },
  {
    feature: 'Departments',
    icon: Building2,
    description: 'Manage organizational departments',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: false },
      create: { admin: true, hr: true, tl: false, member: false },
      edit: { admin: true, hr: true, tl: false, member: false },
      delete: { admin: true, hr: true, tl: false, member: false },
    },
  },
  {
    feature: 'Leave Requests',
    icon: CalendarDays,
    description: 'Request and manage leave',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
      create: { admin: true, hr: true, tl: true, member: true },
      edit: { admin: true, hr: true, tl: true, member: false },
    },
  },
  {
    feature: 'Org Chart',
    icon: Network,
    description: 'View organizational structure',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
    },
  },
  {
    feature: 'Users & Roles',
    icon: UserCog,
    description: 'Manage user accounts and role assignments',
    permissions: {
      view: { admin: true, hr: true, tl: false, member: false },
      create: { admin: true, hr: true, tl: false, member: false },
      edit: { admin: true, hr: true, tl: false, member: false },
      delete: { admin: true, hr: false, tl: false, member: false },
    },
  },
  {
    feature: 'Settings',
    icon: Settings,
    description: 'Application and account settings',
    permissions: {
      view: { admin: true, hr: true, tl: true, member: true },
      edit: { admin: true, hr: false, tl: false, member: false },
    },
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

export default function PermissionsMatrix() {
  const { isAdmin, isHR, isTL } = useAuth();

  const getCurrentUserRole = (): Role => {
    if (isAdmin) return 'admin';
    if (isHR) return 'hr';
    if (isTL) return 'tl';
    return 'member';
  };

  const currentRole = getCurrentUserRole();

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Permissions Matrix" 
        subtitle="Overview of role-based access control"
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Role Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Role Definitions
            </CardTitle>
            <CardDescription>
              Your current role: <Badge variant="outline" className={ROLE_INFO.find(r => r.role === currentRole)?.color}>
                {ROLE_INFO.find(r => r.role === currentRole)?.label}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROLE_INFO.map(({ role, label, color, description }) => (
                <div 
                  key={role}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    currentRole === role ? 'ring-2 ring-primary ring-offset-2' : '',
                    'bg-card'
                  )}
                >
                  <Badge variant="outline" className={cn(color, 'mb-2')}>
                    {label}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permission Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(PERMISSION_ICONS) as Permission[]).map((perm) => {
                const Icon = PERMISSION_ICONS[perm];
                return (
                  <div key={perm} className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{PERMISSION_LABELS[perm]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Permissions Matrix Table */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Permissions</CardTitle>
            <CardDescription>
              Detailed breakdown of what each role can do
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Feature</TableHead>
                    <TableHead className="w-[100px]">Permission</TableHead>
                    {ROLE_INFO.map(({ role, label, color }) => (
                      <TableHead key={role} className="text-center w-[100px]">
                        <Badge variant="outline" className={cn(color, 'text-xs')}>
                          {label}
                        </Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURES.map((feature) => {
                    const permissionEntries = Object.entries(feature.permissions) as [Permission, typeof feature.permissions.view][];
                    
                    return permissionEntries.map(([permission, roles], index) => {
                      if (!roles) return null;
                      const Icon = PERMISSION_ICONS[permission];
                      const FeatureIcon = feature.icon;
                      
                      return (
                        <TableRow key={`${feature.feature}-${permission}`}>
                          {index === 0 ? (
                            <TableCell rowSpan={permissionEntries.length} className="font-medium align-top border-r">
                              <div className="flex items-start gap-2">
                                <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                                  <FeatureIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{feature.feature}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {feature.description}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                            </div>
                          </TableCell>
                          {ROLE_INFO.map(({ role }) => {
                            const hasAccess = roles[role];
                            const isCurrentRole = role === currentRole;
                            
                            return (
                              <TableCell 
                                key={role} 
                                className={cn(
                                  'text-center',
                                  isCurrentRole && 'bg-primary/5'
                                )}
                              >
                                {hasAccess ? (
                                  <div className="flex justify-center">
                                    <div className="p-1 rounded-full bg-green-500/10">
                                      <Check className="h-4 w-4 text-green-600" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-center">
                                    <div className="p-1 rounded-full bg-red-500/10">
                                      <X className="h-4 w-4 text-red-400" />
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Summary for Current Role */}
        <Card>
          <CardHeader>
            <CardTitle>Your Access Summary</CardTitle>
            <CardDescription>
              Features you can access based on your current role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                const permissionEntries = Object.entries(feature.permissions) as [Permission, typeof feature.permissions.view][];
                const allowedPermissions = permissionEntries
                  .filter(([_, roles]) => roles && roles[currentRole])
                  .map(([perm]) => perm);
                
                const hasAnyAccess = allowedPermissions.length > 0;
                
                return (
                  <div 
                    key={feature.feature}
                    className={cn(
                      'p-4 rounded-lg border',
                      hasAnyAccess 
                        ? 'bg-card border-border' 
                        : 'bg-muted/30 border-dashed opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FeatureIcon className={cn(
                        'h-5 w-5',
                        hasAnyAccess ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className="font-medium">{feature.feature}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allowedPermissions.length > 0 ? (
                        allowedPermissions.map((perm) => {
                          const Icon = PERMISSION_ICONS[perm];
                          return (
                            <Badge 
                              key={perm} 
                              variant="secondary" 
                              className="text-xs gap-1 bg-green-500/10 text-green-700 border-green-500/30"
                            >
                              <Icon className="h-3 w-3" />
                              {PERMISSION_LABELS[perm]}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">No access</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
