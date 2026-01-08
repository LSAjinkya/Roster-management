import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parse, getDaysInMonth } from 'date-fns';

interface ImportedMember {
  email: string;
  name: string;
  department: string;
  manager: string;
  team: string;
  level: string;
  location: string;
  shifts: Record<string, string>;
  existsInDb: boolean;
  memberId?: string;
}

interface RosterImportDialogProps {
  onImportComplete: () => void;
  year?: number;
  month?: number;
}

const SHIFT_MAP: Record<string, string> = {
  'M': 'morning',
  'A': 'afternoon',
  'N': 'night',
  'G': 'general',
  'OFF': 'week-off',
  'CO': 'comp-off',
  'L': 'leave',
  'PL': 'paid-leave',
  'PH': 'public-off',
  'CH': 'comp-off', // Company holiday treated as comp-off
};

const LOCATION_MAP: Record<string, string> = {
  'banglore': 'BLR',
  'bangalore': 'BLR',
  'pune': '411039',
  'wadala': '411038',
  'nashik': 'NASHIK',
  'wfh': 'WFH',
  'lnt dc': 'LNT-MUM',
  'yotta dc': 'YOTTA-MUM',
  'iron mountain': 'IM-MUM',
};

const DEPARTMENT_MAP: Record<string, string> = {
  'support': 'Support',
  'monitoring': 'Monitoring',
  'cloudpe': 'CloudPe',
  'network': 'Network',
  'aw': 'AW',
  'infra': 'Infra',
  'infra - lnt dc': 'Infra',
  'infra - yotta dc': 'Infra',
  'vendor co-ordinator': 'Vendor Coordinator',
  'vendor coordinator': 'Vendor Coordinator',
  'hr': 'HR',
  'sales': 'Sales',
  'admin': 'Admin',
  'marketing': 'Marketing',
  'billing': 'Billing',
  'co': 'CO',
  'development': 'Development',
  'support lead': 'Support',
  'monitoring lead': 'Monitoring',
  'cloudpe lead': 'CloudPe',
  'infra lead': 'Infra',
  'sales lead': 'Sales',
  'r&d': 'Development',
};

export function RosterImportDialog({ onImportComplete, year = 2026, month = 1 }: RosterImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ImportedMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [createMissingUsers, setCreateMissingUsers] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (content: string): string[][] => {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    
    try {
      const content = await file.text();
      const rows = parseCSV(content);
      
      if (rows.length < 2) {
        toast.error('Invalid CSV file');
        return;
      }

      const headers = rows[0];
      
      // Find the email column that contains actual email values (check first data row)
      const firstDataRow = rows[1];
      let emailIdx = -1;
      headers.forEach((h, idx) => {
        if (h.toLowerCase().includes('email') && firstDataRow[idx]?.includes('@')) {
          emailIdx = idx;
        }
      });
      // Fallback: find any column with email in header
      if (emailIdx === -1) {
        emailIdx = headers.findIndex(h => h.toLowerCase().includes('email'));
      }
      
      // Find name column (first column usually has name if not an email column)
      let nameIdx = 0;
      if (headers[0]?.toLowerCase().includes('email') && !firstDataRow[0]?.includes('@')) {
        nameIdx = 0; // First column has names even though header says "Email id"
      }
      
      const teamIdx = headers.findIndex(h => h.toLowerCase() === 'team');
      const managerIdx = headers.findIndex(h => h.toLowerCase() === 'manager');
      const teamsIdx = headers.findIndex(h => h.toLowerCase() === 'teams');
      const levelIdx = headers.findIndex(h => h.toLowerCase() === 'levels' || h.toLowerCase() === 'level');
      const locationIdx = headers.findIndex(h => h.toLowerCase().includes('location'));
      
      // Find day columns with flexible month patterns (1-Jan, 2-Feb, 3-Mar, etc.)
      const monthPatterns = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const dayColumns: { idx: number; day: number; month: number }[] = [];
      headers.forEach((h, idx) => {
        const headerLower = h.toLowerCase().trim();
        for (let m = 0; m < monthPatterns.length; m++) {
          const match = headerLower.match(new RegExp(`^(\\d+)-${monthPatterns[m]}$`));
          if (match) {
            dayColumns.push({ idx, day: parseInt(match[1]), month: m + 1 });
            break;
          }
        }
      });

      // Fetch existing team members
      const { data: existingMembers } = await supabase
        .from('team_members')
        .select('id, email');

      const memberMap = new Map(existingMembers?.map(m => [m.email.toLowerCase(), m.id]) || []);

      const imported: ImportedMember[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const email = row[emailIdx]?.toLowerCase()?.trim();
        
        if (!email || !email.includes('@')) continue;

        const shifts: Record<string, string> = {};
        dayColumns.forEach(({ idx, day, month: csvMonth }) => {
          const shift = row[idx]?.toUpperCase()?.trim();
          if (shift && SHIFT_MAP[shift]) {
            // Use the month from CSV header if available, otherwise use the prop month
            const effectiveMonth = csvMonth || month;
            const dateStr = format(new Date(year, effectiveMonth - 1, day), 'yyyy-MM-dd');
            shifts[dateStr] = SHIFT_MAP[shift];
          }
        });

        const existsInDb = memberMap.has(email);
        
        // Extract name from the first column if it's not the email column
        const rawName = nameIdx !== emailIdx ? row[nameIdx]?.trim() : '';
        const name = rawName || email.split('@')[0].split('.').map(
          p => p.charAt(0).toUpperCase() + p.slice(1)
        ).join(' ');
        
        imported.push({
          email,
          name,
          department: row[teamIdx]?.trim() || '',
          manager: row[managerIdx]?.trim() || '',
          team: row[teamsIdx]?.trim() || '',
          level: row[levelIdx]?.trim() || '',
          location: row[locationIdx]?.trim() || '',
          shifts,
          existsInDb,
          memberId: memberMap.get(email),
        });
      }

      setParsedData(imported);
      setSelectedMembers(new Set(imported.map(m => m.email)));
      
      toast.success(`Parsed ${imported.length} members from CSV`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file');
    } finally {
      setParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getLocationCode = (location: string): string | null => {
    const normalized = location.toLowerCase().trim();
    return LOCATION_MAP[normalized] || null;
  };

  const getDepartmentName = (dept: string): string => {
    const normalized = dept.toLowerCase().trim();
    return DEPARTMENT_MAP[normalized] || 'Support';
  };

  const handleImport = async () => {
    setImporting(true);
    
    try {
      const membersToImport = parsedData.filter(m => selectedMembers.has(m.email));
      
      // Fetch work locations
      const { data: workLocations } = await supabase
        .from('work_locations')
        .select('id, code, name');
      
      const locationMap = new Map(workLocations?.map(l => [l.code, l.id]) || []);
      
      // Create missing users if enabled
      if (createMissingUsers) {
        const newMembers = membersToImport.filter(m => !m.existsInDb);
        
        for (const member of newMembers) {
          const locationCode = getLocationCode(member.location);
          const locationId = locationCode ? locationMap.get(locationCode) : null;
          
          const memberId = member.email.split('@')[0].replace(/\./g, '-');
          // Use the name parsed from CSV
          const name = member.name || member.email.split('@')[0].split('.').map(
            p => p.charAt(0).toUpperCase() + p.slice(1)
          ).join(' ');
          
          const { error } = await supabase.from('team_members').insert({
            id: memberId,
            email: member.email,
            name,
            department: getDepartmentName(member.department),
            role: member.level || 'L1',
            team: member.team?.trim() || null,
            work_location_id: locationId,
            status: 'available',
          });
          
          if (error && !error.message.includes('duplicate')) {
            console.error('Error creating member:', error);
          } else {
            member.memberId = memberId;
            member.existsInDb = true;
          }
        }
      }
      
      // Refetch members to get updated IDs
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('id, email');
      
      const updatedMemberMap = new Map(allMembers?.map(m => [m.email.toLowerCase(), m.id]) || []);
      
      // Update member locations and teams
      for (const member of membersToImport) {
        const memberId = updatedMemberMap.get(member.email);
        if (!memberId) continue;
        
        const locationCode = getLocationCode(member.location);
        const locationId = locationCode ? locationMap.get(locationCode) : null;
        
        await supabase.from('team_members').update({
          work_location_id: locationId,
          team: member.team?.trim() || null,
          role: member.level || 'L1',
          department: getDepartmentName(member.department),
        }).eq('id', memberId);
      }
      
      // Delete existing assignments for this month
      const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month - 1, getDaysInMonth(new Date(year, month - 1))), 'yyyy-MM-dd');
      
      await supabase
        .from('shift_assignments')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);
      
      // Insert shift assignments
      const assignments: any[] = [];
      
      for (const member of membersToImport) {
        const memberId = updatedMemberMap.get(member.email);
        if (!memberId) continue;
        
        const dept = getDepartmentName(member.department);
        
        Object.entries(member.shifts).forEach(([date, shiftType]) => {
          assignments.push({
            member_id: memberId,
            date,
            shift_type: shiftType,
            department: dept,
          });
        });
      }
      
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);
        const { error } = await supabase.from('shift_assignments').insert(batch);
        if (error) {
          console.error('Error inserting assignments:', error);
        }
      }
      
      toast.success(`Imported ${membersToImport.length} members with ${assignments.length} shift assignments`);
      setOpen(false);
      setParsedData([]);
      onImportComplete();
    } catch (error) {
      console.error('Error importing roster:', error);
      toast.error('Failed to import roster');
    } finally {
      setImporting(false);
    }
  };

  const toggleMember = (email: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedMembers(newSelected);
  };

  const existingCount = parsedData.filter(m => m.existsInDb).length;
  const newCount = parsedData.filter(m => !m.existsInDb).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload size={16} />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} />
            Import Roster from CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                {parsing ? (
                  <Loader2 size={32} className="animate-spin text-primary" />
                ) : (
                  <Upload size={32} className="text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  {parsing ? 'Parsing CSV...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  CSV file with Email, Team, Manager, Teams, Levels, Working Location, and date columns
                </p>
              </div>
            </label>
          </div>

          {/* Parsed Data Preview */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-1">
                    <Check size={12} className="text-green-500" />
                    {existingCount} existing
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <UserPlus size={12} className="text-amber-500" />
                    {newCount} new
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-missing"
                    checked={createMissingUsers}
                    onCheckedChange={(c) => setCreateMissingUsers(!!c)}
                  />
                  <label htmlFor="create-missing" className="text-sm">
                    Create missing users
                  </label>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {parsedData.map(member => (
                    <div
                      key={member.email}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedMembers.has(member.email) 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedMembers.has(member.email)}
                        onCheckedChange={() => toggleMember(member.email)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{member.department}</span>
                          <span>•</span>
                          <span>{member.team}</span>
                          <span>•</span>
                          <span>{member.level}</span>
                          <span>•</span>
                          <span>{member.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {Object.keys(member.shifts).length} shifts
                        </Badge>
                        {member.existsInDb ? (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <Check size={10} />
                            Exists
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-amber-600">
                            <AlertCircle size={10} />
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {selectedMembers.size} of {parsedData.length} members selected
                </p>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || selectedMembers.size === 0}
                  className="gap-2"
                >
                  {importing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Import {selectedMembers.size} Members
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
