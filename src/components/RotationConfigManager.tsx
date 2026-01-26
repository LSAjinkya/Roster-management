import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Save, RotateCcw, ArrowRight, GripVertical } from 'lucide-react';
import { RotationConfig } from '@/types/shiftRules';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
const SHIFT_TYPE_COLORS: Record<string, string> = {
  'afternoon': 'bg-amber-500 text-white',
  'morning': 'bg-blue-500 text-white',
  'night': 'bg-purple-600 text-white'
};
const SHIFT_TYPE_LABELS: Record<string, string> = {
  'afternoon': 'Afternoon (13:00-22:00)',
  'morning': 'Morning (07:00-16:00)',
  'night': 'Night (21:00-07:00)'
};
type ExtendedRotationConfig = Omit<RotationConfig, 'shift_sequence'> & {
  shift_sequence?: string[];
};
export function RotationConfigManager() {
  const [config, setConfig] = useState<ExtendedRotationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchConfig();
  }, []);
  const fetchConfig = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('rotation_config').select('*').eq('is_active', true).maybeSingle();
      if (error) throw error;

      // Ensure shift_sequence has a default
      const configData = data as ExtendedRotationConfig | null;
      if (configData && !configData.shift_sequence) {
        configData.shift_sequence = ['afternoon', 'morning', 'night'];
      }
      setConfig(configData);
    } catch (error) {
      console.error('Error fetching rotation config:', error);
      toast.error('Failed to load rotation configuration');
    } finally {
      setLoading(false);
    }
  };
  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const {
        error
      } = await supabase.from('rotation_config').update({
        rotation_cycle_days: config.rotation_cycle_days,
        max_consecutive_nights: config.max_consecutive_nights,
        min_rest_hours: config.min_rest_hours,
        work_days: config.work_days,
        off_days: config.off_days,
        shift_sequence: config.shift_sequence
      }).eq('id', config.id);
      if (error) throw error;
      toast.success('Configuration saved');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };
  const handleReset = () => {
    setConfig(prev => prev ? {
      ...prev,
      rotation_cycle_days: 15,
      max_consecutive_nights: 5,
      min_rest_hours: 12,
      work_days: 5,
      off_days: 2,
      shift_sequence: ['afternoon', 'morning', 'night']
    } : null);
  };
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !config?.shift_sequence) return;
    const items = Array.from(config.shift_sequence);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setConfig({
      ...config,
      shift_sequence: items
    });
  };
  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading configuration...</div>;
  }
  if (!config) {
    return <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No rotation configuration found. Please contact an administrator.
          </p>
        </CardContent>
      </Card>;
  }
  const shiftSequence = config.shift_sequence || ['afternoon', 'morning', 'night'];
  return <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              2-Week Shift Rotation
            </CardTitle>
            <CardDescription>
              Configure 14-day shift cycle: 5 Work → 2 OFF → 5 Work → 2 OFF → Rotate
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw size={16} />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Shift Rotation Sequence */}
        <div className="space-y-4 p-4 rounded-lg border">
          <h3 className="font-medium">Shift Rotation Sequence</h3>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. Each member works 14 days (10 work + 4 OFF) in one shift, then rotates to the next.
          </p>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="shifts" direction="horizontal">
              {provided => <div {...provided.droppableProps} ref={provided.innerRef} className="flex items-center gap-2 flex-wrap">
                  {shiftSequence.map((shift, index) => <Draggable key={shift} draggableId={shift} index={index}>
                      {(provided, snapshot) => <div className="flex items-center gap-2">
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab ${SHIFT_TYPE_COLORS[shift]} ${snapshot.isDragging ? 'shadow-lg' : ''}`}>
                            <GripVertical size={14} />
                            <span className="font-medium">{SHIFT_TYPE_LABELS[shift]}</span>
                          </div>
                          {index < shiftSequence.length - 1 && <ArrowRight size={20} className="text-muted-foreground" />}
                        </div>}
                    </Draggable>)}
                  {provided.placeholder}
                </div>}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Cycle Configuration */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 p-4 rounded-lg border">
            <h3 className="font-medium">14-Day Shift Cycle</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Total Cycle Length</Label>
                <span className="text-sm font-medium">14 days per shift</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Block 1:</strong> 5 Work Days → 2 OFF Days</p>
                <p><strong>Block 2:</strong> 5 Work Days → 2 OFF Days</p>
                <p><strong>Then:</strong> Rotate to next shift</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Work Days per Shift</Label>
                <span className="text-sm font-medium">10 days (5+5)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Two blocks of 5 consecutive working days
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>OFF Days per Shift</Label>
                <span className="text-sm font-medium">4 days (2+2)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Two blocks of 2 consecutive OFF days
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg border">
            <h3 className="font-medium">Safety Constraints</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Max Consecutive Night Shifts</Label>
                <span className="text-sm font-medium">{config.max_consecutive_nights} nights</span>
              </div>
              <Slider value={[config.max_consecutive_nights]} onValueChange={([v]) => setConfig({
              ...config,
              max_consecutive_nights: v
            })} min={1} max={15} step={1} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Rest Hours</Label>
                <span className="text-sm font-medium">{config.min_rest_hours} hours</span>
              </div>
              <Slider value={[config.min_rest_hours]} onValueChange={([v]) => setConfig({
              ...config,
              min_rest_hours: v
            })} min={8} max={16} step={1} />
            </div>
          </div>
        </div>

        {/* Example Pattern */}
        
      </CardContent>
    </Card>;
}