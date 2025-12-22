import { ShiftAssignment, TeamMember, ShiftType, SHIFT_DEFINITIONS, TeamGroup } from '@/types/roster';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';

interface ExportData {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
  startDate: Date;
  endDate: Date;
  viewType: 'weekly' | 'monthly' | 'biweekly';
}

const getShiftLabel = (shiftType: ShiftType): string => {
  const shift = SHIFT_DEFINITIONS.find(s => s.id === shiftType);
  return shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : shiftType;
};

const getShiftShortLabel = (shiftType: ShiftType): string => {
  switch (shiftType) {
    case 'morning': return 'M';
    case 'afternoon': return 'A';
    case 'night': return 'N';
    case 'general': return 'G';
    case 'leave': return 'L';
    case 'comp-off': return 'CO';
    case 'week-off': return 'OFF';
    case 'public-off': return 'PH';
    case 'paid-leave': return 'PL';
    default: return '-';
  }
};

const TEAM_COLORS: Record<TeamGroup, { bg: string; text: string; border: string }> = {
  'Alpha': { bg: '#dbeafe', text: '#1d4ed8', border: '#3b82f6' },
  'Gamma': { bg: '#dcfce7', text: '#15803d', border: '#22c55e' },
  'Beta': { bg: '#ffedd5', text: '#c2410c', border: '#f97316' },
};

const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string }> = {
  'morning': { bg: '#fef3c7', text: '#92400e' },
  'afternoon': { bg: '#e0f2fe', text: '#0369a1' },
  'night': { bg: '#ede9fe', text: '#6d28d9' },
  'general': { bg: '#d1fae5', text: '#047857' },
  'leave': { bg: '#fee2e2', text: '#dc2626' },
  'comp-off': { bg: '#ffedd5', text: '#ea580c' },
  'week-off': { bg: '#e5e7eb', text: '#4b5563' },
  'public-off': { bg: '#dbeafe', text: '#2563eb' },
  'paid-leave': { bg: '#dcfce7', text: '#16a34a' },
};

export const exportToCSV = (data: ExportData): void => {
  const { assignments, teamMembers, startDate, endDate, viewType } = data;
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  let csvContent = 'Date,Day,Shift,Member Name,Team,Role,Department,Email\n';
  
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    
    if (dayAssignments.length === 0) {
      csvContent += `${dateStr},${format(day, 'EEEE')},No Assignments,,,,,\n`;
    } else {
      dayAssignments.forEach(assignment => {
        const member = teamMembers.find(m => m.id === assignment.memberId);
        if (member) {
          csvContent += `${dateStr},${format(day, 'EEEE')},${getShiftLabel(assignment.shiftType)},${member.name},${member.team || 'N/A'},${member.role},${member.department},${member.email}\n`;
        }
      });
    }
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `roster_${viewType}_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = async (data: ExportData): Promise<void> => {
  const { assignments, teamMembers, startDate, endDate, viewType } = data;
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to export PDF');
    return;
  }
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shift Roster - ${viewType === 'weekly' ? 'Weekly' : viewType === 'biweekly' ? '14-Day' : 'Monthly'} Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 5px; color: #1e293b; }
        h2 { font-size: 14px; margin-bottom: 15px; color: #64748b; font-weight: normal; }
        .day-section { margin-bottom: 20px; page-break-inside: avoid; }
        .day-header { background: #f1f5f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 8px; }
        .day-title { font-weight: 600; color: #1e293b; }
        .day-date { color: #64748b; font-size: 11px; }
        .shift-section { margin-left: 10px; margin-bottom: 10px; }
        .shift-title { font-weight: 600; font-size: 11px; color: #475569; padding: 4px 8px; border-radius: 3px; display: inline-block; margin-bottom: 4px; }
        .shift-morning { background: #fef3c7; color: #92400e; }
        .shift-afternoon { background: #e0f2fe; color: #0369a1; }
        .shift-night { background: #ede9fe; color: #6d28d9; }
        .shift-general { background: #d1fae5; color: #047857; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 10px; text-transform: uppercase; }
        td { color: #334155; }
        .no-data { color: #94a3b8; font-style: italic; padding: 10px; }
        @media print { .day-section { page-break-inside: avoid; } }
      </style>
    </head>
    <body>
      <h1>Shift Roster Report</h1>
      <h2>${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}</h2>
  `;
  
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    
    htmlContent += `
      <div class="day-section">
        <div class="day-header">
          <span class="day-title">${format(day, 'EEEE')}</span>
          <span class="day-date"> - ${format(day, 'MMMM d, yyyy')}</span>
        </div>
    `;
    
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night', 'general'];
    
    shiftTypes.forEach(shiftType => {
      const shiftAssignments = dayAssignments.filter(a => a.shiftType === shiftType);
      
      if (shiftAssignments.length > 0) {
        htmlContent += `
          <div class="shift-section">
            <span class="shift-title shift-${shiftType}">${getShiftLabel(shiftType)}</span>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        shiftAssignments.forEach(assignment => {
          const member = teamMembers.find(m => m.id === assignment.memberId);
          if (member) {
            htmlContent += `
              <tr>
                <td>${member.name}</td>
                <td>${member.team || 'N/A'}</td>
                <td>${member.role}</td>
                <td>${member.department}</td>
              </tr>
            `;
          }
        });
        
        htmlContent += '</tbody></table></div>';
      }
    });
    
    if (dayAssignments.length === 0) {
      htmlContent += '<div class="no-data">No assignments for this day</div>';
    }
    
    htmlContent += '</div>';
  });
  
  htmlContent += `
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

// New: Team-wise PDF export with color coding
export const exportTeamWisePDF = async (data: ExportData): Promise<void> => {
  const { assignments, teamMembers, startDate, endDate } = data;
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to export PDF');
    return;
  }
  
  // Group members by team
  const membersByTeam: Record<string, TeamMember[]> = {};
  teamMembers.forEach(member => {
    const team = member.team || 'Unassigned';
    if (!membersByTeam[team]) membersByTeam[team] = [];
    membersByTeam[team].push(member);
  });
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Team Roster - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
        .header h1 { font-size: 20px; color: #1e293b; margin-bottom: 4px; }
        .header h2 { font-size: 13px; color: #64748b; font-weight: normal; }
        .team-section { margin-bottom: 25px; page-break-inside: avoid; }
        .team-header { padding: 10px 15px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
        .team-alpha { background: ${TEAM_COLORS.Alpha.bg}; border-left: 4px solid ${TEAM_COLORS.Alpha.border}; }
        .team-gamma { background: ${TEAM_COLORS.Gamma.bg}; border-left: 4px solid ${TEAM_COLORS.Gamma.border}; }
        .team-beta { background: ${TEAM_COLORS.Beta.bg}; border-left: 4px solid ${TEAM_COLORS.Beta.border}; }
        .team-unassigned { background: #f3f4f6; border-left: 4px solid #9ca3af; }
        .team-name { font-size: 14px; font-weight: 700; }
        .team-alpha .team-name { color: ${TEAM_COLORS.Alpha.text}; }
        .team-gamma .team-name { color: ${TEAM_COLORS.Gamma.text}; }
        .team-beta .team-name { color: ${TEAM_COLORS.Beta.text}; }
        .team-unassigned .team-name { color: #4b5563; }
        .team-count { font-size: 11px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 9px; text-transform: uppercase; padding: 8px 4px; text-align: center; border-bottom: 2px solid #e2e8f0; }
        th.member-col { text-align: left; padding-left: 10px; min-width: 120px; }
        td { padding: 6px 4px; text-align: center; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
        td.member-cell { text-align: left; padding-left: 10px; font-weight: 500; }
        .member-role { font-size: 9px; color: #6b7280; font-weight: normal; }
        .shift-cell { border-radius: 4px; padding: 4px 2px; font-weight: 600; font-size: 10px; }
        .shift-M { background: ${SHIFT_COLORS.morning.bg}; color: ${SHIFT_COLORS.morning.text}; }
        .shift-A { background: ${SHIFT_COLORS.afternoon.bg}; color: ${SHIFT_COLORS.afternoon.text}; }
        .shift-N { background: ${SHIFT_COLORS.night.bg}; color: ${SHIFT_COLORS.night.text}; }
        .shift-G { background: ${SHIFT_COLORS.general.bg}; color: ${SHIFT_COLORS.general.text}; }
        .shift-L { background: ${SHIFT_COLORS.leave.bg}; color: ${SHIFT_COLORS.leave.text}; }
        .shift-CO { background: ${SHIFT_COLORS['comp-off'].bg}; color: ${SHIFT_COLORS['comp-off'].text}; }
        .shift-OFF { background: ${SHIFT_COLORS['week-off'].bg}; color: ${SHIFT_COLORS['week-off'].text}; }
        .shift-PH { background: ${SHIFT_COLORS['public-off'].bg}; color: ${SHIFT_COLORS['public-off'].text}; }
        .shift-PL { background: ${SHIFT_COLORS['paid-leave'].bg}; color: ${SHIFT_COLORS['paid-leave'].text}; }
        .shift-none { color: #d1d5db; }
        .legend { margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
        .legend-title { font-weight: 600; margin-bottom: 8px; color: #475569; }
        .legend-items { display: flex; flex-wrap: wrap; gap: 8px; }
        .legend-item { display: flex; align-items: center; gap: 4px; font-size: 10px; }
        .legend-box { width: 20px; height: 16px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 9px; }
        .weekend { background: #fef3c7; }
        @media print { 
          .team-section { page-break-inside: avoid; }
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🗓️ Team Shift Roster</h1>
        <h2>${format(startDate, 'MMMM d')} - ${format(endDate, 'MMMM d, yyyy')}</h2>
      </div>
  `;

  const teams = ['Alpha', 'Gamma', 'Beta', 'Unassigned'] as const;
  
  teams.forEach(team => {
    const members = membersByTeam[team] || [];
    if (members.length === 0) return;
    
    const teamClass = team === 'Alpha' ? 'team-alpha' : 
                      team === 'Gamma' ? 'team-gamma' : 
                      team === 'Beta' ? 'team-beta' : 'team-unassigned';
    
    htmlContent += `
      <div class="team-section">
        <div class="team-header ${teamClass}">
          <span class="team-name">Team ${team}</span>
          <span class="team-count">${members.length} members</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="member-col">Member</th>
              ${days.map(day => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return `<th class="${isWeekend ? 'weekend' : ''}">${format(day, 'EEE')}<br/>${format(day, 'd')}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;
    
    members.forEach(member => {
      htmlContent += `
        <tr>
          <td class="member-cell">
            ${member.name}
            <div class="member-role">${member.role}</div>
          </td>
      `;
      
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const assignment = assignments.find(a => a.memberId === member.id && a.date === dateStr);
        const shift = assignment?.shiftType;
        const shortLabel = shift ? getShiftShortLabel(shift) : '-';
        const shiftClass = shift ? `shift-${shortLabel}` : 'shift-none';
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        
        htmlContent += `
          <td class="${isWeekend ? 'weekend' : ''}">
            <div class="shift-cell ${shiftClass}">${shortLabel}</div>
          </td>
        `;
      });
      
      htmlContent += '</tr>';
    });
    
    htmlContent += '</tbody></table></div>';
  });
  
  // Legend
  htmlContent += `
    <div class="legend">
      <div class="legend-title">Legend</div>
      <div class="legend-items">
        <div class="legend-item"><div class="legend-box shift-M">M</div> Morning</div>
        <div class="legend-item"><div class="legend-box shift-A">A</div> Afternoon</div>
        <div class="legend-item"><div class="legend-box shift-N">N</div> Night</div>
        <div class="legend-item"><div class="legend-box shift-G">G</div> General</div>
        <div class="legend-item"><div class="legend-box shift-OFF">OFF</div> Week Off</div>
        <div class="legend-item"><div class="legend-box shift-L">L</div> Leave</div>
        <div class="legend-item"><div class="legend-box shift-CO">CO</div> Comp Off</div>
        <div class="legend-item"><div class="legend-box shift-PH">PH</div> Public Holiday</div>
      </div>
    </div>
  `;
  
  htmlContent += '</body></html>';
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
  }, 300);
};

export const getMemberMonthlyRoster = (
  memberId: string, 
  assignments: ShiftAssignment[], 
  month: Date
): { date: Date; shiftType: ShiftType | null }[] => {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  
  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const assignment = assignments.find(
      a => a.memberId === memberId && a.date === dateStr
    );
    
    return {
      date: day,
      shiftType: assignment?.shiftType || null
    };
  });
};
