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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          context: Json
          created_at: string
          entity: string
          entity_id: string | null
          firm_id: string
          id: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          context?: Json
          created_at?: string
          entity: string
          entity_id?: string | null
          firm_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          context?: Json
          created_at?: string
          entity?: string
          entity_id?: string | null
          firm_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          cnpj: string
          created_at: string
          enrichment_data: Json
          firm_id: string
          id: string
          legal_name: string
          state: string | null
          status: string
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cnpj: string
          created_at?: string
          enrichment_data?: Json
          firm_id: string
          id?: string
          legal_name: string
          state?: string | null
          status?: string
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cnpj?: string
          created_at?: string
          enrichment_data?: Json
          firm_id?: string
          id?: string
          legal_name?: string
          state?: string | null
          status?: string
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          firm_id: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          preferred_channel: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          firm_id: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          firm_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_firm_company_fkey"
            columns: ["firm_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["firm_id", "id"]
          },
          {
            foreignKeyName: "contacts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          doc_type: string
          file_name: string
          firm_id: string
          hash: string
          id: string
          metadata: Json
          period: string | null
          size_bytes: number | null
          source: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          doc_type?: string
          file_name: string
          firm_id: string
          hash: string
          id?: string
          metadata?: Json
          period?: string | null
          size_bytes?: number | null
          source?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          doc_type?: string
          file_name?: string
          firm_id?: string
          hash?: string
          id?: string
          metadata?: Json
          period?: string | null
          size_bytes?: number | null
          source?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_firm_id_company_id_fkey"
            columns: ["firm_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["firm_id", "id"]
          },
          {
            foreignKeyName: "documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_queue: {
        Row: {
          context: Json
          created_at: string
          firm_id: string
          id: string
          resolution: Json
          source: string
          status: string
          suggestion: Json
          updated_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          firm_id: string
          id?: string
          resolution?: Json
          source: string
          status?: string
          suggestion?: Json
          updated_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          firm_id?: string
          id?: string
          resolution?: Json
          source?: string
          status?: string
          suggestion?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exception_queue_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitored_documents: {
        Row: {
          company_id: string
          created_at: string
          doc_kind: string
          document_id: string | null
          due_date: string | null
          firm_id: string
          id: string
          metadata: Json
          status: string
          trigger_days: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          doc_kind: string
          document_id?: string | null
          due_date?: string | null
          firm_id: string
          id?: string
          metadata?: Json
          status?: string
          trigger_days?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          doc_kind?: string
          document_id?: string | null
          due_date?: string | null
          firm_id?: string
          id?: string
          metadata?: Json
          status?: string
          trigger_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitored_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitored_documents_firm_id_company_id_fkey"
            columns: ["firm_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["firm_id", "id"]
          },
          {
            foreignKeyName: "monitored_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          department: string | null
          entity: string | null
          entity_id: string | null
          firm_id: string
          id: string
          kind: string
          read_at: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          department?: string | null
          entity?: string | null
          entity_id?: string | null
          firm_id: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          department?: string | null
          entity?: string | null
          entity_id?: string | null
          firm_id?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          active: boolean
          created_at: string
          department: string
          firm_id: string
          generation_day: number
          handoff_to: string | null
          id: string
          target_kind: string
          target_value: Json
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department: string
          firm_id: string
          generation_day?: number
          handoff_to?: string | null
          id?: string
          target_kind: string
          target_value?: Json
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string
          firm_id?: string
          generation_day?: number
          handoff_to?: string | null
          id?: string
          target_kind?: string
          target_value?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          department: string
          firm_id: string
          handoff_to: string | null
          id: string
          monitored_document_id: string | null
          period: string | null
          recurring_task_id: string | null
          source_task_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          department: string
          firm_id: string
          handoff_to?: string | null
          id?: string
          monitored_document_id?: string | null
          period?: string | null
          recurring_task_id?: string | null
          source_task_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          department?: string
          firm_id?: string
          handoff_to?: string | null
          id?: string
          monitored_document_id?: string | null
          period?: string | null
          recurring_task_id?: string | null
          source_task_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_firm_id_company_id_fkey"
            columns: ["firm_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["firm_id", "id"]
          },
          {
            foreignKeyName: "tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_monitored_document_id_fkey"
            columns: ["monitored_document_id"]
            isOneToOne: false
            referencedRelation: "monitored_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          created_at: string
          department: string
          firm_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          firm_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          firm_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          full_name?: string | null
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_departments: { Args: never; Returns: string[] }
      current_firm_id: { Args: never; Returns: string }
      handoff_task: { Args: { p_task_id: string }; Returns: string }
      is_firm_manager: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_context?: Json
          p_entity: string
          p_entity_id?: string
        }
        Returns: string
      }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      request_enrichment: { Args: { p_company_id: string }; Returns: undefined }
      resolve_exception: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
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
