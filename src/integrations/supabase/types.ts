export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      datacenters: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dc_role_shift_availability: {
        Row: {
          afternoon_shift: boolean
          created_at: string
          datacenter_id: string
          general_shift: boolean
          id: string
          morning_shift: boolean
          night_shift: boolean
          role: string
          updated_at: string
        }
        Insert: {
          afternoon_shift?: boolean
          created_at?: string
          datacenter_id: string
          general_shift?: boolean
          id?: string
          morning_shift?: boolean
          night_shift?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          afternoon_shift?: boolean
          created_at?: string
          datacenter_id?: string
          general_shift?: boolean
          id?: string
          morning_shift?: boolean
          night_shift?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dc_role_shift_availability_datacenter_id_fkey"
            columns: ["datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
        ]
      }
      dc_staff_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          reason: string
          shift_type: string
          source_datacenter_id: string | null
          status: string
          target_datacenter_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          reason: string
          shift_type: string
          source_datacenter_id?: string | null
          status?: string
          target_datacenter_id: string
          transfer_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          reason?: string
          shift_type?: string
          source_datacenter_id?: string | null
          status?: string
          target_datacenter_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dc_staff_transfers_source_datacenter_id_fkey"
            columns: ["source_datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_staff_transfers_target_datacenter_id_fkey"
            columns: ["target_datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          fixed_off_days: string[] | null
          head_member_id: string | null
          id: string
          is_active: boolean
          name: string
          off_days_per_cycle: number
          rotation_enabled: boolean
          updated_at: string
          week_off_pattern: string | null
          work_days_per_cycle: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          fixed_off_days?: string[] | null
          head_member_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          off_days_per_cycle?: number
          rotation_enabled?: boolean
          updated_at?: string
          week_off_pattern?: string | null
          work_days_per_cycle?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          fixed_off_days?: string[] | null
          head_member_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          off_days_per_cycle?: number
          rotation_enabled?: boolean
          updated_at?: string
          week_off_pattern?: string | null
          work_days_per_cycle?: number
        }
        Relationships: []
      }
      impersonation_logs: {
        Row: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          target_email: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action?: string
          admin_email: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          target_email: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          target_email?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      infra_team_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          casual_leave_total: number
          casual_leave_used: number
          created_at: string
          id: string
          public_holidays_total: number
          public_holidays_used: number
          sick_leave_total: number
          sick_leave_used: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          casual_leave_total?: number
          casual_leave_used?: number
          created_at?: string
          id?: string
          public_holidays_total?: number
          public_holidays_used?: number
          sick_leave_total?: number
          sick_leave_used?: number
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          casual_leave_total?: number
          casual_leave_used?: number
          created_at?: string
          id?: string
          public_holidays_total?: number
          public_holidays_used?: number
          sick_leave_total?: number
          sick_leave_used?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_rotation_state: {
        Row: {
          created_at: string
          current_shift_type: string
          cycle_start_date: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_shift_type?: string
          cycle_start_date?: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_shift_type?: string
          cycle_start_date?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_rotation_state_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_rate_limits: {
        Row: {
          attempts: number
          created_at: string
          email: string
          id: string
          last_attempt: string
          lockout_until: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          id?: string
          last_attempt?: string
          lockout_until?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          id?: string
          last_attempt?: string
          lockout_until?: string | null
        }
        Relationships: []
      }
      pending_2fa_verification: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          method: string
          otp_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          method: string
          otp_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          otp_code?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          requested_role: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          requested_role: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          requested_role?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          status: string
          team_member_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          status?: string
          team_member_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          status?: string
          team_member_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          name: string
          year?: number
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          year?: number
        }
        Relationships: []
      }
      roster_versions: {
        Row: {
          assignments_snapshot: Json
          change_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          snapshot_date_from: string
          snapshot_date_to: string
          version_name: string | null
        }
        Insert: {
          assignments_snapshot: Json
          change_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          snapshot_date_from: string
          snapshot_date_to: string
          version_name?: string | null
        }
        Update: {
          assignments_snapshot?: Json
          change_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          snapshot_date_from?: string
          snapshot_date_to?: string
          version_name?: string | null
        }
        Relationships: []
      }
      rotation_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_consecutive_nights: number
          min_rest_hours: number
          off_days: number
          rotation_cycle_days: number
          shift_sequence: string[] | null
          updated_at: string
          work_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_consecutive_nights?: number
          min_rest_hours?: number
          off_days?: number
          rotation_cycle_days?: number
          shift_sequence?: string[] | null
          updated_at?: string
          work_days?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_consecutive_nights?: number
          min_rest_hours?: number
          off_days?: number
          rotation_cycle_days?: number
          shift_sequence?: string[] | null
          updated_at?: string
          work_days?: number
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          department: string
          id: string
          member_id: string
          shift_type: string
          status: string
          updated_at: string
          work_location_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          department: string
          id?: string
          member_id: string
          shift_type: string
          status?: string
          updated_at?: string
          work_location_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          department?: string
          id?: string
          member_id?: string
          shift_type?: string
          status?: string
          updated_at?: string
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_composition_rules: {
        Row: {
          created_at: string
          datacenter_id: string | null
          department: string
          id: string
          is_active: boolean
          min_count: number
          role_filter: string[] | null
          shift_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          datacenter_id?: string | null
          department: string
          id?: string
          is_active?: boolean
          min_count?: number
          role_filter?: string[] | null
          shift_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          datacenter_id?: string | null
          department?: string
          id?: string
          is_active?: boolean
          min_count?: number
          role_filter?: string[] | null
          shift_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_composition_rules_datacenter_id_fkey"
            columns: ["datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          date: string
          id: string
          member_id: string
          new_shift_type: string | null
          notes: string | null
          old_shift_type: string | null
          swap_with_member_id: string | null
        }
        Insert: {
          action?: string
          changed_by?: string | null
          created_at?: string
          date: string
          id?: string
          member_id: string
          new_shift_type?: string | null
          notes?: string | null
          old_shift_type?: string | null
          swap_with_member_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          date?: string
          id?: string
          member_id?: string
          new_shift_type?: string | null
          notes?: string | null
          old_shift_type?: string | null
          swap_with_member_id?: string | null
        }
        Relationships: []
      }
      status_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: string
          old_status: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: string
          old_status?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: string
          old_status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      swap_requests: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
          requester_id: string
          requester_shift: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          target_id: string
          target_shift: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
          requester_id: string
          requester_shift: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id: string
          target_shift: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          requester_id?: string
          requester_shift?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id?: string
          target_shift?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          datacenter_id: string | null
          department: string
          email: string
          hybrid_office_days: number | null
          hybrid_wfh_days: number | null
          hybrid_wfh_days_pattern: number[] | null
          id: string
          is_hybrid: boolean | null
          name: string
          reporting_tl_id: string | null
          role: string
          status: string
          team: string | null
          updated_at: string
          week_off_entitlement: number
          work_location_id: string | null
        }
        Insert: {
          created_at?: string
          datacenter_id?: string | null
          department: string
          email: string
          hybrid_office_days?: number | null
          hybrid_wfh_days?: number | null
          hybrid_wfh_days_pattern?: number[] | null
          id: string
          is_hybrid?: boolean | null
          name: string
          reporting_tl_id?: string | null
          role: string
          status?: string
          team?: string | null
          updated_at?: string
          week_off_entitlement?: number
          work_location_id?: string | null
        }
        Update: {
          created_at?: string
          datacenter_id?: string | null
          department?: string
          email?: string
          hybrid_office_days?: number | null
          hybrid_wfh_days?: number | null
          hybrid_wfh_days_pattern?: number[] | null
          id?: string
          is_hybrid?: boolean | null
          name?: string
          reporting_tl_id?: string | null
          role?: string
          status?: string
          team?: string | null
          updated_at?: string
          week_off_entitlement?: number
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_datacenter_id_fkey"
            columns: ["datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa_settings: {
        Row: {
          backup_codes: Json | null
          created_at: string
          email_otp_enabled: boolean
          id: string
          totp_enabled: boolean
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: Json | null
          created_at?: string
          email_otp_enabled?: boolean
          id?: string
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: Json | null
          created_at?: string
          email_otp_enabled?: boolean
          id?: string
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_locations: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          location_type: string | null
          min_night_shift_count: number
          name: string
          updated_at: string
          work_from_home_if_below_min: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: string | null
          min_night_shift_count?: number
          name: string
          updated_at?: string
          work_from_home_if_below_min?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: string | null
          min_night_shift_count?: number
          name?: string
          updated_at?: string
          work_from_home_if_below_min?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_allowed_google_domains: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hr" | "tl" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "hr", "tl", "member"],
    },
  },
} as const
