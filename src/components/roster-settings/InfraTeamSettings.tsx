import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, CalendarDays, Users, RefreshCw, Building2, ArrowRightLeft, Info, History, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DCStaffTransferDialog } from './DCStaffTransferDialog';
import { DCTransferHistory } from './DCTransferHistory';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface WeekoffRules {
  min_weekoff_per_month: number;
  max_weekoff_per_month: number;
  consecutive_weekoff_allowed: boolean;
  max_consecutive_weekoff: number;
  split_weekoff_allowed: boolean;
  split_weekoff_days: number[];
}

interface StaffPerShift {
  morning: number;
  afternoon: number;
  night: number;
  general: number;
}

interface RotationRules {
  rotation_enabled: boolean;
  rotation_cycle_days: number;
  shift_sequence: string[];
}

interface Datacenter {
  id: string;
  name: string;
  code: string;
}

interface DCRoleAvailability {
  id?: string;
  datacenter_id: string;
  role: string;
  morning_shift: boolean;
  afternoon_shift: boolean;
  night_shift: boolean;
  general_shift: boolean;
}

const INFRA_ROLES = ['DCE', 'Sr.DCE', 'DC Admin', 'TL', 'Manager'];

export function InfraTeamSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('weekoff');
  
  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<{
    weekoffRules: WeekoffRules;
    minStaff: StaffPerShift;
    maxStaff: StaffPerShift;
    rotationRules: RotationRules;
  } | null>(null);
  
  // Settings state
  const [weekoffRules, setWeekoffRules] = useState<WeekoffRules>({
    min_weekoff_per_month: 4,
    max_weekoff_per_month: 8,
    consecutive_weekoff_allowed: true,
    max_consecutive_weekoff: 2,
    split_weekoff_allowed: false,
    split_weekoff_days: [1, 1]
  });
  
  const [minStaff, setMinStaff] = useState<StaffPerShift>({ morning: 2, afternoon: 2, night: 2, general: 1 });
  const [maxStaff, setMaxStaff] = useState<StaffPerShift>({ morning: 10, afternoon: 10, night: 8, general: 5 });
  
  const [rotationRules, setRotationRules] = useState<RotationRules>({
    rotation_enabled: true,
    rotation_cycle_days: 15,
    shift_sequence: ['afternoon', 'morning', 'night']
  });
  
  // DC-specific state
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [dcRoleAvailability, setDcRoleAvailability] = useState<DCRoleAvailability[]>([]);
  const [selectedDCs, setSelectedDCs] = useState<string[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Check for unsaved changes
  const checkUnsavedChanges = useCallback(() => {
    if (!originalSettings) return false;
    const weekoffChanged = JSON.stringify(weekoffRules) !== JSON.stringify(originalSettings.weekoffRules);
    const minStaffChanged = JSON.stringify(minStaff) !== JSON.stringify(originalSettings.minStaff);
    const maxStaffChanged = JSON.stringify(maxStaff) !== JSON.stringify(originalSettings.maxStaff);
    const rotationChanged = JSON.stringify(rotationRules) !== JSON.stringify(originalSettings.rotationRules);
    return weekoffChanged || minStaffChanged || maxStaffChanged || rotationChanged;
  }, [weekoffRules, minStaff, maxStaff, rotationRules, originalSettings]);

  useEffect(() => {
    setHasUnsavedChanges(checkUnsavedChanges());
  }, [checkUnsavedChanges]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch infra settings
      const { data: settings, error: settingsError } = await supabase
        .from('infra_team_settings')
        .select('*');
      
      if (settingsError) throw settingsError;
      
      let loadedWeekoff = weekoffRules;
      let loadedMinStaff = minStaff;
      let loadedMaxStaff = maxStaff;
      let loadedRotation = rotationRules;
      
      settings?.forEach(setting => {
        const value = setting.setting_value as Record<string, unknown>;
        switch (setting.setting_key) {
          case 'weekoff_rules':
            loadedWeekoff = value as unknown as WeekoffRules;
            setWeekoffRules(loadedWeekoff);
            break;
          case 'min_staff_per_shift':
            loadedMinStaff = value as unknown as StaffPerShift;
            setMinStaff(loadedMinStaff);
            break;
          case 'max_staff_per_shift':
            loadedMaxStaff = value as unknown as StaffPerShift;
            setMaxStaff(loadedMaxStaff);
            break;
          case 'rotation_rules':
            loadedRotation = value as unknown as RotationRules;
            setRotationRules(loadedRotation);
            break;
        }
      });
      
      // Store original settings for comparison
      setOriginalSettings({
        weekoffRules: loadedWeekoff,
        minStaff: loadedMinStaff,
        maxStaff: loadedMaxStaff,
        rotationRules: loadedRotation,
      });
      
      // Fetch datacenters
      const { data: dcs, error: dcError } = await supabase
        .from('datacenters')
        .select('*')
        .eq('is_active', true);
      
      if (dcError) throw dcError;
      setDatacenters(dcs || []);
      if (dcs && dcs.length > 0) {
        setSelectedDCs(dcs.map(dc => dc.id)); // Select all by default
      }
      
      // Fetch DC role availability
      const { data: dcRoles, error: dcRolesError } = await supabase
        .from('dc_role_shift_availability')
        .select('*');
      
      if (dcRolesError) throw dcRolesError;
      setDcRoleAvailability(dcRoles || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  // Save all unsaved changes
  async function saveAllSettings() {
    setSaving(true);
    try {
      const savePromises = [];
      
      if (originalSettings && JSON.stringify(weekoffRules) !== JSON.stringify(originalSettings.weekoffRules)) {
        savePromises.push(saveSettingSilent('weekoff_rules', weekoffRules));
      }
      if (originalSettings && JSON.stringify(minStaff) !== JSON.stringify(originalSettings.minStaff)) {
        savePromises.push(saveSettingSilent('min_staff_per_shift', minStaff));
      }
      if (originalSettings && JSON.stringify(maxStaff) !== JSON.stringify(originalSettings.maxStaff)) {
        savePromises.push(saveSettingSilent('max_staff_per_shift', maxStaff));
      }
      if (originalSettings && JSON.stringify(rotationRules) !== JSON.stringify(originalSettings.rotationRules)) {
        savePromises.push(saveSettingSilent('rotation_rules', rotationRules));
      }
      
      await Promise.all(savePromises);
      
      // Update original settings
      setOriginalSettings({
        weekoffRules,
        minStaff,
        maxStaff,
        rotationRules,
      });
      setHasUnsavedChanges(false);
      toast.success('All settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Save setting without toast (for batch saves)
  async function saveSettingSilent(key: string, value: unknown) {
    const { data: existing } = await supabase
      .from('infra_team_settings')
      .select('id')
      .eq('setting_key', key)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase
        .from('infra_team_settings')
        .update({ setting_value: value as any })
        .eq('setting_key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('infra_team_settings')
        .insert({ setting_key: key, setting_value: value } as any);
      if (error) throw error;
    }
  }

  async function saveSetting(key: string, value: unknown) {
    setSaving(true);
    try {
      // First check if the setting exists
      const { data: existing } = await supabase
        .from('infra_team_settings')
        .select('id')
        .eq('setting_key', key)
        .maybeSingle();
      
      if (existing) {
        // Update existing setting
        const { error } = await supabase
          .from('infra_team_settings')
          .update({ setting_value: value as any })
          .eq('setting_key', key);
        
        if (error) throw error;
      } else {
        // Insert new setting using raw insert with type cast
        const insertData = {
          setting_key: key,
          setting_value: value
        };
        
        const { error } = await supabase
          .from('infra_team_settings')
          .insert(insertData as any);
        
        if (error) throw error;
      }
      
      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function saveDCRoleAvailability(dcIds: string[], role: string, field: keyof DCRoleAvailability, value: boolean) {
    try {
      // Update for all selected datacenters
      for (const dcId of dcIds) {
        const existing = dcRoleAvailability.find(r => r.datacenter_id === dcId && r.role === role);
        
        if (existing) {
          const { error } = await supabase
            .from('dc_role_shift_availability')
            .update({ [field]: value })
            .eq('id', existing.id);
          
          if (error) throw error;
          
          setDcRoleAvailability(prev => 
            prev.map(r => r.id === existing.id ? { ...r, [field]: value } : r)
          );
        } else {
          const newEntry = {
            datacenter_id: dcId,
            role,
            morning_shift: field === 'morning_shift' ? value : true,
            afternoon_shift: field === 'afternoon_shift' ? value : true,
            night_shift: field === 'night_shift' ? value : true,
            general_shift: field === 'general_shift' ? value : false,
          };
          
          const { data, error } = await supabase
            .from('dc_role_shift_availability')
            .insert(newEntry)
            .select()
            .single();
          
          if (error) throw error;
          setDcRoleAvailability(prev => [...prev, data]);
        }
      }
      
      const dcCount = dcIds.length;
      toast.success(`Updated ${role} shift availability for ${dcCount} datacenter${dcCount > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error saving DC role availability:', error);
      toast.error('Failed to update');
    }
  }

  // Toggle datacenter selection
  function toggleDCSelection(dcId: string) {
    setSelectedDCs(prev => {
      if (prev.includes(dcId)) {
        return prev.filter(id => id !== dcId);
      } else {
        return [...prev, dcId];
      }
    });
  }

  // Select/deselect all datacenters
  function toggleAllDCs() {
    if (selectedDCs.length === datacenters.length) {
      setSelectedDCs([]);
    } else {
      setSelectedDCs(datacenters.map(dc => dc.id));
    }
  }

  // Get combined availability across selected DCs (shows if ALL selected DCs have it enabled)
  function getCombinedRoleAvailability(role: string): DCRoleAvailability {
    if (selectedDCs.length === 0) {
      return {
        datacenter_id: '',
        role,
        morning_shift: true,
        afternoon_shift: true,
        night_shift: true,
        general_shift: false
      };
    }

    const availabilities = selectedDCs.map(dcId => getRoleAvailability(dcId, role));
    
    return {
      datacenter_id: selectedDCs[0],
      role,
      morning_shift: availabilities.every(a => a.morning_shift),
      afternoon_shift: availabilities.every(a => a.afternoon_shift),
      night_shift: availabilities.every(a => a.night_shift),
      general_shift: availabilities.every(a => a.general_shift)
    };
  }

  // Check if there's mixed state across selected DCs
  function hasMixedState(role: string, field: keyof DCRoleAvailability): boolean {
    if (selectedDCs.length <= 1) return false;
    const values = selectedDCs.map(dcId => getRoleAvailability(dcId, role)[field]);
    return !values.every(v => v === values[0]);
  }

  function getRoleAvailability(dcId: string, role: string): DCRoleAvailability {
    const existing = dcRoleAvailability.find(r => r.datacenter_id === dcId && r.role === role);
    return existing || {
      datacenter_id: dcId,
      role,
      morning_shift: true,
      afternoon_shift: true,
      night_shift: true,
      general_shift: false
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Alert & Save All Button */}
      {hasUnsavedChanges && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">You have unsaved changes</span>
            <Button 
              onClick={saveAllSettings} 
              disabled={saving}
              size="sm"
              className="ml-4"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save All Changes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-2 bg-muted/50 p-1">
          <TabsTrigger value="weekoff" className="flex items-center gap-2">
            <CalendarDays size={16} />
            <span className="hidden sm:inline">Week-Off Rules</span>
            <span className="sm:hidden">Week-Off</span>
          </TabsTrigger>
          <TabsTrigger value="staffing" className="flex items-center gap-2">
            <Users size={16} />
            <span className="hidden sm:inline">Staff Limits</span>
            <span className="sm:hidden">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="rotation" className="flex items-center gap-2">
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Rotation</span>
            <span className="sm:hidden">Rotation</span>
          </TabsTrigger>
          <TabsTrigger value="dc-roles" className="flex items-center gap-2">
            <Building2 size={16} />
            <span className="hidden sm:inline">DC Role Availability</span>
            <span className="sm:hidden">DC Roles</span>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-2">
            <ArrowRightLeft size={16} />
            <span className="hidden sm:inline">DC Transfers</span>
            <span className="sm:hidden">Transfers</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History size={16} />
            <span className="hidden sm:inline">Transfer History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Week-Off Rules Tab */}
        <TabsContent value="weekoff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Week-Off Rules for Infra Team
              </CardTitle>
              <CardDescription>
                Configure weekly off policies for datacenter staff
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Minimum Week-Offs per Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={weekoffRules.min_weekoff_per_month}
                    onChange={(e) => setWeekoffRules(prev => ({ 
                      ...prev, 
                      min_weekoff_per_month: parseInt(e.target.value) || 4 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Week-Offs per Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={15}
                    value={weekoffRules.max_weekoff_per_month}
                    onChange={(e) => setWeekoffRules(prev => ({ 
                      ...prev, 
                      max_weekoff_per_month: parseInt(e.target.value) || 8 
                    }))}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Allow Consecutive Week-Offs</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow staff to have multiple consecutive days off
                  </p>
                </div>
                <Switch
                  checked={weekoffRules.consecutive_weekoff_allowed}
                  onCheckedChange={(checked) => setWeekoffRules(prev => ({ 
                    ...prev, 
                    consecutive_weekoff_allowed: checked 
                  }))}
                />
              </div>
              
              {weekoffRules.consecutive_weekoff_allowed && (
                <div className="space-y-2">
                  <Label>Maximum Consecutive Week-Offs</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={weekoffRules.max_consecutive_weekoff}
                    onChange={(e) => setWeekoffRules(prev => ({ 
                      ...prev, 
                      max_consecutive_weekoff: parseInt(e.target.value) || 2 
                    }))}
                  />
                </div>
              )}
              
              {/* Split Week-Off Option */}
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Allow Split Week-Offs</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow week-offs to be split across non-consecutive days (e.g., 1 day + 1 day instead of 2 consecutive)
                  </p>
                </div>
                <Switch
                  checked={weekoffRules.split_weekoff_allowed}
                  onCheckedChange={(checked) => setWeekoffRules(prev => ({ 
                    ...prev, 
                    split_weekoff_allowed: checked 
                  }))}
                />
              </div>
              
              {weekoffRules.split_weekoff_allowed && (
                <div className="space-y-2">
                  <Label>Split Pattern (days per week-off block)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={3}
                      className="w-20"
                      value={weekoffRules.split_weekoff_days?.[0] || 1}
                      onChange={(e) => setWeekoffRules(prev => ({ 
                        ...prev, 
                        split_weekoff_days: [parseInt(e.target.value) || 1, prev.split_weekoff_days?.[1] || 1]
                      }))}
                    />
                    <span className="text-muted-foreground">+</span>
                    <Input
                      type="number"
                      min={1}
                      max={3}
                      className="w-20"
                      value={weekoffRules.split_weekoff_days?.[1] || 1}
                      onChange={(e) => setWeekoffRules(prev => ({ 
                        ...prev, 
                        split_weekoff_days: [prev.split_weekoff_days?.[0] || 1, parseInt(e.target.value) || 1]
                      }))}
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: 1 + 1 means one day off, then work days, then another day off
                  </p>
                </div>
              )}
              
              <Button 
                onClick={() => saveSetting('weekoff_rules', weekoffRules)}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Week-Off Rules
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Limits Tab */}
        <TabsContent value="staffing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Requirements per Shift
              </CardTitle>
              <CardDescription>
                Set minimum and maximum staff counts for each shift type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift Type</TableHead>
                    <TableHead>Minimum Staff</TableHead>
                    <TableHead>Maximum Staff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['morning', 'afternoon', 'night', 'general'].map((shift) => (
                    <TableRow key={shift}>
                      <TableCell>
                        <span className="font-medium text-foreground capitalize">{shift}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          className="w-20"
                          value={minStaff[shift as keyof StaffPerShift]}
                          onChange={(e) => setMinStaff(prev => ({ 
                            ...prev, 
                            [shift]: parseInt(e.target.value) || 1 
                          }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="w-20"
                          value={maxStaff[shift as keyof StaffPerShift]}
                          onChange={(e) => setMaxStaff(prev => ({ 
                            ...prev, 
                            [shift]: parseInt(e.target.value) || 10 
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={() => saveSetting('min_staff_per_shift', minStaff)}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Min Staff
                </Button>
                <Button 
                  onClick={() => saveSetting('max_staff_per_shift', maxStaff)}
                  disabled={saving}
                  variant="outline"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Max Staff
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rotation Tab */}
        <TabsContent value="rotation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Shift Rotation Rules
              </CardTitle>
              <CardDescription>
                Configure how shifts rotate for infra team members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label>Enable Shift Rotation</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically rotate staff through different shifts
                  </p>
                </div>
                <Switch
                  checked={rotationRules.rotation_enabled}
                  onCheckedChange={(checked) => setRotationRules(prev => ({ 
                    ...prev, 
                    rotation_enabled: checked 
                  }))}
                />
              </div>
              
              {rotationRules.rotation_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Rotation Cycle (Days)</Label>
                    <Input
                      type="number"
                      min={7}
                      max={30}
                      value={rotationRules.rotation_cycle_days}
                      onChange={(e) => setRotationRules(prev => ({ 
                        ...prev, 
                        rotation_cycle_days: parseInt(e.target.value) || 15 
                      }))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of days before rotating to the next shift
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Shift Sequence</Label>
                    <div className="flex gap-2 flex-wrap">
                      {rotationRules.shift_sequence.map((shift, index) => (
                        <Badge key={index} variant="secondary" className="capitalize">
                          {index + 1}. {shift}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Order in which shifts rotate
                    </p>
                  </div>
                </>
              )}
              
              <Button 
                onClick={() => saveSetting('rotation_rules', rotationRules)}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Rotation Rules
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DC Role Availability Tab */}
        <TabsContent value="dc-roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datacenter Role-Based Shift Availability
              </CardTitle>
              <CardDescription>
                Configure which roles can work specific shifts at each datacenter. 
                Select multiple datacenters to apply settings to all of them at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Multi-select datacenter chips */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Datacenters:</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllDCs}
                  >
                    {selectedDCs.length === datacenters.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {datacenters.map(dc => {
                    const isSelected = selectedDCs.includes(dc.id);
                    return (
                      <Badge
                        key={dc.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer px-3 py-1.5 text-sm transition-all duration-200 select-none",
                          isSelected && "ring-2 ring-primary/20 ring-offset-1 animate-scale-in",
                          !isSelected && "hover:bg-muted"
                        )}
                        onClick={() => toggleDCSelection(dc.id)}
                      >
                        {isSelected && <Check className="mr-1.5 h-3 w-3" />}
                        {dc.name} ({dc.code})
                      </Badge>
                    );
                  })}
                </div>
                {selectedDCs.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    <Info className="inline h-3 w-3 mr-1" />
                    Changes will apply to all {selectedDCs.length} selected datacenters
                  </p>
                )}
              </div>
              
              {selectedDCs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Morning</TableHead>
                      <TableHead className="text-center">Afternoon</TableHead>
                      <TableHead className="text-center">Night</TableHead>
                      <TableHead className="text-center">General</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {INFRA_ROLES.map(role => {
                      const availability = getCombinedRoleAvailability(role);
                      return (
                        <TableRow key={role}>
                          <TableCell>
                            <span className="font-medium text-foreground">{role}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Switch
                                checked={availability.morning_shift}
                                onCheckedChange={(checked) => 
                                  saveDCRoleAvailability(selectedDCs, role, 'morning_shift', checked)
                                }
                              />
                              {hasMixedState(role, 'morning_shift') && (
                                <span className="text-xs text-yellow-600" title="Mixed settings across selected DCs">⚠</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Switch
                                checked={availability.afternoon_shift}
                                onCheckedChange={(checked) => 
                                  saveDCRoleAvailability(selectedDCs, role, 'afternoon_shift', checked)
                                }
                              />
                              {hasMixedState(role, 'afternoon_shift') && (
                                <span className="text-xs text-yellow-600" title="Mixed settings across selected DCs">⚠</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Switch
                                checked={availability.night_shift}
                                onCheckedChange={(checked) => 
                                  saveDCRoleAvailability(selectedDCs, role, 'night_shift', checked)
                                }
                              />
                              {hasMixedState(role, 'night_shift') && (
                                <span className="text-xs text-yellow-600" title="Mixed settings across selected DCs">⚠</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Switch
                                checked={availability.general_shift}
                                onCheckedChange={(checked) => 
                                  saveDCRoleAvailability(selectedDCs, role, 'general_shift', checked)
                                }
                              />
                              {hasMixedState(role, 'general_shift') && (
                                <span className="text-xs text-yellow-600" title="Mixed settings across selected DCs">⚠</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {selectedDCs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Select at least one datacenter to configure role shift availability
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DC Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Staff DC Transfers
              </CardTitle>
              <CardDescription>
                Transfer staff between datacenters for specific shifts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Create New Transfer
              </Button>
              
              <DCStaffTransferDialog 
                open={transferDialogOpen} 
                onOpenChange={setTransferDialogOpen}
                datacenters={datacenters}
                onSuccess={fetchData}
              />
              
              {/* Transfer list will be added here */}
              <DCTransferList datacenters={datacenters} />
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">About DC Transfers</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    DC transfers allow you to temporarily assign staff from one datacenter to another 
                    for specific shifts. This is useful for covering shortages or special requirements. 
                    The transfer includes the date, shift type, and reason for the move.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer History Tab */}
        <TabsContent value="history" className="space-y-4">
          <DCTransferHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component to display existing transfers
function DCTransferList({ datacenters }: { datacenters: Datacenter[] }) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  async function fetchTransfers() {
    setLoading(true);
    try {
      const { data: transferData, error: transferError } = await supabase
        .from('dc_staff_transfers')
        .select('*')
        .order('transfer_date', { ascending: false });
      
      if (transferError) throw transferError;
      setTransfers(transferData || []);
      
      // Fetch members for display
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, department')
        .eq('department', 'Infra');
      
      if (memberError) throw memberError;
      setMembers(memberData || []);
      
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  }

  function getMemberName(memberId: string) {
    return members.find(m => m.id === memberId)?.name || memberId;
  }

  function getDCName(dcId: string | null) {
    if (!dcId) return 'Home DC';
    return datacenters.find(dc => dc.id === dcId)?.name || dcId;
  }

  async function cancelTransfer(id: string) {
    try {
      const { error } = await supabase
        .from('dc_staff_transfers')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Transfer cancelled');
      fetchTransfers();
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      toast.error('Failed to cancel transfer');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No DC transfers scheduled. Create one to temporarily move staff between datacenters.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff Member</TableHead>
          <TableHead>From DC</TableHead>
          <TableHead>To DC</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Shift</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.map(transfer => (
          <TableRow key={transfer.id}>
            <TableCell className="font-medium">{getMemberName(transfer.member_id)}</TableCell>
            <TableCell>{getDCName(transfer.source_datacenter_id)}</TableCell>
            <TableCell>{getDCName(transfer.target_datacenter_id)}</TableCell>
            <TableCell>{new Date(transfer.transfer_date).toLocaleDateString()}</TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">{transfer.shift_type}</Badge>
            </TableCell>
            <TableCell className="max-w-[200px] truncate">{transfer.reason}</TableCell>
            <TableCell>
              <Badge 
                variant={transfer.status === 'active' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {transfer.status}
              </Badge>
            </TableCell>
            <TableCell>
              {transfer.status === 'active' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => cancelTransfer(transfer.id)}
                >
                  Cancel
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
