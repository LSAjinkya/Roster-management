import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SHIFT_DEFINITIONS, TeamMember, Department, Role } from '@/types/roster';
import { ShiftBadge } from '@/components/ShiftBadge';
import { ShiftHistoryLog } from '@/components/ShiftHistoryLog';
import { Clock, Users, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

export default function Shifts() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('name');

    if (!error && data) {
      setTeamMembers(data.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role as Role,
        department: m.department as Department,
        status: (m.status as 'available' | 'on-leave' | 'unavailable') || 'available',
        reportingTLId: m.reporting_tl_id || undefined,
      })));
    }
  };

  const shiftComposition: Record<string, Record<string, number>> = {
    morning: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    afternoon: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    night: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    general: { TL: 5, 'Vendor Coordinator': 1 },
    leave: {},
    'comp-off': {},
    'week-off': {},
    'public-off': {},
    'paid-leave': {},
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Management" 
        subtitle="Configure shifts and view history" 
      />
      
      <div className="flex-1 overflow-auto p-6 pt-3">
        <Tabs defaultValue="definitions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="definitions" className="gap-2">
              <Clock size={16} />
              Shift Definitions
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History size={16} />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="definitions" className="space-y-6">
            {/* Shift Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SHIFT_DEFINITIONS.map(shift => (
                <div 
                  key={shift.id} 
                  className="bg-card rounded-xl border border-border/50 overflow-hidden animate-fade-in"
                >
                  <div className={`p-6 ${shift.color} border-b-2`}>
                    <div className="flex items-center justify-between">
                      <ShiftBadge type={shift.id} size="lg" />
                      <div className="flex items-center gap-2 opacity-75">
                        <Clock size={18} />
                        <span className="text-lg font-medium">{shift.startTime} - {shift.endTime}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Users size={18} className="text-muted-foreground" />
                      Required Composition
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(shiftComposition[shift.id]).map(([role, count]) => (
                        <div 
                          key={role}
                          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                        >
                          <span className="text-sm font-medium">{role}</span>
                          <span className="text-sm font-bold text-primary">{count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total per shift</span>
                        <span className="font-bold text-foreground">
                          {Object.values(shiftComposition[shift.id]).reduce((a, b) => a + b, 0)} members
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Work Pattern Info */}
            <div className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="font-semibold text-lg mb-4">Work Pattern & Rotation</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <h3 className="font-medium text-foreground mb-2">Weekly Schedule</h3>
                  <p className="text-sm text-muted-foreground">5 working days + 2 weekly offs</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <h3 className="font-medium text-foreground mb-2">Rotation Cycle</h3>
                  <p className="text-sm text-muted-foreground">Afternoon → Morning → Night</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <h3 className="font-medium text-foreground mb-2">Night Shift Limit</h3>
                  <p className="text-sm text-muted-foreground">Max consecutive nights: Configurable</p>
                </div>
              </div>
            </div>
          </TabsContent>


          <TabsContent value="history">
            <div className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <History size={20} />
                Shift Change History
              </h2>
              <ShiftHistoryLog teamMembers={teamMembers} limit={100} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
