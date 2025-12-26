import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, RefreshCw, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  name: string;
  department: string;
  role: string;
}

interface RotationState {
  id: string;
  member_id: string;
  current_shift_type: string;
  cycle_start_date: string;
}

const SHIFT_TYPES = ['morning', 'afternoon', 'night'] as const;

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  afternoon: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  night: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
};

export function MemberRotationInitializer() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rotationStates, setRotationStates] = useState<Map<string, RotationState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [initializingAll, setInitializingAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, statesRes] = await Promise.all([
        supabase.from('team_members').select('id, name, department, role').eq('status', 'active').order('name'),
        supabase.from('member_rotation_state').select('*'),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (statesRes.error) throw statesRes.error;

      setMembers(membersRes.data || []);
      
      const statesMap = new Map<string, RotationState>();
      (statesRes.data || []).forEach((state) => {
        statesMap.set(state.member_id, state);
      });
      setRotationStates(statesMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load member data');
    } finally {
      setLoading(false);
    }
  };

  const initializeMember = async (memberId: string, shiftType: string) => {
    setSaving(memberId);
    try {
      const existingState = rotationStates.get(memberId);
      
      if (existingState) {
        const { error } = await supabase
          .from('member_rotation_state')
          .update({
            current_shift_type: shiftType,
            cycle_start_date: new Date().toISOString().split('T')[0],
          })
          .eq('member_id', memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('member_rotation_state')
          .insert({
            member_id: memberId,
            current_shift_type: shiftType,
            cycle_start_date: new Date().toISOString().split('T')[0],
          });
        if (error) throw error;
      }

      toast.success('Rotation state updated');
      fetchData();
    } catch (error) {
      console.error('Error updating rotation state:', error);
      toast.error('Failed to update rotation state');
    } finally {
      setSaving(null);
    }
  };

  const initializeAllMembers = async () => {
    const uninitializedMembers = members.filter((m) => !rotationStates.has(m.id));
    if (uninitializedMembers.length === 0) {
      toast.info('All members are already initialized');
      return;
    }

    setInitializingAll(true);
    try {
      const inserts = uninitializedMembers.map((member, index) => ({
        member_id: member.id,
        current_shift_type: SHIFT_TYPES[index % 3],
        cycle_start_date: new Date().toISOString().split('T')[0],
      }));

      const { error } = await supabase.from('member_rotation_state').insert(inserts);
      if (error) throw error;

      toast.success(`Initialized ${uninitializedMembers.length} members`);
      fetchData();
    } catch (error) {
      console.error('Error initializing members:', error);
      toast.error('Failed to initialize members');
    } finally {
      setInitializingAll(false);
    }
  };

  const uninitializedCount = members.filter((m) => !rotationStates.has(m.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Member Rotation Initialization
            </CardTitle>
            <CardDescription>
              Set the starting shift type for each team member in the rotation cycle
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} className="gap-2">
              <RefreshCw size={16} />
              Refresh
            </Button>
            {uninitializedCount > 0 && (
              <Button onClick={initializeAllMembers} disabled={initializingAll} className="gap-2">
                {initializingAll ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Initialize All ({uninitializedCount})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {uninitializedCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-700">
            <AlertTriangle size={16} />
            <span className="text-sm">
              {uninitializedCount} member{uninitializedCount > 1 ? 's' : ''} not initialized for rotation
            </span>
          </div>
        )}

        <div className="space-y-2">
          {members.map((member) => {
            const state = rotationStates.get(member.id);
            const isInitialized = !!state;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.department} • {member.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isInitialized && (
                    <div className="text-xs text-muted-foreground">
                      Started: {format(new Date(state.cycle_start_date), 'MMM d, yyyy')}
                    </div>
                  )}

                  <Select
                    value={state?.current_shift_type || ''}
                    onValueChange={(value) => initializeMember(member.id, value)}
                    disabled={saving === member.id}
                  >
                    <SelectTrigger className="w-36">
                      {saving === member.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : state?.current_shift_type ? (
                        <Badge variant="outline" className={SHIFT_COLORS[state.current_shift_type]}>
                          {SHIFT_LABELS[state.current_shift_type]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Select shift</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_TYPES.map((shift) => (
                        <SelectItem key={shift} value={shift}>
                          <Badge variant="outline" className={SHIFT_COLORS[shift]}>
                            {SHIFT_LABELS[shift]}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isInitialized ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                      <Check size={12} className="mr-1" />
                      Initialized
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Not Set
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No active team members found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
