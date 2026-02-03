import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarPlus, Search, Loader2, CalendarDays, CalendarRange, X, Sun, Sunset, Moon, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, ShiftType, DEPARTMENTS, Department } from '@/types/roster';
import { format, eachDayOfInterval, isWeekend, min, max } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { createRosterVersion } from './RosterVersionHistory';

interface BulkShiftAssignmentProps {
  teamMembers: TeamMember[];
  onComplete?: () => void;
}

const SHIFT_TYPES: { value: ShiftType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'morning', label: 'Morning', icon: <Sun size={16} />, color: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
  { value: 'afternoon', label: 'Afternoon', icon: <Sunset size={16} />, color: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
  { value: 'night', label: 'Night', icon: <Moon size={16} />, color: 'bg-purple-500/20 text-purple-700 border-purple-500/30' },
  { value: 'general', label: 'General', icon: <Clock size={16} />, color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'week-off', label: 'Week Off', icon: <CalendarDays size={16} />, color: 'bg-gray-500/20 text-gray-700 border-gray-500/30' },
];

type DateSelectionMode = 'range' | 'individual';

export function BulkShiftAssignment({ teamMembers, onComplete }: BulkShiftAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedShift, setSelectedShift] = useState<ShiftType>('morning');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Date selection
  const [dateMode, setDateMode] = useState<DateSelectionMode>('range');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [individualDates, setIndividualDates] = useState<Date[]>([]);
  const [skipWeekends, setSkipWeekends] = useState(false);

  const activeMembers = useMemo(() => {
    return teamMembers.filter(m => m.status !== 'unavailable');
  }, [teamMembers]);

  const filteredMembers = useMemo(() => {
    let members = activeMembers;
    
    if (departmentFilter !== 'all') {
      members = members.filter(m => m.department === departmentFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(m => 
        m.name.toLowerCase().includes(query) || 
        m.email.toLowerCase().includes(query)
      );
    }
    
    return members;
  }, [activeMembers, departmentFilter, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };

  const handleSelectMember = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers);
    if (checked) {
      newSelected.add(memberId);
    } else {
      newSelected.delete(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const selectedDates = useMemo(() => {
    let dates: Date[] = [];
    
    if (dateMode === 'range' && dateRange?.from) {
      const end = dateRange.to || dateRange.from;
      dates = eachDayOfInterval({ start: dateRange.from, end });
    } else if (dateMode === 'individual') {
      dates = [...individualDates].sort((a, b) => a.getTime() - b.getTime());
    }
    
    if (skipWeekends) {
      dates = dates.filter(d => !isWeekend(d));
    }
    
    return dates;
  }, [dateMode, dateRange, individualDates, skipWeekends]);

  const handleRemoveDate = (dateToRemove: Date) => {
    setIndividualDates(prev => prev.filter(d => d.getTime() !== dateToRemove.getTime()));
  };

  const handleAssign = async () => {
    if (selectedMembers.size === 0) {
      toast.error('Please select at least one member');
      return;
    }

    if (selectedDates.length === 0) {
      toast.error('Please select at least one date');
      return;
    }

    setLoading(true);
    try {
      const memberIds = Array.from(selectedMembers);
      
      // Create a version backup before bulk assignment
      const dateFrom = min(selectedDates);
      const dateTo = max(selectedDates);
      await createRosterVersion(
        dateFrom,
        dateTo,
        'bulk_assign',
        `Before bulk assignment`,
        `Bulk assignment of ${selectedShift} shift to ${memberIds.length} member(s) for ${selectedDates.length} day(s)`
      );
      
      const assignments: {
        member_id: string;
        date: string;
        shift_type: string;
        department: string;
        status: string;
      }[] = [];

      for (const memberId of memberIds) {
        const member = teamMembers.find(m => m.id === memberId);
        if (!member) continue;

        for (const date of selectedDates) {
          assignments.push({
            member_id: memberId,
            date: format(date, 'yyyy-MM-dd'),
            shift_type: selectedShift,
            department: member.department,
            status: 'draft',
          });
        }
      }

      // Upsert assignments (update if exists, insert if not)
      const { error } = await supabase
        .from('shift_assignments')
        .upsert(assignments, { 
          onConflict: 'member_id,date',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      const totalAssignments = memberIds.length * selectedDates.length;
      toast.success(`${totalAssignments} shift assignment(s) created`, {
        description: `${memberIds.length} member(s) × ${selectedDates.length} day(s)`
      });
      
      // Reset state
      setSelectedMembers(new Set());
      setDateRange(undefined);
      setIndividualDates([]);
      setOpen(false);
      onComplete?.();
    } catch (error) {
      console.error('Error assigning shifts:', error);
      toast.error('Failed to assign shifts');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMembers(new Set());
    setSelectedShift('morning');
    setDepartmentFilter('all');
    setSearchQuery('');
    setDateMode('range');
    setDateRange(undefined);
    setIndividualDates([]);
    setSkipWeekends(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarPlus size={16} />
          Bulk Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Shift Assignment</DialogTitle>
          <DialogDescription>
            Assign shifts to multiple members for multiple days at once
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Member Selection */}
            <div className="space-y-4">
              <div className="font-medium text-sm">1. Select Members</div>
              
              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="All Depts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depts</SelectItem>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select All */}
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={filteredMembers.length > 0 && selectedMembers.size === filteredMembers.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({filteredMembers.length})
                  </Label>
                </div>
                <Badge variant="secondary">{selectedMembers.size} selected</Badge>
              </div>

              {/* Member List */}
              <ScrollArea className="h-[280px] border rounded-lg">
                <div className="divide-y">
                  {filteredMembers.map(member => (
                    <div 
                      key={member.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.department} • {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No members found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Column - Date & Shift Selection */}
            <div className="space-y-4">
              <div className="font-medium text-sm">2. Select Dates & Shift</div>

              {/* Shift Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Shift Type</Label>
                <div className="flex flex-wrap gap-2">
                  {SHIFT_TYPES.map(shift => (
                    <Badge
                      key={shift.value}
                      variant="outline"
                      className={cn(
                        "cursor-pointer transition-all px-3 py-1.5 gap-1.5",
                        selectedShift === shift.value 
                          ? shift.color + ' ring-2 ring-offset-1' 
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setSelectedShift(shift.value)}
                    >
                      {shift.icon}
                      {shift.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Date Selection Mode */}
              <Tabs value={dateMode} onValueChange={(v) => setDateMode(v as DateSelectionMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="range" className="gap-2 text-xs">
                    <CalendarRange size={14} />
                    Date Range
                  </TabsTrigger>
                  <TabsTrigger value="individual" className="gap-2 text-xs">
                    <CalendarDays size={14} />
                    Individual Dates
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="range" className="mt-3">
                  <div className="flex justify-center">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      className="rounded-md border pointer-events-auto"
                      classNames={{
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_range_middle: "bg-primary/20 text-primary-foreground rounded-none",
                        day_range_start: "bg-primary text-primary-foreground rounded-l-md",
                        day_range_end: "bg-primary text-primary-foreground rounded-r-md",
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="individual" className="mt-3">
                  <div className="flex justify-center">
                    <Calendar
                      mode="multiple"
                      selected={individualDates}
                      onSelect={(dates) => setIndividualDates(dates || [])}
                      numberOfMonths={1}
                      className="rounded-md border pointer-events-auto"
                      classNames={{
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Skip Weekends Option */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-weekends"
                  checked={skipWeekends}
                  onCheckedChange={(checked) => setSkipWeekends(checked as boolean)}
                />
                <Label htmlFor="skip-weekends" className="text-sm cursor-pointer">
                  Skip weekends (Sat & Sun)
                </Label>
              </div>

              {/* Selected Dates Preview */}
              {selectedDates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Selected Dates ({selectedDates.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto p-2 bg-muted/30 rounded-lg">
                    {selectedDates.slice(0, 20).map(date => (
                      <Badge 
                        key={date.toISOString()} 
                        variant="secondary" 
                        className="text-xs gap-1"
                      >
                        {format(date, 'MMM d')}
                        {dateMode === 'individual' && (
                          <X 
                            size={12} 
                            className="cursor-pointer hover:text-destructive" 
                            onClick={() => handleRemoveDate(date)}
                          />
                        )}
                      </Badge>
                    ))}
                    {selectedDates.length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedDates.length - 20} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-muted-foreground">Total assignments to create:</span>
            <span className="font-semibold">
              {selectedMembers.size} member(s) × {selectedDates.length} day(s) = {selectedMembers.size * selectedDates.length} shift(s)
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={loading || selectedMembers.size === 0 || selectedDates.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${selectedMembers.size * selectedDates.length} Shift(s)`
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
