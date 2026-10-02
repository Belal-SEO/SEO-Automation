// Hand-authored types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked,
// and replace this file with the generated output.

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          brand: string;
          locations: string[];
          domain: string;
          cms_type: string | null;
          report_cadence_days: number;
          critical_alert_threshold: number;
          custom_audit_instructions: string | null;
          wp_remote_site_id: string | null;
          stage: string;
          sprint_started_at: string | null;
          sprint_deadline: string | null;
          stage_changed_at: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand: string;
          locations?: string[];
          domain: string;
          cms_type?: string | null;
          report_cadence_days?: number;
          critical_alert_threshold?: number;
          custom_audit_instructions?: string | null;
          wp_remote_site_id?: string | null;
          stage?: string;
          sprint_started_at?: string | null;
          sprint_deadline?: string | null;
          stage_changed_at?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      audits: {
        Row: {
          id: string;
          client_id: string;
          run_at: string;
          source: string;
          status: string;
          error: string | null;
          model: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          run_at?: string;
          source: string;
          status?: string;
          error?: string | null;
          model?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["audits"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audits_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: {
          id: string;
          audit_id: string;
          client_id: string;
          category: string;
          severity: string;
          url: string;
          description: string;
          status: string;
          detected_at: string;
          fixed_at: string | null;
          before_screenshot_url: string | null;
          after_screenshot_url: string | null;
          assigned_to: string | null;
          external_id: string | null;
        };
        Insert: {
          id?: string;
          audit_id: string;
          client_id: string;
          category: string;
          severity: string;
          url: string;
          description: string;
          status?: string;
          detected_at?: string;
          fixed_at?: string | null;
          before_screenshot_url?: string | null;
          after_screenshot_url?: string | null;
          assigned_to?: string | null;
          external_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["issues"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "issues_audit_id_fkey";
            columns: ["audit_id"];
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issues_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_activity: {
        Row: {
          id: string;
          issue_id: string;
          client_id: string;
          activity_type: string;
          note: string | null;
          new_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          client_id: string;
          activity_type: string;
          note?: string | null;
          new_status?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["issue_activity"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "issue_activity_issue_id_fkey";
            columns: ["issue_id"];
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issue_activity_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_snapshots: {
        Row: {
          id: string;
          client_id: string;
          audit_id: string;
          metric: string;
          value: number;
          captured_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          audit_id: string;
          metric: string;
          value: number;
          captured_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["metric_snapshots"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_audit_id_fkey";
            columns: ["audit_id"];
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metric_snapshots_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          client_id: string;
          period_start: string;
          period_end: string;
          audit_ids: string[];
          status: string;
          content: string;
          sent_via: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          period_start: string;
          period_end: string;
          audit_ids?: string[];
          status?: string;
          content?: string;
          sent_via?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_report_settings: {
        Row: {
          client_id: string;
          agency_label: string | null;
          website_url: string | null;
          client_email: string | null;
          gsc_site_url: string | null;
          backlinks_sheet_id: string | null;
          backlinks_sheet_tab: string | null;
          gbp_location_id: string | null;
          send_day_of_month: number;
          review_lead_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          agency_label?: string | null;
          website_url?: string | null;
          client_email?: string | null;
          gsc_site_url?: string | null;
          backlinks_sheet_id?: string | null;
          backlinks_sheet_tab?: string | null;
          gbp_location_id?: string | null;
          send_day_of_month?: number;
          review_lead_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_report_settings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_report_settings_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      google_oauth_tokens: {
        Row: {
          id: string;
          encrypted_refresh_token: string;
          google_account_email: string | null;
          scope: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          encrypted_refresh_token: string;
          google_account_email?: string | null;
          scope?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_oauth_tokens"]["Insert"]>;
        Relationships: [];
      };
      baselines: {
        Row: {
          id: string;
          client_id: string;
          organic_impressions: number;
          organic_clicks: number;
          indexed_pages: number;
          total_backlinks: number;
          sitemap_submitted: boolean | null;
          sitemap_page_count: number | null;
          top_pages: unknown;
          generative_engine_appearances: number;
          captured_range_start: string | null;
          captured_range_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          organic_impressions?: number;
          organic_clicks?: number;
          indexed_pages?: number;
          total_backlinks?: number;
          sitemap_submitted?: boolean | null;
          sitemap_page_count?: number | null;
          top_pages?: unknown;
          generative_engine_appearances?: number;
          captured_range_start?: string | null;
          captured_range_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["baselines"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "baselines_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_reports: {
        Row: {
          id: string;
          client_id: string;
          period_label: string;
          title: string;
          subtitle: string | null;
          accent_color: string;
          period_start: string;
          period_end: string;
          scheduled_send_date: string;
          status: string;
          sort_index: number;
          generated_at: string | null;
          sent_at: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          period_label: string;
          title?: string;
          subtitle?: string | null;
          accent_color?: string;
          period_start: string;
          period_end: string;
          scheduled_send_date: string;
          status?: string;
          sort_index?: number;
          generated_at?: string | null;
          sent_at?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_reports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_reports_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_report_metrics: {
        Row: {
          id: string;
          monthly_report_id: string;
          key: string;
          label: string;
          sublabel: string | null;
          value_number: number | null;
          value_text: string | null;
          source: string;
          auto_value: number | null;
          is_overridden: boolean;
          fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monthly_report_id: string;
          key: string;
          label: string;
          sublabel?: string | null;
          value_number?: number | null;
          value_text?: string | null;
          source?: string;
          auto_value?: number | null;
          is_overridden?: boolean;
          fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_report_metrics"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_report_metrics_report_id_fkey";
            columns: ["monthly_report_id"];
            referencedRelation: "monthly_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_report_tasks: {
        Row: {
          id: string;
          monthly_report_id: string;
          list_key: string;
          text: string;
          url: string | null;
          source: string;
          sort_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          monthly_report_id: string;
          list_key: string;
          text: string;
          url?: string | null;
          source?: string;
          sort_index?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_report_tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_report_tasks_report_id_fkey";
            columns: ["monthly_report_id"];
            referencedRelation: "monthly_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_report_email_drafts: {
        Row: {
          id: string;
          monthly_report_id: string;
          to_email: string | null;
          subject: string;
          body: string;
          status: string;
          generated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monthly_report_id: string;
          to_email?: string | null;
          subject?: string;
          body?: string;
          status?: string;
          generated_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_report_email_drafts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "monthly_report_email_drafts_report_id_fkey";
            columns: ["monthly_report_id"];
            referencedRelation: "monthly_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      triage_clients: {
        Row: {
          id: string;
          client_name: string;
          start_date: string;
          deadline_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_name: string;
          start_date: string;
          deadline_date: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["triage_clients"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
