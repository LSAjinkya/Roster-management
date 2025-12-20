import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarDays, Plus, Trash2, Loader2, PartyPopper } from 'lucide-react';
import { format, parseISO, isPast, isToday, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  year: number;
  description: string | null;
}

export function PublicHolidaysCalendar() {
  const { isHR, isAdmin } = useAuth();
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const canManage = isHR || isAdmin;

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('year', currentYear)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
    } else {
      setHolidays(data || []);
    }
    setLoading(false);
  };

  const handleAddHoliday = async () => {
    if (!newName || !newDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('public_holidays')
        .insert({
          name: newName,
          date: newDate,
          year: new Date(newDate).getFullYear(),
          description: newDescription || null,
        });

      if (error) throw error;

      toast.success('Holiday added successfully');
      setAddDialogOpen(false);
      setNewName('');
      setNewDate('');
      setNewDescription('');
      fetchHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('public_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Holiday removed');
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to remove holiday');
    }
  };

  const getHolidayStatus = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'today';
    if (isPast(date)) return 'past';
    return 'upcoming';
  };

  const upcomingCount = holidays.filter(h => isFuture(parseISO(h.date)) || isToday(parseISO(h.date))).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-green-500" />
                Public Holidays {new Date().getFullYear()}
              </CardTitle>
              <CardDescription>
                {holidays.length} holidays • {upcomingCount} upcoming
              </CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Holiday
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No holidays added yet</p>
              {canManage && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setAddDialogOpen(true)}
                >
                  Add Holiday
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {holidays.map((holiday) => {
                const status = getHolidayStatus(holiday.date);
                return (
                  <div
                    key={holiday.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      status === 'today' && 'bg-green-500/10 border-green-500/30',
                      status === 'past' && 'opacity-60',
                      status === 'upcoming' && 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <div className="text-2xl font-bold text-primary">
                          {format(parseISO(holiday.date), 'd')}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(parseISO(holiday.date), 'MMM')}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{holiday.name}</span>
                          {status === 'today' && (
                            <Badge className="bg-green-500 text-white text-xs">
                              <PartyPopper className="h-3 w-3 mr-1" />
                              Today
                            </Badge>
                          )}
                          {status === 'past' && (
                            <Badge variant="secondary" className="text-xs">Past</Badge>
                          )}
                        </div>
                        {holiday.description && (
                          <p className="text-sm text-muted-foreground">{holiday.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(holiday.date), 'EEEE')}
                      </span>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Public Holiday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Holiday Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Republic Day"
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHoliday} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}