-- Create table for DC staff transfers (shift-level transfers)
CREATE TABLE public.dc_staff_transfers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id TEXT NOT NULL,
    source_datacenter_id UUID REFERENCES public.datacenters(id) ON DELETE CASCADE,
    target_datacenter_id UUID NOT NULL REFERENCES public.datacenters(id) ON DELETE CASCADE,
    transfer_date DATE NOT NULL,
    shift_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dc_staff_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view DC transfers" ON public.dc_staff_transfers
    FOR SELECT USING (true);

CREATE POLICY "HR Admin TL can manage DC transfers" ON public.dc_staff_transfers
    FOR ALL USING (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'hr') OR 
        has_role(auth.uid(), 'tl')
    );

-- Create trigger for updated_at
CREATE TRIGGER update_dc_staff_transfers_updated_at
    BEFORE UPDATE ON public.dc_staff_transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for datacenter-specific role shift availability
CREATE TABLE public.dc_role_shift_availability (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    datacenter_id UUID NOT NULL REFERENCES public.datacenters(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    morning_shift BOOLEAN NOT NULL DEFAULT true,
    afternoon_shift BOOLEAN NOT NULL DEFAULT true,
    night_shift BOOLEAN NOT NULL DEFAULT true,
    general_shift BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(datacenter_id, role)
);

-- Enable RLS
ALTER TABLE public.dc_role_shift_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view DC role availability" ON public.dc_role_shift_availability
    FOR SELECT USING (true);

CREATE POLICY "HR Admin can manage DC role availability" ON public.dc_role_shift_availability
    FOR ALL USING (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'hr')
    );

-- Create trigger for updated_at
CREATE TRIGGER update_dc_role_shift_availability_updated_at
    BEFORE UPDATE ON public.dc_role_shift_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for infra team global settings (week-off, rotation, staffing)
CREATE TABLE public.infra_team_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.infra_team_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view infra settings" ON public.infra_team_settings
    FOR SELECT USING (true);

CREATE POLICY "HR Admin can manage infra settings" ON public.infra_team_settings
    FOR ALL USING (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'hr')
    );

-- Create trigger for updated_at
CREATE TRIGGER update_infra_team_settings_updated_at
    BEFORE UPDATE ON public.infra_team_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default infra team settings
INSERT INTO public.infra_team_settings (setting_key, setting_value, description) VALUES
('weekoff_rules', '{"min_weekoff_per_month": 4, "max_weekoff_per_month": 8, "consecutive_weekoff_allowed": true, "max_consecutive_weekoff": 2}', 'Week-off rules for infra team'),
('min_staff_per_shift', '{"morning": 2, "afternoon": 2, "night": 2}', 'Minimum staff required per shift'),
('max_staff_per_shift', '{"morning": 10, "afternoon": 10, "night": 8}', 'Maximum staff allowed per shift'),
('rotation_rules', '{"rotation_enabled": true, "rotation_cycle_days": 15, "shift_sequence": ["afternoon", "morning", "night"]}', 'Shift rotation rules for infra team');