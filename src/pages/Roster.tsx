import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { WeeklyRosterView } from '@/components/WeeklyRosterView';
import { SingleDayRosterView } from '@/components/SingleDayRosterView';
import { MonthlyRosterView } from '@/components/MonthlyRosterView';
import { teamMembers, currentWeekAssignments } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Calendar, CalendarRange } from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function Roster() {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Roster" 
        subtitle="View and manage shift assignments"
      >
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="daily" className="gap-2">
              <CalendarDays size={16} />
              Daily
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-2">
              <CalendarRange size={16} />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar size={16} />
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DashboardHeader>
      
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'daily' && (
          <SingleDayRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'weekly' && (
          <WeeklyRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'monthly' && (
          <MonthlyRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
      </div>
    </div>
  );
}
