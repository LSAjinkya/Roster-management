import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  CalendarDays, 
  Users, 
  Clock, 
  Building2, 
  Settings2, 
  MapPin,
  Briefcase,
  Server
} from 'lucide-react';
import { ShiftCompositionRulesManager } from '@/components/ShiftCompositionRulesManager';
import { RotationConfigManager } from '@/components/RotationConfigManager';
import { WorkLocationManager } from '@/components/WorkLocationManager';
import { WfhPolicySettings } from '@/components/roster-settings/WfhPolicySettings';
import { WeeklyOffPolicySettings } from '@/components/roster-settings/WeeklyOffPolicySettings';
import { RoleAvailabilitySettings } from '@/components/roster-settings/RoleAvailabilitySettings';
import { DepartmentRosterSettings } from '@/components/roster-settings/DepartmentRosterSettings';
import { InfraTeamSettings } from '@/components/roster-settings/InfraTeamSettings';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function RosterSettings() {
  const { isAdmin, isHR } = useAuth();
  const [activeTab, setActiveTab] = useState('wfh');

  if (!isAdmin && !isHR) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Roster Settings" 
        subtitle="Configure all roster rules and policies in one place" 
      />

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="wfh" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Home size={16} />
              <span className="hidden sm:inline">WFH Policy</span>
              <span className="sm:hidden">WFH</span>
            </TabsTrigger>
            <TabsTrigger 
              value="weekly-off" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CalendarDays size={16} />
              <span className="hidden sm:inline">Weekly Off</span>
              <span className="sm:hidden">Off</span>
            </TabsTrigger>
            <TabsTrigger 
              value="roles" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Role Availability</span>
              <span className="sm:hidden">Roles</span>
            </TabsTrigger>
            <TabsTrigger 
              value="shifts" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Clock size={16} />
              <span className="hidden sm:inline">Shift Rules</span>
              <span className="sm:hidden">Shifts</span>
            </TabsTrigger>
            <TabsTrigger 
              value="rotation" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Settings2 size={16} />
              <span className="hidden sm:inline">Rotation</span>
              <span className="sm:hidden">Rotation</span>
            </TabsTrigger>
            <TabsTrigger 
              value="departments" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Building2 size={16} />
              <span className="hidden sm:inline">Departments</span>
              <span className="sm:hidden">Depts</span>
            </TabsTrigger>
            <TabsTrigger 
              value="locations" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MapPin size={16} />
              <span className="hidden sm:inline">Locations</span>
              <span className="sm:hidden">Loc</span>
            </TabsTrigger>
            <TabsTrigger 
              value="infra" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Server size={16} />
              <span className="hidden sm:inline">Infra/DC Team</span>
              <span className="sm:hidden">Infra</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wfh" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Home size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Work From Home Policy</h2>
              <Badge variant="outline">Applies to Roster Generation</Badge>
            </div>
            <WfhPolicySettings />
          </TabsContent>

          <TabsContent value="weekly-off" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Weekly Off Policy</h2>
              <Badge variant="outline">Applies to Roster Generation</Badge>
            </div>
            <WeeklyOffPolicySettings />
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Role-Based Team Availability</h2>
              <Badge variant="outline">Applies to Roster Generation</Badge>
            </div>
            <RoleAvailabilitySettings />
          </TabsContent>

          <TabsContent value="shifts" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Shift Composition Rules</h2>
              <Badge variant="outline">Minimum Staffing Requirements</Badge>
            </div>
            <ShiftCompositionRulesManager />
          </TabsContent>

          <TabsContent value="rotation" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Rotation Configuration</h2>
              <Badge variant="outline">Shift Cycle Settings</Badge>
            </div>
            <RotationConfigManager />
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Department Roster Settings</h2>
              <Badge variant="outline">Per-Department Configuration</Badge>
            </div>
            <DepartmentRosterSettings />
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Work Locations</h2>
              <Badge variant="outline">Office & Site Management</Badge>
            </div>
            <WorkLocationManager />
          </TabsContent>

          <TabsContent value="infra" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Server size={20} className="text-primary" />
              <h2 className="text-xl font-semibold">Infra/Datacenter Team Settings</h2>
              <Badge variant="outline">DC-Specific Rules & Transfers</Badge>
            </div>
            <InfraTeamSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
