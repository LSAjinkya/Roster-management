import React, { useMemo, useState, useEffect } from 'react';
import { format, isWeekend, isToday, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { TeamMember, ShiftType, Department } from '@/types/roster';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Building2, MapPin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface PreviewAssignment {
  member_id: string;
  shift_type: ShiftType;
  date: string;
  department: Department;
}

interface RosterPreviewTableProps {
  assignments: PreviewAssignment[];
  teamMembers: TeamMember[];
  month: Date;
  onEditCell?: (memberId: string, date: string, currentShift: ShiftType | null) => void;
  editable?: boolean;
}

interface WorkLocation {
  id: string;
  name: string;
  code: string;
  city: string | null;
}

const shiftCellColors: Record<ShiftType | 'off', string> = {
  morning: 'bg-shift-morning text-amber-900',
  afternoon: 'bg-shift-afternoon text-sky-900',
  night: 'bg-shift-night text-violet-900',
  general: 'bg-shift-general text-emerald-900',
  leave: 'bg-red-100 text-red-700',
  'comp-off': 'bg-orange-100 text-orange-700',
  'week-off': 'bg-gray-200 text-gray-700',
  'public-off': 'bg-blue-100 text-blue-700',
  'paid-leave': 'bg-green-100 text-green-700',
  off: 'bg-muted text-muted-foreground',
};

const shiftLetters: Record<ShiftType, string> = {
  morning: 'M',
  afternoon: 'A',
  night: 'N',
  general: 'G',
  leave: 'UL',
  'comp-off': 'CO',
  'week-off': 'OFF',
  'public-off': 'PO',
  'paid-leave': 'PL',
};

type WorkShiftType = 'morning' | 'afternoon' | 'night' | 'general';

export function RosterPreviewTable({ 
  assignments, 
  teamMembers, 
  month,
  onEditCell,
  editable = false 
}: RosterPreviewTableProps) {
  const [viewMode, setViewMode] = useState<'department' | 'location'>('department');
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch work locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from('work_locations')
        .select('id, name, code, city')
        .eq('is_active', true)
        .order('name');
      if (data) setWorkLocations(data);
    };
    fetchLocations();
  }, []);

  // Group members by department
  const membersByDepartment = useMemo(() => {
    const grouped: Record<string, TeamMember[]> = {};
    teamMembers.forEach(member => {
      if (!grouped[member.department]) {
        grouped[member.department] = [];
      }
      grouped[member.department].push(member);
    });
    return grouped;
  }, [teamMembers]);

  // Group members by location
  const membersByLocation = useMemo(() => {
    const grouped: Record<string, { location: WorkLocation | null; members: TeamMember[] }> = {};
    
    teamMembers.forEach(member => {
      const locationId = member.workLocationId || 'unknown';
      if (!grouped[locationId]) {
        const location = workLocations.find(l => l.id === locationId) || null;
        grouped[locationId] = { location, members: [] };
      }
      grouped[locationId].members.push(member);
    });
    return grouped;
  }, [teamMembers, workLocations]);

  const getAssignment = (memberId: string, date: string): ShiftType | null => {
    const assignment = assignments.find(a => a.member_id === memberId && a.date === date);
    return assignment?.shift_type || null;
  };

  const getMemberStats = (memberId: string) => {
    const memberAssignments = assignments.filter(a => a.member_id === memberId);
    const weekOffs = memberAssignments.filter(a => a.shift_type === 'week-off').length;
    return {
      morning: memberAssignments.filter(a => a.shift_type === 'morning').length,
      afternoon: memberAssignments.filter(a => a.shift_type === 'afternoon').length,
      night: memberAssignments.filter(a => a.shift_type === 'night').length,
      general: memberAssignments.filter(a => a.shift_type === 'general').length,
      leave: memberAssignments.filter(a => a.shift_type === 'leave').length,
      compOff: memberAssignments.filter(a => a.shift_type === 'comp-off').length,
      weekOff: weekOffs,
      off: monthDays.length - memberAssignments.length,
      total: memberAssignments.length,
    };
  };

  // Calculate department shift summary
  const getDepartmentShiftSummary = (dept: string) => {
    const members = membersByDepartment[dept] || [];
    const memberIds = new Set(members.map(m => m.id));
    
    const summary: Record<WorkShiftType, number> = {
      morning: 0,
      afternoon: 0,
      night: 0,
      general: 0,
    };

    assignments.forEach(a => {
      if (memberIds.has(a.member_id)) {
        const shiftType = a.shift_type as WorkShiftType;
        if (shiftType in summary) {
          summary[shiftType]++;
        }
      }
    });

    return summary;
  };

  // Calculate location shift summary
  const getLocationShiftSummary = (locationId: string) => {
    const { members } = membersByLocation[locationId] || { members: [] };
    const memberIds = new Set(members.map(m => m.id));
    
    const summary: Record<WorkShiftType, number> = {
      morning: 0,
      afternoon: 0,
      night: 0,
      general: 0,
    };

    assignments.forEach(a => {
      if (memberIds.has(a.member_id)) {
        const shiftType = a.shift_type as WorkShiftType;
        if (shiftType in summary) {
          summary[shiftType]++;
        }
      }
    });

    return summary;
  };

  // Helper to render member row
  const renderMemberRow = (member: TeamMember, showLocation = false) => {
    const stats = getMemberStats(member.id);
    const location = workLocations.find(l => l.id === member.workLocationId);
    return (
      <tr key={member.id} className="border-b border-border/20 hover:bg-muted/10">
        <td className="sticky left-0 z-10 bg-card p-1.5 font-medium truncate">
          <div className="flex items-center gap-1">
            <span>{member.name}</span>
            {showLocation && location && (
              <span className="px-1 py-0.5 rounded text-[8px] font-medium border bg-muted/50">
                {location.code}
              </span>
            )}
          </div>
        </td>
        <td className="sticky left-[140px] z-10 bg-card p-1.5">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            member.role === 'TL' && "bg-primary/10 text-primary",
            member.role === 'L2' && "bg-sky-100 text-sky-700",
            member.role === 'L1' && "bg-emerald-100 text-emerald-700",
            member.role === 'HR' && "bg-pink-100 text-pink-700"
          )}>
            {member.role}
          </span>
        </td>
        {monthDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const shift = getAssignment(member.id, dateStr);
          const weekend = isWeekend(day);
          
          return (
            <td 
              key={dateStr}
              className={cn(
                "p-0.5 text-center",
                weekend && !shift && "bg-muted/30",
                editable && "cursor-pointer hover:bg-primary/10"
              )}
              onClick={() => editable && onEditCell?.(member.id, dateStr, shift)}
            >
              {shift ? (
                <span className={cn(
                  "inline-flex items-center justify-center w-5 h-4 rounded text-[9px] font-bold",
                  shiftCellColors[shift]
                )}>
                  {shiftLetters[shift]}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-5 h-4 text-[9px] text-muted-foreground">
                  -
                </span>
              )}
            </td>
          );
        })}
        <td className="p-1 text-center font-medium bg-shift-morning/20">{stats.morning || '-'}</td>
        <td className="p-1 text-center font-medium bg-shift-afternoon/20">{stats.afternoon || '-'}</td>
        <td className="p-1 text-center font-medium bg-shift-night/20">{stats.night || '-'}</td>
        <td className="p-1 text-center font-medium bg-muted/30">{stats.weekOff + stats.compOff}</td>
      </tr>
    );
  };

  // Render shift distribution badge
  const renderShiftDistribution = (summary: Record<WorkShiftType, number>) => (
    <div className="flex gap-2 text-xs">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-shift-morning">
        <span className="font-bold text-amber-900">M</span>
        <span className="text-amber-700">: {summary.morning}</span>
      </div>
      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-shift-afternoon">
        <span className="font-bold text-sky-900">A</span>
        <span className="text-sky-700">: {summary.afternoon}</span>
      </div>
      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-shift-night">
        <span className="font-bold text-violet-900">N</span>
        <span className="text-violet-700">: {summary.night}</span>
      </div>
      {summary.general > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-shift-general">
          <span className="font-bold text-emerald-900">G</span>
          <span className="text-emerald-700">: {summary.general}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Department-wise and Location-wise Shift Summary Cards */}
      {viewMode === 'department' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(membersByDepartment).map(([dept, members]) => {
            const summary = getDepartmentShiftSummary(dept);
            return (
              <div 
                key={dept}
                className="rounded-lg border p-3 bg-muted/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-primary" />
                    <span className="font-semibold text-sm">{dept}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{members.length} members</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                  <div className="rounded bg-shift-morning p-1">
                    <div className="font-bold text-amber-900">{summary.morning}</div>
                    <div className="text-amber-700 text-[9px]">M</div>
                  </div>
                  <div className="rounded bg-shift-afternoon p-1">
                    <div className="font-bold text-sky-900">{summary.afternoon}</div>
                    <div className="text-sky-700 text-[9px]">A</div>
                  </div>
                  <div className="rounded bg-shift-night p-1">
                    <div className="font-bold text-violet-900">{summary.night}</div>
                    <div className="text-violet-700 text-[9px]">N</div>
                  </div>
                  <div className="rounded bg-shift-general p-1">
                    <div className="font-bold text-emerald-900">{summary.general}</div>
                    <div className="text-emerald-700 text-[9px]">G</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(membersByLocation).map(([locId, { location, members }]) => {
            const summary = getLocationShiftSummary(locId);
            const locationName = location?.name || 'Unknown Location';
            const locationCity = location?.city || '';
            return (
              <div 
                key={locId}
                className="rounded-lg border p-3 bg-muted/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-primary" />
                    <div>
                      <span className="font-semibold text-sm">{locationName}</span>
                      {locationCity && <span className="text-xs text-muted-foreground ml-1">({locationCity})</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{members.length}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                  <div className="rounded bg-shift-morning p-1">
                    <div className="font-bold text-amber-900">{summary.morning}</div>
                    <div className="text-amber-700 text-[9px]">M</div>
                  </div>
                  <div className="rounded bg-shift-afternoon p-1">
                    <div className="font-bold text-sky-900">{summary.afternoon}</div>
                    <div className="text-sky-700 text-[9px]">A</div>
                  </div>
                  <div className="rounded bg-shift-night p-1">
                    <div className="font-bold text-violet-900">{summary.night}</div>
                    <div className="text-violet-700 text-[9px]">N</div>
                  </div>
                  <div className="rounded bg-shift-general p-1">
                    <div className="font-bold text-emerald-900">{summary.general}</div>
                    <div className="text-emerald-700 text-[9px]">G</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'department' | 'location')}>
          <TabsList className="h-8">
            <TabsTrigger value="department" className="text-xs gap-1 h-7">
              <Building2 size={12} />
              Department View
            </TabsTrigger>
            <TabsTrigger value="location" className="text-xs gap-1 h-7">
              <MapPin size={12} />
              Location View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-20 bg-muted/50 p-2 text-left font-medium min-w-[140px]">Name</th>
              <th className="sticky left-[140px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[60px]">Role</th>
              {monthDays.map(day => (
                <th 
                  key={format(day, 'yyyy-MM-dd')} 
                  className={cn(
                    "p-1 text-center font-normal min-w-[28px]",
                    isWeekend(day) && "bg-muted/50",
                    isToday(day) && "bg-primary/10"
                  )}
                >
                  <div className="text-muted-foreground text-[10px]">{format(day, 'EEE').charAt(0)}</div>
                  <div className="font-semibold">{format(day, 'd')}</div>
                </th>
              ))}
              <th className="p-1 text-center font-medium bg-shift-morning min-w-[24px]">M</th>
              <th className="p-1 text-center font-medium bg-shift-afternoon min-w-[24px]">A</th>
              <th className="p-1 text-center font-medium bg-shift-night min-w-[24px]">N</th>
              <th className="p-1 text-center font-medium bg-muted min-w-[28px]">Off</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === 'department' ? (
              // Department-based view
              <>
                {Object.entries(membersByDepartment).map(([department, members]) => {
                  const summary = getDepartmentShiftSummary(department);
                  return (
                    <React.Fragment key={`dept-${department}`}>
                      <tr className="bg-muted/20 border-t-2">
                        <td colSpan={monthDays.length + 6} className="p-2 font-semibold text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-primary" />
                              <span>{department}</span>
                              <span className="text-muted-foreground">({members.length} members)</span>
                            </div>
                            {renderShiftDistribution(summary)}
                          </div>
                        </td>
                      </tr>
                      {members.map(member => renderMemberRow(member, false))}
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              // Location-based view
              <>
                {Object.entries(membersByLocation).map(([locId, { location, members }]) => {
                  const summary = getLocationShiftSummary(locId);
                  const locationName = location?.name || 'Unknown Location';
                  const locationCity = location?.city || '';
                  return (
                    <React.Fragment key={`loc-${locId}`}>
                      <tr className="bg-muted/20 border-t-2">
                        <td colSpan={monthDays.length + 6} className="p-2 font-semibold text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-primary" />
                              <span>{locationName}</span>
                              {locationCity && <span className="text-muted-foreground">({locationCity})</span>}
                              <span className="text-muted-foreground">- {members.length} members</span>
                            </div>
                            {renderShiftDistribution(summary)}
                          </div>
                        </td>
                      </tr>
                      {members.map(member => renderMemberRow(member, true))}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]">
        {Object.entries(shiftLetters).map(([shift, letter]) => (
          <div key={shift} className="flex items-center gap-1">
            <span className={cn("w-4 h-3 rounded flex items-center justify-center font-bold", shiftCellColors[shift as ShiftType])}>
              {letter}
            </span>
            <span className="text-muted-foreground capitalize">{shift.replace('-', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
