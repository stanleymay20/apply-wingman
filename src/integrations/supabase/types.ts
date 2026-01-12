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
      application_logs: {
        Row: {
          action: string
          application_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          job_id: string | null
          level: string | null
          message: string
          user_id: string
        }
        Insert: {
          action: string
          application_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id?: string | null
          level?: string | null
          message: string
          user_id: string
        }
        Update: {
          action?: string
          application_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id?: string | null
          level?: string | null
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_method: string | null
          applied_at: string | null
          cover_letter: string | null
          created_at: string | null
          custom_responses: Json | null
          cv_profile_id: string | null
          documents_required: string[] | null
          documents_uploaded: string[] | null
          error_message: string | null
          id: string
          job_id: string
          match_score: number
          notes: string | null
          response_received_at: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          application_method?: string | null
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string | null
          custom_responses?: Json | null
          cv_profile_id?: string | null
          documents_required?: string[] | null
          documents_uploaded?: string[] | null
          error_message?: string | null
          id?: string
          job_id: string
          match_score: number
          notes?: string | null
          response_received_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          application_method?: string | null
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string | null
          custom_responses?: Json | null
          cv_profile_id?: string | null
          documents_required?: string[] | null
          documents_uploaded?: string[] | null
          error_message?: string | null
          id?: string
          job_id?: string
          match_score?: number
          notes?: string | null
          response_received_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_cv_profile_id_fkey"
            columns: ["cv_profile_id"]
            isOneToOne: false
            referencedRelation: "cv_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_profiles: {
        Row: {
          created_at: string | null
          cv_file_name: string | null
          cv_file_url: string | null
          education: Json | null
          experience_years: number | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          languages: string[] | null
          last_parsed_at: string | null
          parsed_data: Json | null
          seniority_level: string | null
          skills: string[] | null
          summary: string | null
          updated_at: string | null
          user_id: string
          work_history: Json | null
        }
        Insert: {
          created_at?: string | null
          cv_file_name?: string | null
          cv_file_url?: string | null
          education?: Json | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          languages?: string[] | null
          last_parsed_at?: string | null
          parsed_data?: Json | null
          seniority_level?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string | null
          user_id: string
          work_history?: Json | null
        }
        Update: {
          created_at?: string | null
          cv_file_name?: string | null
          cv_file_url?: string | null
          education?: Json | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          languages?: string[] | null
          last_parsed_at?: string | null
          parsed_data?: Json | null
          seniority_level?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string | null
          user_id?: string
          work_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          applications_failed: number | null
          applications_sent: number | null
          applications_successful: number | null
          average_match_score: number | null
          created_at: string | null
          date: string
          id: string
          interviews_received: number | null
          jobs_discovered: number | null
          jobs_matched: number | null
          rejections_received: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applications_failed?: number | null
          applications_sent?: number | null
          applications_successful?: number | null
          average_match_score?: number | null
          created_at?: string | null
          date?: string
          id?: string
          interviews_received?: number | null
          jobs_discovered?: number | null
          jobs_matched?: number | null
          rejections_received?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applications_failed?: number | null
          applications_sent?: number | null
          applications_successful?: number | null
          average_match_score?: number | null
          created_at?: string | null
          date?: string
          id?: string
          interviews_received?: number | null
          jobs_discovered?: number | null
          jobs_matched?: number | null
          rejections_received?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          benefits: string[] | null
          company: string
          company_logo_url: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          is_remote: boolean | null
          job_type: string | null
          location: string | null
          match_details: Json | null
          match_score: number | null
          posted_at: string | null
          requirements: string[] | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          source_platform: string
          source_url: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
          visa_sponsorship: boolean | null
        }
        Insert: {
          benefits?: string[] | null
          company: string
          company_logo_url?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_remote?: boolean | null
          job_type?: string | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          posted_at?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_platform: string
          source_url: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          visa_sponsorship?: boolean | null
        }
        Update: {
          benefits?: string[] | null
          company?: string
          company_logo_url?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_remote?: boolean | null
          job_type?: string | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          posted_at?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_platform?: string
          source_url?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          visa_sponsorship?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_blacklist: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_blacklist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          automation_status: string | null
          bulk_apply_mode: string | null
          created_at: string | null
          daily_application_cap: number | null
          email: string
          email_notifications: boolean | null
          full_name: string | null
          id: string
          job_details_view: string | null
          location: string | null
          manual_approval_mode: boolean | null
          minimum_fit_score: number | null
          notifications_enabled: boolean | null
          phone: string | null
          preferred_locations: string[] | null
          preferred_roles: string[] | null
          saved_search_frequency: string | null
          theme_preference: string | null
          updated_at: string | null
          visa_required: boolean | null
        }
        Insert: {
          automation_status?: string | null
          bulk_apply_mode?: string | null
          created_at?: string | null
          daily_application_cap?: number | null
          email: string
          email_notifications?: boolean | null
          full_name?: string | null
          id: string
          job_details_view?: string | null
          location?: string | null
          manual_approval_mode?: boolean | null
          minimum_fit_score?: number | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          saved_search_frequency?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Update: {
          automation_status?: string | null
          bulk_apply_mode?: string | null
          created_at?: string | null
          daily_application_cap?: number | null
          email?: string
          email_notifications?: boolean | null
          full_name?: string | null
          id?: string
          job_details_view?: string | null
          location?: string | null
          manual_approval_mode?: boolean | null
          minimum_fit_score?: number | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          saved_search_frequency?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          last_run_at: string | null
          locations: string[]
          name: string
          platforms: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_run_at?: string | null
          locations?: string[]
          name: string
          platforms?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_run_at?: string | null
          locations?: string[]
          name?: string
          platforms?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_today_application_count: {
        Args: { p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
