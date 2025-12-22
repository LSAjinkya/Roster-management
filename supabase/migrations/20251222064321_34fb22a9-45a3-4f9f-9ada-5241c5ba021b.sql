-- Add shift sequence tracking and member rotation state
ALTER TABLE rotation_config 
ADD COLUMN IF NOT EXISTS shift_sequence text[] DEFAULT ARRAY['afternoon', 'morning', 'night'];

-- Create table to track each member's rotation state
CREATE TABLE IF NOT EXISTS member_rotation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  current_shift_type text NOT NULL DEFAULT 'afternoon',
  cycle_start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

-- Enable RLS
ALTER TABLE member_rotation_state ENABLE ROW LEVEL SECURITY;

-- Anyone can view rotation state
CREATE POLICY "Anyone can view member rotation state" ON member_rotation_state
FOR SELECT USING (true);

-- HR, Admin, TL can manage rotation state
CREATE POLICY "HR Admin TL can manage rotation state" ON member_rotation_state
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role)
);

-- Add trigger for updated_at
CREATE TRIGGER update_member_rotation_state_updated_at
BEFORE UPDATE ON member_rotation_state
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();