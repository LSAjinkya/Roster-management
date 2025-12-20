import { useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, ShiftType, Department } from '@/types/roster';

interface SetupMonthlyRosterDialogProps {
  teamMembers: TeamMember[];
  onComplete?: () => void;
}

export function SetupMonthlyRosterDialog({ teamMembers, onComplete }: SetupMonthlyRosterDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const nextMonth = addMonths(new Date(), 1);
  const monthStart = startOfMonth(nextMonth);
  const monthEnd = endOfMonth(nextMonth);
  const monthName = format(nextMonth, 'MMMM yyyy');

  const generateMonthlyRoster = async () => {
    setLoading(true);
    
    try {
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      // Filter members for shift rotation (exclude TLs, HR, Vendor Coordinator)
      const rotationalMembers = teamMembers.filter(
        m => m.role !== 'TL' && m.role !== 'HR' && m.department !== 'Vendor Coordinator'
      );
      const tlsAndVC = teamMembers.filter(
        m => m.role === 'TL' || m.department === 'Vendor Coordinator'
      );
      const hrMembers = teamMembers.filter(m => m.role === 'HR');

      const assignments: {
        member_id: string;
        shift_type: ShiftType;
        date: string;
        department: Department;
      }[] = [];

      // Group rotational members by department for fair distribution
      const membersByDept: Record<string, TeamMember[]> = {};
      rotationalMembers.forEach(member => {
        if (!membersByDept[member.department]) {
          membersByDept[member.department] = [];
        }
        membersByDept[member.department].push(member);
      });

      days.forEach((day, dayIndex) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Rotate through departments and assign shifts
        Object.entries(membersByDept).forEach(([dept, members]) => {
          if (members.length === 0) return;

          const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night'];
          
          members.forEach((member, memberIndex) => {
            // Rotate shifts based on day and member index
            const shiftIndex = (dayIndex + memberIndex) % shiftTypes.length;
            const shiftType = shiftTypes[shiftIndex];

            assignments.push({
              member_id: member.id,
              shift_type: shiftType,
              date: dateStr,
              department: member.department as Department,
            });
          });
        });

        // TLs and Vendor Coordinator on General shift (weekdays only)
        if (!isWeekend) {
          tlsAndVC.forEach(member => {
            assignments.push({
              member_id: member.id,
              shift_type: 'general',
              date: dateStr,
              department: member.department as Department,
            });
          });

          // HR on General shift (weekdays only)
          hrMembers.forEach(member => {
            assignments.push({
              member_id: member.id,
              shift_type: 'general',
              date: dateStr,
              department: member.department as Department,
            });
          });
        }
      });

      // Delete existing assignments for next month
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (deleteError) throw deleteError;

      // Insert new assignments in batches
      const batchSize = 100;
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('shift_assignments')
          .insert(batch);

        if (insertError) throw insertError;
      }

      toast.success(`Monthly roster for ${monthName} created successfully!`, {
        description: `${assignments.length} shift assignments generated.`,
      });
      
      setOpen(false);
      onComplete?.();
    } catch (error) {
      console.error('Error generating roster:', error);
      toast.error('Failed to generate roster', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus size={16} />
          Setup {format(nextMonth, 'MMM')} Roster
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup Monthly Roster</DialogTitle>
          <DialogDescription>
            Generate shift assignments for <strong>{monthName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Roster Generation Rules:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Team members rotate through Morning, Afternoon, and Night shifts</li>
              <li>• TLs and Vendor Coordinator assigned to General shift on weekdays</li>
              <li>• HR members assigned to General shift on weekdays</li>
              <li>• Existing assignments for {format(nextMonth, 'MMMM')} will be replaced</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-2">Summary:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Month:</span>
              <span>{monthName}</span>
              <span className="text-muted-foreground">Total Days:</span>
              <span>{eachDayOfInterval({ start: monthStart, end: monthEnd }).length}</span>
              <span className="text-muted-foreground">Team Members:</span>
              <span>{teamMembers.length}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={generateMonthlyRoster} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Roster'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
