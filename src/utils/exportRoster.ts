import { ShiftAssignment, TeamMember, ShiftType, SHIFT_DEFINITIONS } from '@/types/roster';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';

interface ExportData {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
  startDate: Date;
  endDate: Date;
  viewType: 'weekly' | 'monthly';
}

const getShiftLabel = (shiftType: ShiftType): string => {
  const shift = SHIFT_DEFINITIONS.find(s => s.id === shiftType);
  return shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : shiftType;
};

export const exportToCSV = (data: ExportData): void => {
  const { assignments, teamMembers, startDate, endDate, viewType } = data;
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Build CSV content
  let csvContent = 'Date,Day,Shift,Member Name,Role,Department,Email\n';
  
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    
    if (dayAssignments.length === 0) {
      csvContent += `${dateStr},${format(day, 'EEEE')},No Assignments,,,,\n`;
    } else {
      dayAssignments.forEach(assignment => {
        const member = teamMembers.find(m => m.id === assignment.memberId);
        if (member) {
          csvContent += `${dateStr},${format(day, 'EEEE')},${getShiftLabel(assignment.shiftType)},${member.name},${member.role},${member.department},${member.email}\n`;
        }
      });
    }
  });
  
  // Create and download file
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
  
  // Create a printable HTML document
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to export PDF');
    return;
  }
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shift Roster - ${viewType === 'weekly' ? 'Weekly' : 'Monthly'} Report</title>
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
                  <th>Role</th>
                  <th>Department</th>
                  <th>Email</th>
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
                <td>${member.role}</td>
                <td>${member.department}</td>
                <td>${member.email}</td>
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
