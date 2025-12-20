import { DashboardHeader } from '@/components/DashboardHeader';
import { SHIFT_DEFINITIONS } from '@/types/roster';
import { ShiftBadge } from '@/components/ShiftBadge';
import { Clock, Users, Sun, Sunset, Moon } from 'lucide-react';

export default function Shifts() {
  const shiftComposition: Record<string, Record<string, number>> = {
    morning: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    afternoon: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    night: { L2: 2, Monitoring: 1, CloudPe: 1, Network: 2, AW: 1, Infra: 2 },
    general: { TL: 5, 'Vendor Coordinator': 1 },
    leave: {},
    'comp-off': {},
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Definitions" 
        subtitle="Configure shift timings and composition rules" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
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
              <p className="text-sm text-muted-foreground">15-day rotation for all shifts</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-xl">
              <h3 className="font-medium text-foreground mb-2">Night Shift Limit</h3>
              <p className="text-sm text-muted-foreground">Max consecutive nights: Configurable</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
