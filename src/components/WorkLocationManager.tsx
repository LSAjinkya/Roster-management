import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, MapPin, Users, Moon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkLocation {
  id: string;
  name: string;
  code: string;
  address: string | null;
  min_night_shift_count: number;
  work_from_home_if_below_min: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function WorkLocationManager() {
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    min_night_shift_count: 2,
    work_from_home_if_below_min: true,
    is_active: true,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching work locations:', error);
      toast.error('Failed to load work locations');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      min_night_shift_count: 2,
      work_from_home_if_below_min: true,
      is_active: true,
    });
    setEditing(null);
  };

  const openDialog = (location?: WorkLocation) => {
    if (location) {
      setEditing(location);
      setFormData({
        name: location.name,
        code: location.code,
        address: location.address || '',
        min_night_shift_count: location.min_night_shift_count,
        work_from_home_if_below_min: location.work_from_home_if_below_min,
        is_active: location.is_active,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('work_locations')
          .update({
            name: formData.name,
            code: formData.code.toUpperCase(),
            address: formData.address || null,
            min_night_shift_count: formData.min_night_shift_count,
            work_from_home_if_below_min: formData.work_from_home_if_below_min,
            is_active: formData.is_active,
          })
          .eq('id', editing.id);
        
        if (error) throw error;
        toast.success('Work location updated');
      } else {
        const { error } = await supabase
          .from('work_locations')
          .insert({
            name: formData.name,
            code: formData.code.toUpperCase(),
            address: formData.address || null,
            min_night_shift_count: formData.min_night_shift_count,
            work_from_home_if_below_min: formData.work_from_home_if_below_min,
            is_active: formData.is_active,
          });
        
        if (error) throw error;
        toast.success('Work location added');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchLocations();
    } catch (error: any) {
      console.error('Error saving work location:', error);
      if (error.code === '23505') {
        toast.error('A location with this code already exists');
      } else {
        toast.error('Failed to save work location');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work location?')) return;
    
    try {
      const { error } = await supabase
        .from('work_locations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Work location deleted');
      fetchLocations();
    } catch (error) {
      console.error('Error deleting work location:', error);
      toast.error('Failed to delete work location. It may be in use.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Work Locations</h3>
          <p className="text-sm text-muted-foreground">
            Manage office/work locations and night shift requirements
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} size="sm" className="gap-2">
              <Plus size={16} />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Work Location' : 'Add Work Location'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mumbai Office"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="MUM"
                    maxLength={10}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address (optional)"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Minimum Night Shift Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.min_night_shift_count}
                  onChange={(e) => setFormData({ ...formData, min_night_shift_count: parseInt(e.target.value) || 2 })}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum people required for night shift at this location
                </p>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Work From Home if Below Minimum</p>
                  <p className="text-xs text-muted-foreground">
                    If night shift count is below minimum, assign WFH instead
                  </p>
                </div>
                <Switch
                  checked={formData.work_from_home_if_below_min}
                  onCheckedChange={(checked) => setFormData({ ...formData, work_from_home_if_below_min: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive locations won't appear in selections
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Update' : 'Add'} Location
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {locations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No work locations configured</p>
          <p className="text-sm">Add your first location to get started</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map((location) => (
            <Card key={location.id} className={!location.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin size={20} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{location.name}</span>
                        <Badge variant="outline" className="text-xs">{location.code}</Badge>
                        {!location.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {location.address && (
                        <p className="text-xs text-muted-foreground">{location.address}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Moon size={14} className="text-muted-foreground" />
                      <span>Min {location.min_night_shift_count} for night</span>
                    </div>
                    {location.work_from_home_if_below_min && (
                      <Badge variant="secondary" className="text-xs">WFH if below</Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(location)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(location.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
