import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Clock, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Settings" 
        subtitle="Configure roster rules and preferences" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
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
