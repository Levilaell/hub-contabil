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
      classification_examples: {
        Row: {
          context: Json
          created_at: string
          doc_type: string
          document_id: string | null
          extracted_cnpj: string | null
          firm_id: string
          id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          doc_type: string
          document_id?: string | null
          extracted_cnpj?: string | null
          firm_id: string
          id?: string
        }
        Update: {
          context?: Json
          created_at?: string
          doc_type?: string
          document_id?: string | null
          extracted_cnpj?: string | null
          firm_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_examples_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_examples_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      classifications: {
        Row: {
          confidence: number
          created_at: string
          decided_by: string
          document_id: string
          extracted_cnpj: string | null
          firm_id: string
          id: string
          model: string
          suggested_type: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          decided_by?: string
          document_id: string
          extracted_cnpj?: string | null
          firm_id: string
          id?: string
          model?: string
          suggested_type: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          decided_by?: string
          document_id?: string
          extracted_cnpj?: string | null
          firm_id?: string
          id?: string
          model?: string
          suggested_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classifications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          activities_started_on: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_street: string | null
          address_zip: string | null
          city: string | null
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string
          company_size: string | null
          created_at: string
          enrichment_data: Json
          firm_id: string
          id: string
          legal_name: string
          legal_nature: string | null
          municipal_registration: string | null
          nire: string | null
          nire_issued_on: string | null
          service_started_on: string | null
          share_capital: number | null
          state: string | null
          state_registration: string | null
          status: string
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          activities_started_on?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj: string
          company_size?: string | null
          created_at?: string
          enrichment_data?: Json
          firm_id: string
          id?: string
          legal_name: string
          legal_nature?: string | null
          municipal_registration?: string | null
          nire?: string | null
          nire_issued_on?: string | null
          service_started_on?: string | null
          share_capital?: number | null
          state?: string | null
          state_registration?: string | null
          status?: string
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          activities_started_on?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string
          company_size?: string | null
          created_at?: string
          enrichment_data?: Json
          firm_id?: string
          id?: string
          legal_name?: string
          legal_nature?: string | null
          municipal_registration?: string | null
          nire?: string | null
          nire_issued_on?: string | null
          service_started_on?: string | null
          share_capital?: number | null
          state?: string | null
          state_registration?: string | null
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
      company_partners: {
        Row: {
          company_id: string
          cpf_cnpj: string | null
          created_at: string
          firm_id: string
          id: string
          joined_on: string | null
          name: string
          ownership_percent: number | null
          qualification: string | null
          source: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cpf_cnpj?: string | null
          created_at?: string
          firm_id: string
          id?: string
          joined_on?: string | null
          name: string
          ownership_percent?: number | null
          qualification?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          firm_id?: string
          id?: string
          joined_on?: string | null
          name?: string
          ownership_percent?: number | null
          qualification?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_partners_firm_id_fkey"
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
          departments: string[]
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
          departments?: string[]
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
          departments?: string[]
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
      document_request_events: {
        Row: {
          context: Json
          event_type: string
          firm_id: string
          id: string
          ip: string | null
          occurred_at: string
          request_id: string
          user_agent: string | null
        }
        Insert: {
          context?: Json
          event_type: string
          firm_id: string
          id?: string
          ip?: string | null
          occurred_at?: string
          request_id: string
          user_agent?: string | null
        }
        Update: {
          context?: Json
          event_type?: string
          firm_id?: string
          id?: string
          ip?: string | null
          occurred_at?: string
          request_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_request_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          document_id: string | null
          expires_at: string
          firm_id: string
          id: string
          kind: string
          last_reminded_at: string | null
          requested_doc_type: string | null
          sent_at: string | null
          status: string
          title: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_id?: string | null
          expires_at: string
          firm_id: string
          id?: string
          kind: string
          last_reminded_at?: string | null
          requested_doc_type?: string | null
          sent_at?: string | null
          status?: string
          title: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_id?: string | null
          expires_at?: string
          firm_id?: string
          id?: string
          kind?: string
          last_reminded_at?: string | null
          requested_doc_type?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_firm_id_company_id_fkey"
            columns: ["firm_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["firm_id", "id"]
          },
          {
            foreignKeyName: "document_requests_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          doc_type: string
          file_name: string
          firm_id: string
          hash: string
          id: string
          inbound_message_id: string | null
          metadata: Json
          period: string | null
          size_bytes: number | null
          source: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          doc_type?: string
          file_name: string
          firm_id: string
          hash: string
          id?: string
          inbound_message_id?: string | null
          metadata?: Json
          period?: string | null
          size_bytes?: number | null
          source?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          doc_type?: string
          file_name?: string
          firm_id?: string
          hash?: string
          id?: string
          inbound_message_id?: string | null
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
          {
            foreignKeyName: "documents_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
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
      export_batch_documents: {
        Row: {
          batch_id: string
          created_at: string
          document_id: string
          export_name: string
          firm_id: string
          id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          document_id: string
          export_name: string
          firm_id: string
          id?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          document_id?: string
          export_name?: string
          firm_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_batch_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "export_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_batch_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_batch_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      export_batches: {
        Row: {
          created_at: string
          error: string | null
          filters: Json
          firm_id: string
          id: string
          manifest: Json
          period: string | null
          status: string
          updated_at: string
          zip_path: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          filters?: Json
          firm_id: string
          id?: string
          manifest?: Json
          period?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          filters?: Json
          firm_id?: string
          id?: string
          manifest?: Json
          period?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_batches_firm_id_fkey"
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
      inbound_messages: {
        Row: {
          channel: string
          created_at: string
          external_id: string
          firm_id: string
          id: string
          kind: string
          raw: Json
          received_at: string
          sender: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          external_id: string
          firm_id: string
          id?: string
          kind?: string
          raw?: Json
          received_at?: string
          sender?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_id?: string
          firm_id?: string
          id?: string
          kind?: string
          raw?: Json
          received_at?: string
          sender?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_rules: {
        Row: {
          created_at: string
          domain: string
          firm_id: string
          id: string
          key: Json
          level: number
          origin: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          domain: string
          firm_id: string
          id?: string
          key: Json
          level: number
          origin?: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          domain?: string
          firm_id?: string
          id?: string
          key?: Json
          level?: number
          origin?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mapping_rules_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
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
          default_assignee_id: string | null
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
          default_assignee_id?: string | null
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
          default_assignee_id?: string | null
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
            foreignKeyName: "recurring_tasks_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author: string
          body: string
          created_at: string
          delivered_at: string | null
          delivery: string
          direction: string
          external_id: string | null
          firm_id: string
          id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author: string
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery?: string
          direction: string
          external_id?: string | null
          firm_id: string
          id?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery?: string
          direction?: string
          external_id?: string | null
          firm_id?: string
          id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_firm_id_ticket_id_fkey"
            columns: ["firm_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["firm_id", "id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_handled: boolean
          assignee_id: string | null
          channel: string
          company_id: string | null
          contact_identifier: string
          contact_name: string | null
          created_at: string
          department: string | null
          firm_id: string
          handled_by: string
          id: string
          last_inbound_at: string | null
          last_message_at: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          ai_handled?: boolean
          assignee_id?: string | null
          channel: string
          company_id?: string | null
          contact_identifier: string
          contact_name?: string | null
          created_at?: string
          department?: string | null
          firm_id: string
          handled_by?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          ai_handled?: boolean
          assignee_id?: string | null
          channel?: string
          company_id?: string | null
          contact_identifier?: string
          contact_name?: string | null
          created_at?: string
          department?: string | null
          firm_id?: string
          handled_by?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_firm_id_fkey"
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
      apply_cfop_metadata: {
        Args: { p_document_id: string; p_entries: Json }
        Returns: undefined
      }
      apply_triage_suggestion: {
        Args: {
          p_company_id?: string
          p_department?: string
          p_doc_type: string
          p_exception_id: string
          p_note?: string
        }
        Returns: undefined
      }
      auth_user_departments: { Args: never; Returns: string[] }
      cancel_document_request: { Args: { p_id: string }; Returns: undefined }
      correct_classification: {
        Args: { p_doc_type: string; p_document_id: string }
        Returns: undefined
      }
      create_export_batch: { Args: { p_filters: Json }; Returns: string }
      current_firm_id: { Args: never; Returns: string }
      enqueue_triage: { Args: { p_document_id: string }; Returns: undefined }
      generate_recurring_tasks_for_company: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_request_by_token: {
        Args: { p_token: string }
        Returns: {
          company_name: string
          description: string
          document_file_name: string
          expires_at: string
          firm_name: string
          is_expired: boolean
          kind: string
          requested_doc_type: string
          status: string
          title: string
        }[]
      }
      get_request_owner: {
        Args: { p_token: string }
        Returns: {
          company_id: string
          firm_id: string
          is_expired: boolean
          kind: string
        }[]
      }
      handoff_task: { Args: { p_task_id: string }; Returns: string }
      hash_request_token: { Args: { p_token: string }; Returns: string }
      is_firm_manager: { Args: never; Returns: boolean }
      link_ticket_company: {
        Args: {
          p_company_id: string
          p_contact_name?: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      log_audit: {
        Args: {
          p_action: string
          p_context?: Json
          p_entity: string
          p_entity_id?: string
        }
        Returns: string
      }
      log_request_view: {
        Args: { p_ip?: string; p_token: string; p_user_agent?: string }
        Returns: undefined
      }
      mark_export_downloaded: { Args: { p_id: string }; Returns: undefined }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      mark_request_sent: {
        Args: { p_id: string; p_to?: string }
        Returns: undefined
      }
      queue_rules_exception: {
        Args: { p_context: Json; p_suggestion?: Json }
        Returns: string
      }
      record_inbound_message: {
        Args: {
          p_channel: string
          p_external_id: string
          p_firm_id: string
          p_kind: string
          p_raw?: Json
          p_sender: string
          p_subject?: string
        }
        Returns: string
      }
      record_request_download: {
        Args: { p_ip?: string; p_token: string; p_user_agent?: string }
        Returns: string
      }
      record_request_upload: {
        Args: {
          p_file_name: string
          p_hash: string
          p_ip?: string
          p_size: number
          p_storage_path: string
          p_token: string
          p_user_agent?: string
        }
        Returns: string
      }
      reply_support_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: string
      }
      request_enrichment: { Args: { p_company_id: string }; Returns: undefined }
      resolve_exception: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
      }
      return_ticket_to_ai: { Args: { p_ticket_id: string }; Returns: undefined }
      rotate_request_token: {
        Args: { p_expiry_days?: number; p_id: string; p_record_copy?: boolean }
        Returns: string
      }
      set_support_status: {
        Args: { p_note?: string; p_status: string; p_ticket_id: string }
        Returns: undefined
      }
      set_ticket_department: {
        Args: { p_department: string; p_ticket_id: string }
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
