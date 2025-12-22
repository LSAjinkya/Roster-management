import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { ShiftAssignment, TeamMember } from '@/types/roster';
import { exportToCSV, exportToPDF } from '@/utils/exportRoster';
import { toast } from 'sonner';

interface ExportDropdownProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
  startDate: Date;
  endDate: Date;
  viewType: 'weekly' | 'monthly' | 'biweekly';
}

export function ExportDropdown({
  assignments,
  teamMembers,
  startDate,
  endDate,
  viewType,
}: ExportDropdownProps) {
  const handleExportCSV = () => {
    try {
      exportToCSV({ assignments, teamMembers, startDate, endDate, viewType });
      toast.success('CSV file downloaded successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF({ assignments, teamMembers, startDate, endDate, viewType });
      toast.success('PDF generated - use Print dialog to save');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download size={16} />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet size={16} />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
          <FileText size={16} />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
