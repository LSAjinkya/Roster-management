import { DashboardHeader } from '@/components/DashboardHeader';
import { DEPARTMENTS, ROLES } from '@/types/roster';
import { teamMembers } from '@/data/mockData';
import { Building2, Users, Shield, UserCheck } from 'lucide-react';

export default function Departments() {
  const departmentData = DEPARTMENTS.map(dept => {
    const members = teamMembers.filter(m => m.department === dept);
    const roleBreakdown = ROLES.reduce((acc, role) => {
      acc[role] = members.filter(m => m.role === role).length;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      name: dept,
      total: members.length,
      available: members.filter(m => m.status === 'available').length,
      onLeave: members.filter(m => m.status === 'on-leave').length,
      roleBreakdown,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Departments" 
        subtitle="Department overview and team distribution" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departmentData.map((dept, index) => (
            <div 
              key={dept.name}
              className="bg-card rounded-xl border border-border/50 overflow-hidden animate-fade-in hover:shadow-soft transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="p-5 border-b border-border/50 bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Building2 size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{dept.name}</h3>
                    <p className="text-sm text-muted-foreground">{dept.total} members</p>
                  </div>
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-status-available" />
                    <span className="text-sm">Available</span>
                  </div>
                  <span className="font-medium">{dept.available}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-status-leave" />
                    <span className="text-sm">On Leave</span>
                  </div>
                  <span className="font-medium">{dept.onLeave}</span>
                </div>
                
                {/* Role breakdown */}
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Role Distribution</p>
                  <div className="space-y-2">
                    {ROLES.map(role => (
                      <div key={role} className="flex items-center justify-between">
                        <span className="text-sm">{role}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ 
                                width: `${(dept.roleBreakdown[role] / dept.total) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-4 text-right">
                            {dept.roleBreakdown[role]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
