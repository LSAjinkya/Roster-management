import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Home,
  Building2,
  Loader2,
  MapPin,
  Calendar,
  Mail,
  User,
  Users,
  Briefcase,
  Circle,
  ExternalLink,
  Clock,
  CalendarDays,
  Edit2,
  Save,
  Camera,
  Phone,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, WorkLocation, Role, Department, ROLES, DEPARTMENTS } from '@/types/roster';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ImageCropper } from './ImageCropper';

interface LeaveBalance {
  casual_leave_total: number;
  casual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  public_holidays_total: number;
  public_holidays_used: number;
}

interface MemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  workLocations: WorkLocation[];
  allMembers: TeamMember[];
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  'available': { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  'on-leave': { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  'unavailable': { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
};

export function MemberDetailDialog({
  open,
  onOpenChange,
  member,
  workLocations,
  allMembers,
  onUpdate,
}: MemberDetailDialogProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [currentShift, setCurrentShift] = useState<string | null>(null);
  
  // Image cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<Role>('L1');
  const [department, setDepartment] = useState<Department>('Infra');
  const [team, setTeam] = useState<string | null>(null);
  const [reportingTLId, setReportingTLId] = useState<string | null>(null);
  const [weekOffEntitlement, setWeekOffEntitlement] = useState<1 | 2>(2);
  const [isHybrid, setIsHybrid] = useState(false);
  const [officeDaysPattern, setOfficeDaysPattern] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workLocationId, setWorkLocationId] = useState<string | null>(null);

  const WEEKDAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
  ];

  // Derive WFH days from office days
  const wfhDaysPattern = WEEKDAYS.map(d => d.value).filter(d => !officeDaysPattern.includes(d));

  // Office locations only (exclude datacenters for hybrid users)
  const officeLocations = workLocations.filter(l => l.location_type === 'office' || l.location_type === 'remote');
  
  // Get TL options for reporting
  const tlOptions = allMembers.filter(m => m.role === 'TL' && m.id !== member?.id);

  useEffect(() => {
    if (member && open) {
      setName(member.name);
      setEmail(member.email);
      setPhoneNumber(member.phoneNumber || '');
      setRole(member.role);
      setDepartment(member.department);
      setTeam(member.team || null);
      setReportingTLId(member.reportingTLId || null);
      setWeekOffEntitlement(member.weekOffEntitlement || 2);
      setIsHybrid(member.isHybrid || false);
      // Convert WFH days to office days (inverse)
      const wfhPattern = member.hybridWfhDaysPattern || [];
      const allDays = [1, 2, 3, 4, 5];
      const derivedOfficeDays = wfhPattern.length > 0 
        ? allDays.filter(d => !wfhPattern.includes(d))
        : allDays;
      setOfficeDaysPattern(derivedOfficeDays);
      setWorkLocationId(member.workLocationId || null);
      setAvatarUrl(member.avatarUrl || null);
      setEditMode(false);
      
      fetchLeaveBalance();
      checkCurrentShift();
      checkOnlineStatus();
    }
  }, [member, open]);

  const fetchLeaveBalance = async () => {
    if (!member) return;
    
    setLoadingLeaves(true);
    try {
      // Find the profile for this member to get user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', member.email)
        .maybeSingle();

      if (profile?.user_id) {
        const currentYear = new Date().getFullYear();
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('user_id', profile.user_id)
          .eq('year', currentYear)
          .maybeSingle();

        setLeaveBalance(balance);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const checkCurrentShift = async () => {
    if (!member) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('shift_assignments')
        .select('shift_type')
        .eq('member_id', member.id)
        .eq('date', today)
        .maybeSingle();

      setCurrentShift(data?.shift_type || null);
    } catch (error) {
      console.error('Error checking shift:', error);
    }
  };

  const checkOnlineStatus = async () => {
    if (!member) return;
    
    // Check if member is in shift today and shift is active
    const now = new Date();
    const hour = now.getHours();
    
    // Simple logic: if user has a shift today and we're in typical working hours, consider online
    // This could be enhanced with actual login tracking
    if (currentShift) {
      const shiftHours: Record<string, [number, number]> = {
        morning: [6, 14],
        afternoon: [14, 22],
        night: [22, 6],
        general: [9, 18],
      };
      
      const hours = shiftHours[currentShift];
      if (hours) {
        if (currentShift === 'night') {
          setIsOnline(hour >= hours[0] || hour < hours[1]);
        } else {
          setIsOnline(hour >= hours[0] && hour < hours[1]);
        }
      }
    } else {
      setIsOnline(false);
    }
  };

  const toggleOfficeDay = (day: number) => {
    setOfficeDaysPattern(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!member) return;

    const officeDaysCount = officeDaysPattern.length;
    const wfhDaysCount = wfhDaysPattern.length;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          name,
          email,
          phone_number: phoneNumber || null,
          role,
          department,
          team,
          reporting_tl_id: reportingTLId,
          week_off_entitlement: weekOffEntitlement,
          is_hybrid: isHybrid,
          hybrid_office_days: isHybrid ? officeDaysCount : 5,
          hybrid_wfh_days: isHybrid ? wfhDaysCount : 0,
          hybrid_wfh_days_pattern: isHybrid && wfhDaysPattern.length > 0 ? wfhDaysPattern : null,
          work_location_id: workLocationId,
        })
        .eq('id', member.id);

      if (error) throw error;

      toast.success('Member updated successfully');
      setEditMode(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating member:', error);
      toast.error('Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!member) return;

    setUploadingAvatar(true);
    try {
      const fileName = `${member.id}/avatar_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('email', member.email);

      setAvatarUrl(publicUrl);
      toast.success('Avatar updated successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getLocationName = (locationId?: string | null) => {
    if (!locationId) return 'Unassigned';
    const loc = workLocations.find(l => l.id === locationId);
    return loc ? `${loc.name}${loc.city ? ` (${loc.city})` : ''}` : 'Unknown';
  };

  const getReportingTLName = () => {
    if (!member?.reportingTLId) return 'None';
    const tl = allMembers.find(m => m.id === member.reportingTLId);
    return tl?.name || 'Unknown';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navigateToLeaves = () => {
    navigate('/leave-requests');
    onOpenChange(false);
  };

  if (!member) return null;

  const statusInfo = STATUS_COLORS[member.status] || STATUS_COLORS['available'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Member Details</DialogTitle>
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => editMode ? handleSave() : setEditMode(true)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : editMode ? (
                <Save size={14} className="mr-2" />
              ) : (
                <Edit2 size={14} className="mr-2" />
              )}
              {editMode ? 'Save' : 'Edit'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Profile Header */}
          <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg mb-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={member.name} />}
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              {editMode && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editMode ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xl font-semibold h-8"
                  />
                ) : (
                  <h2 className="text-xl font-semibold">{member.name}</h2>
                )}
                <div className="flex items-center gap-2">
                  <Circle className={`h-2.5 w-2.5 fill-current ${isOnline ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Mail size={14} />
                {editMode ? (
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-7 text-sm"
                  />
                ) : (
                  <span className="text-sm">{member.email}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${statusInfo.bg} ${statusInfo.text} border-0`}>
                  <Circle className={`h-2 w-2 fill-current mr-1 ${statusInfo.dot}`} />
                  {member.status.replace('-', ' ')}
                </Badge>
                {currentShift && (
                  <Badge variant="outline" className="gap-1">
                    <Clock size={12} />
                    {currentShift.charAt(0).toUpperCase() + currentShift.slice(1)} Shift
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
              <TabsTrigger value="work" className="flex-1">Work Settings</TabsTrigger>
              <TabsTrigger value="leaves" className="flex-1">Leaves</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 pt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase size={14} />
                    Role / Designation
                  </Label>
                  {editMode ? (
                    <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{member.role}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Building2 size={14} />
                    Department
                  </Label>
                  {editMode ? (
                    <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{member.department}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Users size={14} />
                    Team
                  </Label>
                  {editMode ? (
                    <Select value={team || 'none'} onValueChange={(v) => setTeam(v === 'none' ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="none">No Team</SelectItem>
                        <SelectItem value="Alpha">Alpha</SelectItem>
                        <SelectItem value="Beta">Beta</SelectItem>
                        <SelectItem value="Gamma">Gamma</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{member.team || 'Not assigned'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <MapPin size={14} />
                    Work Location
                  </Label>
                  {editMode ? (
                    <Select
                      value={workLocationId || 'unassigned'}
                      onValueChange={(v) => setWorkLocationId(v === 'unassigned' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {workLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} {loc.city && `(${loc.city})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{getLocationName(member.workLocationId)}</p>
                  )}
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <User size={14} />
                    Reporting TL
                  </Label>
                  {editMode ? (
                    <Select
                      value={reportingTLId || 'none'}
                      onValueChange={(v) => setReportingTLId(v === 'none' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select TL" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="none">No TL</SelectItem>
                        {tlOptions.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.name} ({tl.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{getReportingTLName()}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="work" className="space-y-4 pt-4">
              {/* Week-Off Entitlement */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar size={14} />
                  Week-Off Entitlement
                </Label>
                {editMode ? (
                  <Select
                    value={String(weekOffEntitlement)}
                    onValueChange={(v) => setWeekOffEntitlement(parseInt(v) as 1 | 2)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="1">1 day per week</SelectItem>
                      <SelectItem value="2">2 days per week</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{member.weekOffEntitlement || 2} day(s) per week</p>
                )}
              </div>

              <Separator />

              {/* Hybrid Working */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Hybrid Working</Label>
                  <p className="text-sm text-muted-foreground">
                    Split between office and work from home
                  </p>
                </div>
                {editMode ? (
                  <Switch checked={isHybrid} onCheckedChange={setIsHybrid} />
                ) : (
                  <Badge variant={member.isHybrid ? 'default' : 'secondary'}>
                    {member.isHybrid ? 'Yes' : 'No'}
                  </Badge>
                )}
              </div>

              {(editMode ? isHybrid : member.isHybrid) && (
                <div className="space-y-4 border-t pt-4">
                  {editMode ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Building2 size={14} />
                          Select Office Days
                        </Label>
                        <div className="flex gap-2 flex-wrap">
                          {WEEKDAYS.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleOfficeDay(day.value)}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                officeDaysPattern.includes(day.value)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted text-muted-foreground border-border hover:bg-secondary'
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Select days to work from office. Remaining days will be WFH.
                        </p>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                        <p className="text-foreground">
                          <strong>{officeDaysPattern.length} days from office</strong>
                          {officeDaysPattern.length > 0 && (
                            <span className="text-muted-foreground">
                              {' '}({officeDaysPattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                            </span>
                          )}
                        </p>
                        <p className="text-foreground">
                          <strong>{wfhDaysPattern.length} days from home</strong>
                          {wfhDaysPattern.length > 0 && (
                            <span className="text-muted-foreground">
                              {' '}({wfhDaysPattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">
                        <strong>{member.hybridOfficeDays || 5} days</strong> from office,{' '}
                        <strong>{member.hybridWfhDays || 0} days</strong> from home
                        {member.hybridWfhDaysPattern && member.hybridWfhDaysPattern.length > 0 && (
                          <span className="text-muted-foreground">
                            {' '}(WFH: {member.hybridWfhDaysPattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaves" className="space-y-4 pt-4">
              {loadingLeaves ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : leaveBalance ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs text-muted-foreground">Casual Leave</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-green-600">
                            {leaveBalance.casual_leave_total - leaveBalance.casual_leave_used}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            / {leaveBalance.casual_leave_total}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {leaveBalance.casual_leave_used} used
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs text-muted-foreground">Sick Leave</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-blue-600">
                            {leaveBalance.sick_leave_total - leaveBalance.sick_leave_used}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            / {leaveBalance.sick_leave_total}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {leaveBalance.sick_leave_used} used
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs text-muted-foreground">Public Holidays</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-purple-600">
                            {leaveBalance.public_holidays_total - leaveBalance.public_holidays_used}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            / {leaveBalance.public_holidays_total}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {leaveBalance.public_holidays_used} used
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={navigateToLeaves}
                  >
                    <CalendarDays size={16} />
                    View Leave Requests
                    <ExternalLink size={14} className="ml-auto" />
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No leave balance found for this year</p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={navigateToLeaves}
                  >
                    <CalendarDays size={16} />
                    View Leave Requests
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Image Cropper Dialog */}
      {imageToCrop && (
        <ImageCropper
          open={cropperOpen}
          onOpenChange={setCropperOpen}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          circularCrop={true}
        />
      )}
    </Dialog>
  );
}
