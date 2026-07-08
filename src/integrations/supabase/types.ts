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
      application_emails: {
        Row: {
          application_id: string
          created_at: string
          email_type: string
          from_email: string
          id: string
          is_automated: boolean | null
          received_at: string
          snippet: string | null
          subject: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          email_type?: string
          from_email: string
          id?: string
          is_automated?: boolean | null
          received_at?: string
          snippet?: string | null
          subject: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          email_type?: string
          from_email?: string
          id?: string
          is_automated?: boolean | null
          received_at?: string
          snippet?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_emails_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          actual_recipient: string | null
          application_contract: Json | null
          application_method: string | null
          applied_at: string | null
          company_email_received: boolean | null
          company_email_received_at: string | null
          company_email_snippet: string | null
          company_email_subject: string | null
          correlation_id: string | null
          cover_letter: string | null
          created_at: string | null
          custom_responses: Json | null
          cv_profile_id: string | null
          dead_lettered_at: string | null
          delivery_mode: string | null
          delivery_provider: string | null
          delivery_provider_message_id: string | null
          delivery_verified_at: string | null
          documents_required: string[] | null
          documents_uploaded: string[] | null
          error_code: string | null
          error_message: string | null
          first_failure_at: string | null
          id: string
          idempotency_key: string | null
          job_id: string
          last_failure_at: string | null
          last_retry_reason: string | null
          match_score: number
          max_retries: number
          next_retry_at: string | null
          notes: string | null
          original_recipient: string | null
          provider_context: Json | null
          response_received_at: string | null
          retry_count: number | null
          status: string | null
          tailored_cv_changes: string[] | null
          tailored_cv_generated_at: string | null
          tailored_cv_keywords: string[] | null
          tailored_cv_pdf_url: string | null
          tailored_cv_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_recipient?: string | null
          application_contract?: Json | null
          application_method?: string | null
          applied_at?: string | null
          company_email_received?: boolean | null
          company_email_received_at?: string | null
          company_email_snippet?: string | null
          company_email_subject?: string | null
          correlation_id?: string | null
          cover_letter?: string | null
          created_at?: string | null
          custom_responses?: Json | null
          cv_profile_id?: string | null
          dead_lettered_at?: string | null
          delivery_mode?: string | null
          delivery_provider?: string | null
          delivery_provider_message_id?: string | null
          delivery_verified_at?: string | null
          documents_required?: string[] | null
          documents_uploaded?: string[] | null
          error_code?: string | null
          error_message?: string | null
          first_failure_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id: string
          last_failure_at?: string | null
          last_retry_reason?: string | null
          match_score: number
          max_retries?: number
          next_retry_at?: string | null
          notes?: string | null
          original_recipient?: string | null
          provider_context?: Json | null
          response_received_at?: string | null
          retry_count?: number | null
          status?: string | null
          tailored_cv_changes?: string[] | null
          tailored_cv_generated_at?: string | null
          tailored_cv_keywords?: string[] | null
          tailored_cv_pdf_url?: string | null
          tailored_cv_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_recipient?: string | null
          application_contract?: Json | null
          application_method?: string | null
          applied_at?: string | null
          company_email_received?: boolean | null
          company_email_received_at?: string | null
          company_email_snippet?: string | null
          company_email_subject?: string | null
          correlation_id?: string | null
          cover_letter?: string | null
          created_at?: string | null
          custom_responses?: Json | null
          cv_profile_id?: string | null
          dead_lettered_at?: string | null
          delivery_mode?: string | null
          delivery_provider?: string | null
          delivery_provider_message_id?: string | null
          delivery_verified_at?: string | null
          documents_required?: string[] | null
          documents_uploaded?: string[] | null
          error_code?: string | null
          error_message?: string | null
          first_failure_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string
          last_failure_at?: string | null
          last_retry_reason?: string | null
          match_score?: number
          max_retries?: number
          next_retry_at?: string | null
          notes?: string | null
          original_recipient?: string | null
          provider_context?: Json | null
          response_received_at?: string | null
          retry_count?: number | null
          status?: string | null
          tailored_cv_changes?: string[] | null
          tailored_cv_generated_at?: string | null
          tailored_cv_keywords?: string[] | null
          tailored_cv_pdf_url?: string | null
          tailored_cv_text?: string | null
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
      auto_apply_schedules: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          time_of_day: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          enabled?: boolean
          frequency: string
          id?: string
          last_run_at?: string | null
          time_of_day: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          time_of_day?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_failures: {
        Row: {
          application_id: string | null
          context: Json
          created_at: string
          dead_lettered: boolean
          error_code: string
          error_message: string
          id: string
          occurred_at: string
          retry_count: number
          retryable: boolean
          run_id: string | null
          step_id: string | null
          step_name: Database["public"]["Enums"]["automation_step_name"] | null
          user_id: string
        }
        Insert: {
          application_id?: string | null
          context?: Json
          created_at?: string
          dead_lettered?: boolean
          error_code: string
          error_message: string
          id?: string
          occurred_at?: string
          retry_count?: number
          retryable?: boolean
          run_id?: string | null
          step_id?: string | null
          step_name?: Database["public"]["Enums"]["automation_step_name"] | null
          user_id: string
        }
        Update: {
          application_id?: string | null
          context?: Json
          created_at?: string
          dead_lettered?: boolean
          error_code?: string
          error_message?: string
          id?: string
          occurred_at?: string
          retry_count?: number
          retryable?: boolean
          run_id?: string | null
          step_id?: string | null
          step_name?: Database["public"]["Enums"]["automation_step_name"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_failures_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_run_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_steps: {
        Row: {
          application_id: string | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          idempotency_key: string
          job_id: string | null
          payload: Json
          run_id: string
          started_at: string
          status: Database["public"]["Enums"]["automation_step_status"]
          step_name: Database["public"]["Enums"]["automation_step_name"]
          user_id: string
        }
        Insert: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          idempotency_key: string
          job_id?: string | null
          payload?: Json
          run_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["automation_step_status"]
          step_name: Database["public"]["Enums"]["automation_step_name"]
          user_id: string
        }
        Update: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          idempotency_key?: string
          job_id?: string | null
          payload?: Json
          run_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["automation_step_status"]
          step_name?: Database["public"]["Enums"]["automation_step_name"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          applications_attempted: number
          applications_failed: number
          applications_succeeded: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          duration_ms: number | null
          environment: string
          error_summary: string | null
          execution_source: string
          id: string
          initiated_by: string | null
          jobs_discovered: number
          jobs_matched: number
          metadata: Json
          started_at: string
          status: Database["public"]["Enums"]["automation_run_status"]
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at: string
          user_id: string
          worker_version: string
        }
        Insert: {
          applications_attempted?: number
          applications_failed?: number
          applications_succeeded?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          duration_ms?: number | null
          environment?: string
          error_summary?: string | null
          execution_source?: string
          id?: string
          initiated_by?: string | null
          jobs_discovered?: number
          jobs_matched?: number
          metadata?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
          user_id: string
          worker_version?: string
        }
        Update: {
          applications_attempted?: number
          applications_failed?: number
          applications_succeeded?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          duration_ms?: number | null
          environment?: string
          error_summary?: string | null
          execution_source?: string
          id?: string
          initiated_by?: string | null
          jobs_discovered?: number
          jobs_matched?: number
          metadata?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
          user_id?: string
          worker_version?: string
        }
        Relationships: []
      }
      cv_profiles: {
        Row: {
          ats_suggestions: Json | null
          candidate_country: string | null
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
          needs_sponsorship: boolean
          parsed_data: Json | null
          profile_name: string | null
          resume_score: number | null
          seniority_level: string | null
          skills: string[] | null
          summary: string | null
          updated_at: string | null
          user_id: string
          work_authorized_countries: string[]
          work_history: Json | null
        }
        Insert: {
          ats_suggestions?: Json | null
          candidate_country?: string | null
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
          needs_sponsorship?: boolean
          parsed_data?: Json | null
          profile_name?: string | null
          resume_score?: number | null
          seniority_level?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string | null
          user_id: string
          work_authorized_countries?: string[]
          work_history?: Json | null
        }
        Update: {
          ats_suggestions?: Json | null
          candidate_country?: string | null
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
          needs_sponsorship?: boolean
          parsed_data?: Json | null
          profile_name?: string | null
          resume_score?: number | null
          seniority_level?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string | null
          user_id?: string
          work_authorized_countries?: string[]
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
      job_discovery_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          jobs_found: number
          jobs_saved: number
          params: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          jobs_found?: number
          jobs_saved?: number
          params: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          jobs_found?: number
          jobs_saved?: number
          params?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          liveness_checked_at: string | null
          location: string | null
          match_details: Json | null
          match_score: number | null
          posted_at: string | null
          recruiter_email: string | null
          recruiter_email_confidence: string | null
          recruiter_email_extracted_at: string | null
          requirements: string[] | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          source_key: string | null
          source_platform: string
          source_type: string
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
          liveness_checked_at?: string | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          posted_at?: string | null
          recruiter_email?: string | null
          recruiter_email_confidence?: string | null
          recruiter_email_extracted_at?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_key?: string | null
          source_platform: string
          source_type?: string
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
          liveness_checked_at?: string | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          posted_at?: string | null
          recruiter_email?: string | null
          recruiter_email_confidence?: string | null
          recruiter_email_extracted_at?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_key?: string | null
          source_platform?: string
          source_type?: string
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
      notification_events: {
        Row: {
          application_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_error: string | null
          event_type: string
          id: string
          payload: Json
          read_at: string | null
          run_id: string | null
          severity: string
          status: string | null
          user_id: string
        }
        Insert: {
          application_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          event_type: string
          id?: string
          payload?: Json
          read_at?: string | null
          run_id?: string | null
          severity?: string
          status?: string | null
          user_id: string
        }
        Update: {
          application_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          read_at?: string | null
          run_id?: string | null
          severity?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          channel: string
          cooldown_minutes: number
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          severity: string
          status: string | null
          template_body: string
          template_title: string
          updated_at: string
        }
        Insert: {
          channel?: string
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          severity?: string
          status?: string | null
          template_body: string
          template_title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          severity?: string
          status?: string | null
          template_body?: string
          template_title?: string
          updated_at?: string
        }
        Relationships: []
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
          company_cooldown_days: number
          created_at: string | null
          daily_application_cap: number | null
          delivery_mode: string
          email: string
          email_notifications: boolean | null
          full_name: string | null
          id: string
          job_details_view: string | null
          location: string | null
          manual_approval_mode: boolean | null
          max_apps_per_company: number
          minimum_fit_score: number | null
          notifications_enabled: boolean | null
          phone: string | null
          preferred_locations: string[] | null
          preferred_roles: string[] | null
          saved_search_frequency: string | null
          test_email_override: string | null
          theme_preference: string | null
          updated_at: string | null
          visa_required: boolean | null
        }
        Insert: {
          automation_status?: string | null
          bulk_apply_mode?: string | null
          company_cooldown_days?: number
          created_at?: string | null
          daily_application_cap?: number | null
          delivery_mode?: string
          email: string
          email_notifications?: boolean | null
          full_name?: string | null
          id: string
          job_details_view?: string | null
          location?: string | null
          manual_approval_mode?: boolean | null
          max_apps_per_company?: number
          minimum_fit_score?: number | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          saved_search_frequency?: string | null
          test_email_override?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Update: {
          automation_status?: string | null
          bulk_apply_mode?: string | null
          company_cooldown_days?: number
          created_at?: string | null
          daily_application_cap?: number | null
          delivery_mode?: string
          email?: string
          email_notifications?: boolean | null
          full_name?: string | null
          id?: string
          job_details_view?: string | null
          location?: string | null
          manual_approval_mode?: boolean | null
          max_apps_per_company?: number
          minimum_fit_score?: number | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_locations?: string[] | null
          preferred_roles?: string[] | null
          saved_search_frequency?: string | null
          test_email_override?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Relationships: []
      }
      referral_emails: {
        Row: {
          application_id: string | null
          body: string
          company: string
          created_at: string
          id: string
          job_id: string | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string
          recipient_title: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body: string
          company: string
          created_at?: string
          id?: string
          job_id?: string | null
          opened_at?: string | null
          recipient_email: string
          recipient_name: string
          recipient_title?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          body?: string
          company?: string
          created_at?: string
          id?: string
          job_id?: string | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string
          recipient_title?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_emails_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_emails_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          max_value: number | null
          min_value: number | null
          scope: string
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          max_value?: number | null
          min_value?: number | null
          scope?: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          max_value?: number | null
          min_value?: number | null
          scope?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: []
      }
      system_settings_audit: {
        Row: {
          changed_by: string | null
          id: string
          new_value: Json | null
          occurred_at: string
          old_value: Json | null
          operation: string
          setting_key: string
        }
        Insert: {
          changed_by?: string | null
          id?: string
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          operation: string
          setting_key: string
        }
        Update: {
          changed_by?: string | null
          id?: string
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          operation?: string
          setting_key?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_run_counter: {
        Args: { p_delta?: number; p_field: string; p_run_id: string }
        Returns: undefined
      }
      recent_applications_to_company: {
        Args: { p_company: string; p_days?: number; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      automation_run_status:
        | "running"
        | "completed"
        | "partial"
        | "failed"
        | "cancelled"
      automation_step_name:
        | "discover_started"
        | "discover_completed"
        | "match_started"
        | "match_completed"
        | "apply_started"
        | "apply_completed"
        | "apply_failed"
        | "cooldown_skipped"
        | "retry_started"
        | "retry_completed"
      automation_step_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
      automation_trigger_type: "cron" | "manual" | "retry" | "webhook"
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
      app_role: ["admin", "moderator", "user"],
      automation_run_status: [
        "running",
        "completed",
        "partial",
        "failed",
        "cancelled",
      ],
      automation_step_name: [
        "discover_started",
        "discover_completed",
        "match_started",
        "match_completed",
        "apply_started",
        "apply_completed",
        "apply_failed",
        "cooldown_skipped",
        "retry_started",
        "retry_completed",
      ],
      automation_step_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "skipped",
      ],
      automation_trigger_type: ["cron", "manual", "retry", "webhook"],
    },
  },
} as const
