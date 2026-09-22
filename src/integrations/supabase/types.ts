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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          key: string
          value: Json | null
        }
        Insert: {
          description?: string | null
          key: string
          value?: Json | null
        }
        Update: {
          description?: string | null
          key?: string
          value?: Json | null
        }
        Relationships: []
      }
      betty_scan_answers: {
        Row: {
          ai_confidence: string | null
          ai_evidence: Json
          ai_note: string | null
          ai_result: string | null
          ai_score: number | null
          comment: string | null
          coordinator_changed: boolean
          created_at: string
          final_result: string | null
          final_score: number | null
          id: string
          item_id: string
          scan_id: string
        }
        Insert: {
          ai_confidence?: string | null
          ai_evidence?: Json
          ai_note?: string | null
          ai_result?: string | null
          ai_score?: number | null
          comment?: string | null
          coordinator_changed?: boolean
          created_at?: string
          final_result?: string | null
          final_score?: number | null
          id?: string
          item_id: string
          scan_id: string
        }
        Update: {
          ai_confidence?: string | null
          ai_evidence?: Json
          ai_note?: string | null
          ai_result?: string | null
          ai_score?: number | null
          comment?: string | null
          coordinator_changed?: boolean
          created_at?: string
          final_result?: string | null
          final_score?: number | null
          id?: string
          item_id?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "betty_scan_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betty_scan_answers_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "betty_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      betty_scans: {
        Row: {
          ai_aois: Json
          ai_kudos: Json
          ai_output: Json | null
          ai_summary: string | null
          ai_watch_minutes: Json
          betty_phrase: string | null
          betty_score: number | null
          class_date: string | null
          class_timeline: Json | null
          coach_id: string
          converted_monitoring_id: string | null
          coordinator_id: string
          created_at: string
          deterministic: Json | null
          id: string
          level: string | null
          lob: string | null
          model: string | null
          share_token: string | null
          status: string
          template_id: string
          tokens_in: number | null
          tokens_out: number | null
          transcript_hash: string | null
          transcript_metrics: Json | null
          transcript_raw: string | null
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          ai_aois?: Json
          ai_kudos?: Json
          ai_output?: Json | null
          ai_summary?: string | null
          ai_watch_minutes?: Json
          betty_phrase?: string | null
          betty_score?: number | null
          class_date?: string | null
          class_timeline?: Json | null
          coach_id: string
          converted_monitoring_id?: string | null
          coordinator_id: string
          created_at?: string
          deterministic?: Json | null
          id?: string
          level?: string | null
          lob?: string | null
          model?: string | null
          share_token?: string | null
          status?: string
          template_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          transcript_hash?: string | null
          transcript_metrics?: Json | null
          transcript_raw?: string | null
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          ai_aois?: Json
          ai_kudos?: Json
          ai_output?: Json | null
          ai_summary?: string | null
          ai_watch_minutes?: Json
          betty_phrase?: string | null
          betty_score?: number | null
          class_date?: string | null
          class_timeline?: Json | null
          coach_id?: string
          converted_monitoring_id?: string | null
          coordinator_id?: string
          created_at?: string
          deterministic?: Json | null
          id?: string
          level?: string | null
          lob?: string | null
          model?: string | null
          share_token?: string | null
          status?: string
          template_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          transcript_hash?: string | null
          transcript_metrics?: Json | null
          transcript_raw?: string | null
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "betty_scans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betty_scans_converted_monitoring_id_fkey"
            columns: ["converted_monitoring_id"]
            isOneToOne: false
            referencedRelation: "monitorings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betty_scans_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betty_scans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          active: boolean
          coordinator_id: string | null
          coordinator_name: string | null
          country: string | null
          created_at: string
          csat_level: string | null
          email: string | null
          external_id: string | null
          first_class_date: string | null
          full_name: string
          id: string
          level: string | null
          lob: string | null
          notes: string | null
          phone: string | null
          schedule: string | null
          senior_name: string | null
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          coordinator_id?: string | null
          coordinator_name?: string | null
          country?: string | null
          created_at?: string
          csat_level?: string | null
          email?: string | null
          external_id?: string | null
          first_class_date?: string | null
          full_name: string
          id?: string
          level?: string | null
          lob?: string | null
          notes?: string | null
          phone?: string | null
          schedule?: string | null
          senior_name?: string | null
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          coordinator_id?: string | null
          coordinator_name?: string | null
          country?: string | null
          created_at?: string
          csat_level?: string | null
          email?: string | null
          external_id?: string | null
          first_class_date?: string | null
          full_name?: string
          id?: string
          level?: string | null
          lob?: string | null
          notes?: string | null
          phone?: string | null
          schedule?: string | null
          senior_name?: string | null
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_answers: {
        Row: {
          comment: string | null
          evidence_time: number | null
          id: string
          item_id: string | null
          monitoring_id: string
          result: string
          score: number | null
        }
        Insert: {
          comment?: string | null
          evidence_time?: number | null
          id?: string
          item_id?: string | null
          monitoring_id: string
          result?: string
          score?: number | null
        }
        Update: {
          comment?: string | null
          evidence_time?: number | null
          id?: string
          item_id?: string | null
          monitoring_id?: string
          result?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_answers_monitoring_id_fkey"
            columns: ["monitoring_id"]
            isOneToOne: false
            referencedRelation: "monitorings"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_students: {
        Row: {
          co: number | null
          coach_phrase: string | null
          comment: string | null
          fl: number | null
          goal: boolean | null
          gr: number | null
          id: string
          in: number | null
          monitoring_id: string
          phrase: string | null
          pr: number | null
          score: number | null
          student_name: string | null
          student_number: number | null
        }
        Insert: {
          co?: number | null
          coach_phrase?: string | null
          comment?: string | null
          fl?: number | null
          goal?: boolean | null
          gr?: number | null
          id?: string
          in?: number | null
          monitoring_id: string
          phrase?: string | null
          pr?: number | null
          score?: number | null
          student_name?: string | null
          student_number?: number | null
        }
        Update: {
          co?: number | null
          coach_phrase?: string | null
          comment?: string | null
          fl?: number | null
          goal?: boolean | null
          gr?: number | null
          id?: string
          in?: number | null
          monitoring_id?: string
          phrase?: string | null
          pr?: number | null
          score?: number | null
          student_name?: string | null
          student_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_students_monitoring_id_fkey"
            columns: ["monitoring_id"]
            isOneToOne: false
            referencedRelation: "monitorings"
            referencedColumns: ["id"]
          },
        ]
      }
      monitorings: {
        Row: {
          aois: Json
          base_score: number | null
          bonus_total: number | null
          class_date: string | null
          class_timeline: Json | null
          coach_commitment: string | null
          coach_counter: string | null
          coach_id: string | null
          coach_responded_at: string | null
          coach_summary: string | null
          coordinator_id: string | null
          created_at: string
          customer_expectation: string | null
          final_score: number | null
          general_comments: string | null
          id: string
          kudos: Json
          level: string | null
          main_aoi: string | null
          penalty_applied: boolean
          previous_aois: Json
          previous_commitment_status: string | null
          qa_date: string | null
          recording_start_time: string | null
          result_phrase: string | null
          schedule: string | null
          share_token: string | null
          status: string
          syllabus: string | null
          template_id: string | null
          transcript_metrics: Json | null
          transcript_raw: string | null
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          aois?: Json
          base_score?: number | null
          bonus_total?: number | null
          class_date?: string | null
          class_timeline?: Json | null
          coach_commitment?: string | null
          coach_counter?: string | null
          coach_id?: string | null
          coach_responded_at?: string | null
          coach_summary?: string | null
          coordinator_id?: string | null
          created_at?: string
          customer_expectation?: string | null
          final_score?: number | null
          general_comments?: string | null
          id?: string
          kudos?: Json
          level?: string | null
          main_aoi?: string | null
          penalty_applied?: boolean
          previous_aois?: Json
          previous_commitment_status?: string | null
          qa_date?: string | null
          recording_start_time?: string | null
          result_phrase?: string | null
          schedule?: string | null
          share_token?: string | null
          status?: string
          syllabus?: string | null
          template_id?: string | null
          transcript_metrics?: Json | null
          transcript_raw?: string | null
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          aois?: Json
          base_score?: number | null
          bonus_total?: number | null
          class_date?: string | null
          class_timeline?: Json | null
          coach_commitment?: string | null
          coach_counter?: string | null
          coach_id?: string | null
          coach_responded_at?: string | null
          coach_summary?: string | null
          coordinator_id?: string | null
          created_at?: string
          customer_expectation?: string | null
          final_score?: number | null
          general_comments?: string | null
          id?: string
          kudos?: Json
          level?: string | null
          main_aoi?: string | null
          penalty_applied?: boolean
          previous_aois?: Json
          previous_commitment_status?: string | null
          qa_date?: string | null
          recording_start_time?: string | null
          result_phrase?: string | null
          schedule?: string | null
          share_token?: string | null
          status?: string
          syllabus?: string | null
          template_id?: string | null
          transcript_metrics?: Json | null
          transcript_raw?: string | null
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitorings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitorings_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitorings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      template_items: {
        Row: {
          ai_instructions: string | null
          ai_mode: string
          area: string | null
          area_points: number | null
          description: string
          id: string
          item_number: string | null
          kind: string | null
          penalty_kind: string | null
          points: number | null
          section: string | null
          short_label: string | null
          sort_order: number | null
          ss: string | null
          template_id: string | null
        }
        Insert: {
          ai_instructions?: string | null
          ai_mode?: string
          area?: string | null
          area_points?: number | null
          description: string
          id?: string
          item_number?: string | null
          kind?: string | null
          penalty_kind?: string | null
          points?: number | null
          section?: string | null
          short_label?: string | null
          sort_order?: number | null
          ss?: string | null
          template_id?: string | null
        }
        Update: {
          ai_instructions?: string | null
          ai_mode?: string
          area?: string | null
          area_points?: number | null
          description?: string
          id?: string
          item_number?: string | null
          kind?: string | null
          penalty_kind?: string | null
          points?: number | null
          section?: string | null
          short_label?: string | null
          sort_order?: number | null
          ss?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          active: boolean
          code: string
          has_student_grid: boolean
          id: string
          name: string
          notes: string | null
          scoring: string | null
          sort_order: number | null
          source_sheet: string | null
          subject: string | null
        }
        Insert: {
          active?: boolean
          code: string
          has_student_grid?: boolean
          id?: string
          name: string
          notes?: string | null
          scoring?: string | null
          sort_order?: number | null
          source_sheet?: string | null
          subject?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          has_student_grid?: boolean
          id?: string
          name?: string
          notes?: string | null
          scoring?: string | null
          sort_order?: number | null
          source_sheet?: string | null
          subject?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_current_role: { Args: never; Returns: string }
      can_read_betty: { Args: { _id: string }; Returns: boolean }
      can_read_monitoring: { Args: { _id: string }; Returns: boolean }
      can_write_monitoring: { Args: { _id: string }; Returns: boolean }
      current_role: { Args: never; Returns: string }
      email_is_authorized: { Args: { _email: string }; Returns: boolean }
      get_betty_by_token: { Args: { _token: string }; Returns: Json }
      get_report_by_token: { Args: { _token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_senior_or_admin: { Args: never; Returns: boolean }
      submit_coach_response: {
        Args: {
          _commitment: string
          _counter?: string
          _summary: string
          _token: string
        }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
