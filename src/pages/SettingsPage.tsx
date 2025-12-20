import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Clock, Save, User, Loader2, Link2, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserStatus = 'available' | 'on-leave' | 'unavailable';

const STATUS_LABELS: Record<UserStatus, string> = {
  available: 'Available',
  'on-leave': 'On Leave',
  unavailable: 'Unavailable',
};

const STATUS_COLORS: Record<UserStatus, string> = {
  available: 'bg-green-500/20 text-green-700 border-green-500/30',
  'on-leave': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  unavailable: 'bg-red-500/20 text-red-700 border-red-500/30',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<UserStatus>('available');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.status) {
        setStatus(data.status as UserStatus);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: UserStatus) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', user?.id);

      if (error) throw error;

      setStatus(newStatus);
      toast.success('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Settings" 
        subtitle="Configure roster rules and preferences" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
        {/* My Status */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <User size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">My Status</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Availability</p>
                <p className="text-sm text-muted-foreground">Update your status to let your team know your availability</p>
              </div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Select
                  value={status}
                  onValueChange={(value) => handleStatusChange(value as UserStatus)}
                  disabled={saving}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['available', 'on-leave', 'unavailable'] as UserStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge variant="outline" className={STATUS_COLORS[s]}>
                          {STATUS_LABELS[s]}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Settings size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">General Settings</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input defaultValue="Operations Team" />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input defaultValue="Asia/Kolkata (IST)" />
              </div>
            </div>
          </div>
        </div>

        {/* Rotation Rules */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Clock size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">Rotation Rules</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Rotation Cycle (days)</Label>
                <Input type="number" defaultValue="15" />
              </div>
              <div className="space-y-2">
                <Label>Max Consecutive Night Shifts</Label>
                <Input type="number" defaultValue="5" />
              </div>
              <div className="space-y-2">
                <Label>Minimum Rest Hours</Label>
                <Input type="number" defaultValue="12" />
              </div>
              <div className="space-y-2">
                <Label>Weekly Off Days</Label>
                <Input type="number" defaultValue="2" />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Bell size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Shift Reminders</p>
                <p className="text-sm text-muted-foreground">Send reminders 24 hours before shift</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Leave Approvals</p>
                <p className="text-sm text-muted-foreground">Notify TLs of pending leave requests</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Roster Published</p>
                <p className="text-sm text-muted-foreground">Notify team when new roster is published</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Shield size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">Permissions</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">TL Manual Override</p>
                <p className="text-sm text-muted-foreground">Allow TLs to manually adjust shift assignments</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Member Shift Swap</p>
                <p className="text-sm text-muted-foreground">Allow members to request shift swaps</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Link2 size={20} className="text-muted-foreground" />
            <h2 className="font-semibold">Integrations</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* BioTime Attendance */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#00A651] flex items-center justify-center">
                  <Clock size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-medium">BioTime Attendance</p>
                  <p className="text-sm text-muted-foreground">Sync attendance data from biometric devices</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  Not Connected
                </Badge>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} />
                  Connect
                </Button>
              </div>
            </div>

            {/* Zoho People */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#D4382E] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Z</span>
                </div>
                <div>
                  <p className="font-medium">Zoho People</p>
                  <p className="text-sm text-muted-foreground">Sync employee data and leave management</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  Not Connected
                </Badge>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} />
                  Connect
                </Button>
              </div>
            </div>

            {/* Slack */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#4A154B] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <p className="font-medium">Slack</p>
                  <p className="text-sm text-muted-foreground">Send shift notifications and reminders</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  Not Connected
                </Badge>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} />
                  Connect
                </Button>
              </div>
            </div>

            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#4285F4] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-sm text-muted-foreground">Sync roster schedules to team calendars</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  Not Connected
                </Badge>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} />
                  Connect
                </Button>
              </div>
            </div>

            {/* Zapier */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#FF4A00] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">⚡</span>
                </div>
                <div>
                  <p className="font-medium">Zapier</p>
                  <p className="text-sm text-muted-foreground">Connect to 5000+ apps via webhooks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  Not Connected
                </Badge>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} />
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="gap-2">
            <Save size={18} />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
