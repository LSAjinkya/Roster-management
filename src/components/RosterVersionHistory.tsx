import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember } from '@/types/roster';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { History, RotateCcw, Trash2, FileUp, Users, Calendar, Clock, GitBranch, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RosterVersion {
  id: string;
  version_name: string | null;
  change_type: string;
  description: string | null;
  assignments_snapshot: any[];
  snapshot_date_from: string;
  snapshot_date_to: string;
  created_by: string | null;
  created_at: string;
}

interface RosterVersionHistoryProps {
  teamMembers: TeamMember[];
  currentDateFrom: Date;
  currentDateTo: Date;
  onRestore: () => void;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'manual': { label: 'Manual Edit', icon: <Users size={14} />, color: 'bg-blue-100 text-blue-700' },
  'csv_import': { label: 'CSV Import', icon: <FileUp size={14} />, color: 'bg-green-100 text-green-700' },
  'bulk_assign': { label: 'Bulk Assign', icon: <Users size={14} />, color: 'bg-purple-100 text-purple-700' },
  'auto_generate': { label: 'Auto Generated', icon: <Clock size={14} />, color: 'bg-orange-100 text-orange-700' },
  'snapshot': { label: 'Snapshot', icon: <Save size={14} />, color: 'bg-gray-100 text-gray-700' },
};

export function RosterVersionHistory({ 
  teamMembers, 
  currentDateFrom, 
  currentDateTo,
  onRestore 
}: RosterVersionHistoryProps) {
  const [versions, setVersions] = useState<RosterVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roster_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setVersions((data || []) as RosterVersion[]);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async () => {
    setCreating(true);
    try {
      // Get current assignments for the date range
      const { data: assignments, error: fetchError } = await supabase
        .from('shift_assignments')
        .select('*')
        .gte('date', format(currentDateFrom, 'yyyy-MM-dd'))
        .lte('date', format(currentDateTo, 'yyyy-MM-dd'));

      if (fetchError) throw fetchError;

      const { data: session } = await supabase.auth.getSession();

      const { error: insertError } = await supabase
        .from('roster_versions')
        .insert({
          version_name: versionName || `Snapshot - ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
          change_type: 'snapshot',
          description: versionDescription || null,
          assignments_snapshot: assignments || [],
          snapshot_date_from: format(currentDateFrom, 'yyyy-MM-dd'),
          snapshot_date_to: format(currentDateTo, 'yyyy-MM-dd'),
          created_by: session?.session?.user?.id || null,
        });

      if (insertError) throw insertError;

      toast.success('Snapshot created successfully');
      setCreateDialogOpen(false);
      setVersionName('');
      setVersionDescription('');
      fetchVersions();
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setCreating(false);
    }
  };

  const restoreVersion = async (version: RosterVersion) => {
    setRestoring(true);
    try {
      // First, create a backup of current state
      const { data: currentAssignments, error: fetchError } = await supabase
        .from('shift_assignments')
        .select('*')
        .gte('date', version.snapshot_date_from)
        .lte('date', version.snapshot_date_to);

      if (fetchError) throw fetchError;

      const { data: session } = await supabase.auth.getSession();

      // Save current state as a backup before restoring
      await supabase
        .from('roster_versions')
        .insert({
          version_name: `Auto-backup before restore`,
          change_type: 'snapshot',
          description: `Automatic backup created before restoring to: ${version.version_name || format(parseISO(version.created_at), 'MMM d, yyyy HH:mm')}`,
          assignments_snapshot: currentAssignments || [],
          snapshot_date_from: version.snapshot_date_from,
          snapshot_date_to: version.snapshot_date_to,
          created_by: session?.session?.user?.id || null,
        });

      // Delete current assignments in the date range
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .gte('date', version.snapshot_date_from)
        .lte('date', version.snapshot_date_to);

      if (deleteError) throw deleteError;

      // Restore the snapshot assignments
      if (version.assignments_snapshot && version.assignments_snapshot.length > 0) {
        const assignmentsToInsert = version.assignments_snapshot.map((a: any) => ({
          member_id: a.member_id,
          date: a.date,
          shift_type: a.shift_type,
          department: a.department,
          status: a.status || 'draft',
          work_location_id: a.work_location_id || null,
        }));

        const { error: insertError } = await supabase
          .from('shift_assignments')
          .insert(assignmentsToInsert);

        if (insertError) throw insertError;
      }

      toast.success('Roster restored successfully! A backup was created.');
      setOpen(false);
      onRestore();
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  const deleteVersion = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from('roster_versions')
        .delete()
        .eq('id', versionId);

      if (error) throw error;

      toast.success('Version deleted');
      fetchVersions();
    } catch (error) {
      console.error('Error deleting version:', error);
      toast.error('Failed to delete version');
    }
  };

  const getMemberName = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.name || memberId;
  };

  const getChangeTypeConfig = (type: string) => {
    return CHANGE_TYPE_CONFIG[type] || CHANGE_TYPE_CONFIG['manual'];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History size={16} />
          Version History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Roster Version History
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">
            View and restore previous versions of your roster
          </p>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Save size={14} />
                Create Snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Roster Snapshot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="version-name">Snapshot Name</Label>
                  <Input
                    id="version-name"
                    placeholder="e.g., Before February changes"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version-desc">Description (Optional)</Label>
                  <Textarea
                    id="version-desc"
                    placeholder="Add notes about this snapshot..."
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  <Calendar size={14} />
                  <span>
                    Will save roster from {format(currentDateFrom, 'MMM d')} to {format(currentDateTo, 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createSnapshot} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Snapshot'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading versions...</div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No version history yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a snapshot to save the current roster state
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const config = getChangeTypeConfig(version.change_type);
                const assignmentCount = version.assignments_snapshot?.length || 0;
                
                return (
                  <Card key={version.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {version.version_name || `Version from ${format(parseISO(version.created_at), 'MMM d, yyyy')}`}
                            </CardTitle>
                            <Badge className={cn("text-xs", config.color)}>
                              {config.icon}
                              <span className="ml-1">{config.label}</span>
                            </Badge>
                          </div>
                          <CardDescription className="mt-1">
                            {format(parseISO(version.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1" disabled={restoring}>
                                <RotateCcw size={14} />
                                Restore
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will replace current assignments for the date range 
                                  <strong> {format(parseISO(version.snapshot_date_from), 'MMM d')} - {format(parseISO(version.snapshot_date_to), 'MMM d, yyyy')}</strong> with this version.
                                  <br /><br />
                                  A backup of the current state will be created automatically before restoring.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => restoreVersion(version)}>
                                  Restore Version
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this version?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This version will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteVersion(version.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {version.description && (
                        <p className="text-sm text-muted-foreground mb-2">{version.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>
                            {format(parseISO(version.snapshot_date_from), 'MMM d')} - {format(parseISO(version.snapshot_date_to), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={12} />
                          <span>{assignmentCount} assignments</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Utility function to create a version before major operations
export async function createRosterVersion(
  dateFrom: Date,
  dateTo: Date,
  changeType: string,
  versionName?: string,
  description?: string
) {
  try {
    const { data: assignments, error: fetchError } = await supabase
      .from('shift_assignments')
      .select('*')
      .gte('date', format(dateFrom, 'yyyy-MM-dd'))
      .lte('date', format(dateTo, 'yyyy-MM-dd'));

    if (fetchError) throw fetchError;

    const { data: session } = await supabase.auth.getSession();

    const { error: insertError } = await supabase
      .from('roster_versions')
      .insert({
        version_name: versionName || `Before ${changeType}`,
        change_type: changeType,
        description: description || null,
        assignments_snapshot: assignments || [],
        snapshot_date_from: format(dateFrom, 'yyyy-MM-dd'),
        snapshot_date_to: format(dateTo, 'yyyy-MM-dd'),
        created_by: session?.session?.user?.id || null,
      });

    if (insertError) throw insertError;
    return true;
  } catch (error) {
    console.error('Error creating roster version:', error);
    return false;
  }
}
