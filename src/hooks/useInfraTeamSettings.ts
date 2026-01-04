import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface DCRoleAvailability {
  id: string;
  datacenter_id: string;
  role: string;
  morning_shift: boolean;
  afternoon_shift: boolean;
  night_shift: boolean;
  general_shift: boolean;
}

export interface InfraTeamSettings {
  weekoffRules: WeekoffRules;
  minStaff: StaffPerShift;
  maxStaff: StaffPerShift;
  rotationRules: RotationRules;
  dcRoleAvailability: DCRoleAvailability[];
  loading: boolean;
}

const DEFAULT_WEEKOFF_RULES: WeekoffRules = {
  min_weekoff_per_month: 4,
  max_weekoff_per_month: 8,
  consecutive_weekoff_allowed: true,
  max_consecutive_weekoff: 2,
  split_weekoff_allowed: false,
  split_weekoff_days: [1, 1]
};

const DEFAULT_STAFF_MIN: StaffPerShift = { morning: 2, afternoon: 2, night: 2, general: 1 };
const DEFAULT_STAFF_MAX: StaffPerShift = { morning: 10, afternoon: 10, night: 8, general: 5 };

const DEFAULT_ROTATION_RULES: RotationRules = {
  rotation_enabled: true,
  rotation_cycle_days: 15,
  shift_sequence: ['afternoon', 'morning', 'night']
};

export function useInfraTeamSettings(): InfraTeamSettings {
  const [loading, setLoading] = useState(true);
  const [weekoffRules, setWeekoffRules] = useState<WeekoffRules>(DEFAULT_WEEKOFF_RULES);
  const [minStaff, setMinStaff] = useState<StaffPerShift>(DEFAULT_STAFF_MIN);
  const [maxStaff, setMaxStaff] = useState<StaffPerShift>(DEFAULT_STAFF_MAX);
  const [rotationRules, setRotationRules] = useState<RotationRules>(DEFAULT_ROTATION_RULES);
  const [dcRoleAvailability, setDcRoleAvailability] = useState<DCRoleAvailability[]>([]);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      try {
        // Fetch infra settings
        const { data: settings, error: settingsError } = await supabase
          .from('infra_team_settings')
          .select('*');
        
        if (settingsError) throw settingsError;
        
        settings?.forEach(setting => {
          const value = setting.setting_value as Record<string, unknown>;
          switch (setting.setting_key) {
            case 'weekoff_rules':
              setWeekoffRules(value as unknown as WeekoffRules);
              break;
            case 'min_staff_per_shift':
              setMinStaff(value as unknown as StaffPerShift);
              break;
            case 'max_staff_per_shift':
              setMaxStaff(value as unknown as StaffPerShift);
              break;
            case 'rotation_rules':
              setRotationRules(value as unknown as RotationRules);
              break;
          }
        });
        
        // Fetch DC role availability
        const { data: dcRoles, error: dcRolesError } = await supabase
          .from('dc_role_shift_availability')
          .select('*');
        
        if (dcRolesError) throw dcRolesError;
        setDcRoleAvailability(dcRoles || []);
        
      } catch (error) {
        console.error('Error fetching infra team settings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return {
    weekoffRules,
    minStaff,
    maxStaff,
    rotationRules,
    dcRoleAvailability,
    loading
  };
}

/**
 * Check if a role is eligible for a shift at a specific datacenter
 */
export function isRoleEligibleForShift(
  dcRoleAvailability: DCRoleAvailability[],
  datacenterId: string | null | undefined,
  role: string,
  shiftType: 'morning' | 'afternoon' | 'night' | 'general'
): boolean {
  // If no datacenter specified, use default behavior (allow all)
  if (!datacenterId) return true;

  const availability = dcRoleAvailability.find(
    r => r.datacenter_id === datacenterId && r.role === role
  );

  // If no specific configuration, default to allowing all rotational shifts
  if (!availability) {
    return shiftType !== 'general'; // Default: allow morning, afternoon, night
  }

  switch (shiftType) {
    case 'morning':
      return availability.morning_shift;
    case 'afternoon':
      return availability.afternoon_shift;
    case 'night':
      return availability.night_shift;
    case 'general':
      return availability.general_shift;
    default:
      return true;
  }
}
