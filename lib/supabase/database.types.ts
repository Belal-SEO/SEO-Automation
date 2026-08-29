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
        };
        Insert: {
          id?: string;
          client_id: string;
          run_at?: string;
          source: string;
          status?: string;
          error?: string | null;
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
          is_executable: boolean;
          executable_added_at: string | null;
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
          is_executable?: boolean;
          executable_added_at?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
