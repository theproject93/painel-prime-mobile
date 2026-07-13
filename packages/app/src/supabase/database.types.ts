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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: number
          payload: Json
          target_tenant_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_team_members: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_file_id: string | null
          photo_url: string | null
          role: string | null
          team_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          role?: string | null
          team_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          role?: string | null
          team_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "advisor_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          leader_member_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          leader_member_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          leader_member_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_teams_leader_member_id_fkey"
            columns: ["leader_member_id"]
            isOneToOne: false
            referencedRelation: "advisor_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runtime_settings: {
        Row: {
          active_model: string
          active_prompt_version_id: string | null
          enabled: boolean
          id: boolean
          logged_dashboard_model: string
          max_tokens: number
          public_sales_lora_id: string | null
          public_sales_model: string
          temperature: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_model?: string
          active_prompt_version_id?: string | null
          enabled?: boolean
          id?: boolean
          logged_dashboard_model?: string
          max_tokens?: number
          public_sales_lora_id?: string | null
          public_sales_model?: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_model?: string
          active_prompt_version_id?: string | null
          enabled?: boolean
          id?: boolean
          logged_dashboard_model?: string
          max_tokens?: number
          public_sales_lora_id?: string | null
          public_sales_model?: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runtime_settings_active_prompt_version_id_fkey"
            columns: ["active_prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_system_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_system_prompt_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          prompt: string
          scope: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          prompt: string
          scope?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          prompt?: string
          scope?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_system_prompt_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      async_job_definitions: {
        Row: {
          contract_version: number
          created_at: string
          default_timeout_seconds: number
          description: string | null
          is_active: boolean
          key: string
          max_attempts: number
          name: string
          payload_schema: Json
          queue: string
          updated_at: string
        }
        Insert: {
          contract_version?: number
          created_at?: string
          default_timeout_seconds?: number
          description?: string | null
          is_active?: boolean
          key: string
          max_attempts?: number
          name: string
          payload_schema?: Json
          queue?: string
          updated_at?: string
        }
        Update: {
          contract_version?: number
          created_at?: string
          default_timeout_seconds?: number
          description?: string | null
          is_active?: boolean
          key?: string
          max_attempts?: number
          name?: string
          payload_schema?: Json
          queue?: string
          updated_at?: string
        }
        Relationships: []
      }
      async_job_runs: {
        Row: {
          correlation_id: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          initiated_by: string | null
          input_payload: Json
          job_key: string
          output_payload: Json
          started_at: string | null
          status: string
          tenant_id: string | null
          trigger_source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          input_payload?: Json
          job_key: string
          output_payload?: Json
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          trigger_source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          input_payload?: Json
          job_key?: string
          output_payload?: Json
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          trigger_source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "async_job_runs_job_key_fkey"
            columns: ["job_key"]
            isOneToOne: false
            referencedRelation: "async_job_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "async_job_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_checkout_attempts: {
        Row: {
          action: string
          amount_cents: number | null
          billing_cycle: string
          checkout_url: string | null
          created_at: string
          currency: string
          external_reference: string
          id: string
          last_webhook_at: string | null
          metadata: Json
          plan_id: string
          plan_name: string | null
          provider: string
          provider_checkout_preference_id: string | null
          provider_payment_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          amount_cents?: number | null
          billing_cycle?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          external_reference: string
          id?: string
          last_webhook_at?: string | null
          metadata?: Json
          plan_id: string
          plan_name?: string | null
          provider: string
          provider_checkout_preference_id?: string | null
          provider_payment_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          amount_cents?: number | null
          billing_cycle?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          external_reference?: string
          id?: string
          last_webhook_at?: string | null
          metadata?: Json
          plan_id?: string
          plan_name?: string | null
          provider?: string
          provider_checkout_preference_id?: string | null
          provider_payment_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          external_reference: string | null
          id: string
          payer_email: string | null
          payment_method_id: string | null
          payment_type_id: string | null
          processed_at: string
          provider: string
          provider_checkout_preference_id: string | null
          provider_merchant_order_id: string | null
          provider_payment_id: string
          raw_payload: Json
          status: string
          status_detail: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          external_reference?: string | null
          id?: string
          payer_email?: string | null
          payment_method_id?: string | null
          payment_type_id?: string | null
          processed_at?: string
          provider?: string
          provider_checkout_preference_id?: string | null
          provider_merchant_order_id?: string | null
          provider_payment_id: string
          raw_payload?: Json
          status?: string
          status_detail?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          external_reference?: string | null
          id?: string
          payer_email?: string | null
          payment_method_id?: string | null
          payment_type_id?: string | null
          processed_at?: string
          provider?: string
          provider_checkout_preference_id?: string | null
          provider_merchant_order_id?: string | null
          provider_payment_id?: string
          raw_payload?: Json
          status?: string
          status_detail?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_entitlements: {
        Row: {
          created_at: string
          features: Json
          metadata: Json
          monthly_ai_turns: number
          plan_id: string
          plan_name: string
          seat_limit: number
          storage_gb: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          features?: Json
          metadata?: Json
          monthly_ai_turns?: number
          plan_id: string
          plan_name: string
          seat_limit?: number
          storage_gb?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          features?: Json
          metadata?: Json
          monthly_ai_turns?: number
          plan_id?: string
          plan_name?: string
          seat_limit?: number
          storage_gb?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          amount_cents: number | null
          billing_cycle: string
          created_at: string
          currency: string
          current_period_end: string | null
          external_reference: string | null
          last_payment_at: string | null
          last_payment_id: string | null
          last_payment_status: string | null
          plan_id: string | null
          plan_name: string | null
          provider: string
          provider_checkout_preference_id: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          external_reference?: string | null
          last_payment_at?: string | null
          last_payment_id?: string | null
          last_payment_status?: string | null
          plan_id?: string | null
          plan_name?: string | null
          provider?: string
          provider_checkout_preference_id?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          external_reference?: string | null
          last_payment_at?: string | null
          last_payment_id?: string | null
          last_payment_status?: string | null
          plan_id?: string | null
          plan_name?: string | null
          provider?: string
          provider_checkout_preference_id?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          document_kind: Database["public"]["Enums"]["document_template_kind"]
          editor_payload: Json
          generation_job_id: string | null
          id: string
          pdf_file_id: string | null
          source_data_snapshot: Json
          status: Database["public"]["Enums"]["client_document_status"]
          template_version_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          document_kind: Database["public"]["Enums"]["document_template_kind"]
          editor_payload?: Json
          generation_job_id?: string | null
          id?: string
          pdf_file_id?: string | null
          source_data_snapshot?: Json
          status?: Database["public"]["Enums"]["client_document_status"]
          template_version_id?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          document_kind?: Database["public"]["Enums"]["document_template_kind"]
          editor_payload?: Json
          generation_job_id?: string | null
          id?: string
          pdf_file_id?: string | null
          source_data_snapshot?: Json
          status?: Database["public"]["Enums"]["client_document_status"]
          template_version_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "document_processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communications_index: {
        Row: {
          created_at: string
          direction: string
          failure_reason: string | null
          has_attachments: boolean
          id: string
          in_reply_to: string | null
          message_id: string
          preview_text: string | null
          r2_object_key: string
          received_at: string | null
          recipient: string
          recipient_alias: string
          sender: string
          sent_at: string | null
          status: string
          subject: string
          thread_message_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: string
          failure_reason?: string | null
          has_attachments?: boolean
          id?: string
          in_reply_to?: string | null
          message_id: string
          preview_text?: string | null
          r2_object_key: string
          received_at?: string | null
          recipient: string
          recipient_alias: string
          sender: string
          sent_at?: string | null
          status: string
          subject?: string
          thread_message_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          failure_reason?: string | null
          has_attachments?: boolean
          id?: string
          in_reply_to?: string | null
          message_id?: string
          preview_text?: string | null
          r2_object_key?: string
          received_at?: string | null
          recipient?: string
          recipient_alias?: string
          sender?: string
          sent_at?: string | null
          status?: string
          subject?: string
          thread_message_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_client_addresses: {
        Row: {
          city: string | null
          client_id: string
          complement: string | null
          created_at: string
          id: string
          label: string
          neighborhood: string | null
          number: string | null
          person_id: string | null
          state: string | null
          street: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          city?: string | null
          client_id: string
          complement?: string | null
          created_at?: string
          id?: string
          label?: string
          neighborhood?: string | null
          number?: string | null
          person_id?: string | null
          state?: string | null
          street?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          city?: string | null
          client_id?: string
          complement?: string | null
          created_at?: string
          id?: string
          label?: string
          neighborhood?: string | null
          number?: string | null
          person_id?: string | null
          state?: string | null
          street?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_addresses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "crm_client_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_checklist_items: {
        Row: {
          client_id: string
          completed: boolean
          created_at: string
          id: string
          position: number
          priority: string
          source: string | null
          source_playbook_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          priority?: string
          source?: string | null
          source_playbook_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          priority?: string
          source?: string | null
          source_playbook_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_checklist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_checklist_items_source_playbook_id_fkey"
            columns: ["source_playbook_id"]
            isOneToOne: false
            referencedRelation: "crm_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_checklist_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_documents: {
        Row: {
          advisor_email: string | null
          advisor_ip: string | null
          advisor_name: string | null
          advisor_signature_hash_sha256: string | null
          advisor_signature_image: string | null
          advisor_signed_at: string | null
          advisor_user_agent: string | null
          advisor_user_id: string | null
          approval_status: string
          approved_at: string | null
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          doc_type: string
          external_document_id: string | null
          external_link_id: string | null
          external_metadata: Json
          external_provider: string | null
          external_status: string | null
          external_url: string | null
          id: string
          pdf_file_id: string | null
          pdf_file_url: string | null
          rendered_html: string | null
          signed_at: string | null
          source_data_snapshot: Json
          status: string
          template_id: string | null
          template_version: number | null
          template_version_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advisor_email?: string | null
          advisor_ip?: string | null
          advisor_name?: string | null
          advisor_signature_hash_sha256?: string | null
          advisor_signature_image?: string | null
          advisor_signed_at?: string | null
          advisor_user_agent?: string | null
          advisor_user_id?: string | null
          approval_status?: string
          approved_at?: string | null
          client_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          doc_type: string
          external_document_id?: string | null
          external_link_id?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_status?: string | null
          external_url?: string | null
          id?: string
          pdf_file_id?: string | null
          pdf_file_url?: string | null
          rendered_html?: string | null
          signed_at?: string | null
          source_data_snapshot?: Json
          status?: string
          template_id?: string | null
          template_version?: number | null
          template_version_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advisor_email?: string | null
          advisor_ip?: string | null
          advisor_name?: string | null
          advisor_signature_hash_sha256?: string | null
          advisor_signature_image?: string | null
          advisor_signed_at?: string | null
          advisor_user_agent?: string | null
          advisor_user_id?: string | null
          approval_status?: string
          approved_at?: string | null
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          external_document_id?: string | null
          external_link_id?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_status?: string | null
          external_url?: string | null
          id?: string
          pdf_file_id?: string | null
          pdf_file_url?: string | null
          rendered_html?: string | null
          signed_at?: string | null
          source_data_snapshot?: Json
          status?: string
          template_id?: string | null
          template_version?: number | null
          template_version_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_documents_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_documents_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_people: {
        Row: {
          birth_date: string | null
          civil_status: string | null
          client_id: string
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          nationality: string | null
          phone: string | null
          profession: string | null
          rg: string | null
          role_label: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          civil_status?: string | null
          client_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          nationality?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          role_label?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          civil_status?: string | null
          client_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          nationality?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          role_label?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_people_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_stage_history: {
        Row: {
          changed_at: string
          client_id: string
          from_stage: string | null
          id: string
          reason: string | null
          tenant_id: string | null
          to_stage: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          client_id: string
          from_stage?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string | null
          to_stage: string
          user_id: string
        }
        Update: {
          changed_at?: string
          client_id?: string
          from_stage?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string | null
          to_stage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_stage_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_stage_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          budget_expected: number | null
          created_at: string
          created_by: string | null
          email: string | null
          event_date_expected: string | null
          event_type: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          papermark_score: number | null
          phone: string | null
          stage: string
          stage_changed_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          won_at: string | null
        }
        Insert: {
          budget_expected?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_date_expected?: string | null
          event_type?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          papermark_score?: number | null
          phone?: string | null
          stage?: string
          stage_changed_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
          won_at?: string | null
        }
        Update: {
          budget_expected?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_date_expected?: string | null
          event_type?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          papermark_score?: number | null
          phone?: string | null
          stage?: string
          stage_changed_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_consent_records: {
        Row: {
          client_id: string
          consent_note: string | null
          consent_text_version: string
          consented_at: string
          created_at: string
          created_by: string | null
          id: string
          lawful_basis: string
          source: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          consent_note?: string | null
          consent_text_version?: string
          consented_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lawful_basis?: string
          source?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          consent_note?: string | null
          consent_text_version?: string
          consented_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lawful_basis?: string
          source?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_consent_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_consent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contract_data: {
        Row: {
          cancellation_terms: string | null
          client_id: string
          created_at: string
          currency: string
          foro_city: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          service_scope: string | null
          tenant_id: string | null
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_terms?: string | null
          client_id: string
          created_at?: string
          currency?: string
          foro_city?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          service_scope?: string | null
          tenant_id?: string | null
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_terms?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          foro_city?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          service_scope?: string | null
          tenant_id?: string | null
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contract_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contract_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_data_rooms: {
        Row: {
          client_id: string
          created_at: string
          external_dataroom_id: string | null
          external_link_id: string | null
          external_provider: string
          external_url: string | null
          id: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          external_dataroom_id?: string | null
          external_link_id?: string | null
          external_provider?: string
          external_url?: string | null
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          external_dataroom_id?: string | null
          external_link_id?: string | null
          external_provider?: string
          external_url?: string | null
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_data_rooms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_data_rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_dataroom_documents: {
        Row: {
          added_at: string
          dataroom_id: string
          document_id: string | null
          document_type: string
          external_document_id: string | null
          external_provider: string
          id: string
          title: string
        }
        Insert: {
          added_at?: string
          dataroom_id: string
          document_id?: string | null
          document_type: string
          external_document_id?: string | null
          external_provider?: string
          id?: string
          title: string
        }
        Update: {
          added_at?: string
          dataroom_id?: string
          document_id?: string | null
          document_type?: string
          external_document_id?: string | null
          external_provider?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_dataroom_documents_dataroom_id_fkey"
            columns: ["dataroom_id"]
            isOneToOne: false
            referencedRelation: "crm_data_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_dataroom_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "crm_client_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_document_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followup_rules: {
        Row: {
          active: boolean
          created_at: string
          days_without_reply: number
          id: string
          stage_filter: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_without_reply?: number
          id?: string
          stage_filter?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_without_reply?: number
          id?: string
          stage_filter?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_followup_tasks: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          reason: string | null
          rule_id: string | null
          source_kind: string | null
          source_ref: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          reason?: string | null
          rule_id?: string | null
          source_kind?: string | null
          source_ref?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          reason?: string | null
          rule_id?: string | null
          source_kind?: string | null
          source_ref?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followup_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followup_tasks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_followup_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_integration_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          consecutive_failures: number
          created_at: string
          event_type: string
          id: string
          last_error_message: string | null
          last_failed_at: string
          provider: string
          tenant_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          consecutive_failures?: number
          created_at?: string
          event_type: string
          id?: string
          last_error_message?: string | null
          last_failed_at?: string
          provider: string
          tenant_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          consecutive_failures?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error_message?: string | null
          last_failed_at?: string
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_integration_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_integration_events: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          metadata: Json
          payload_hash: string
          provider: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          metadata?: Json
          payload_hash: string
          provider: string
          status: string
          tenant_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          payload_hash?: string
          provider?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_integration_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_integration_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_interactions: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          created_by: string | null
          direction: string
          happened_at: string
          id: string
          next_followup_at: string | null
          summary: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          created_by?: string | null
          direction?: string
          happened_at?: string
          id?: string
          next_followup_at?: string | null
          summary: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          happened_at?: string
          id?: string
          next_followup_at?: string | null
          summary?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_playbook_executions: {
        Row: {
          action_executed: boolean
          action_result: Json | null
          client_id: string | null
          error_message: string | null
          executed_at: string
          id: string
          playbook_id: string
          trigger_data: Json | null
          trigger_event: string | null
        }
        Insert: {
          action_executed?: boolean
          action_result?: Json | null
          client_id?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          playbook_id: string
          trigger_data?: Json | null
          trigger_event?: string | null
        }
        Update: {
          action_executed?: boolean
          action_result?: Json | null
          client_id?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          playbook_id?: string
          trigger_data?: Json | null
          trigger_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_playbook_executions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_playbook_executions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "crm_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_playbooks: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          tenant_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_playbooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_portfolio_shares: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          pdf_file_id: string | null
          pdf_url: string | null
          sender_email: string | null
          sender_instagram: string | null
          sender_name: string | null
          sender_whatsapp: string | null
          tenant_id: string | null
          title: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pdf_file_id?: string | null
          pdf_url?: string | null
          sender_email?: string | null
          sender_instagram?: string | null
          sender_name?: string | null
          sender_whatsapp?: string | null
          tenant_id?: string | null
          title?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pdf_file_id?: string | null
          pdf_url?: string | null
          sender_email?: string | null
          sender_instagram?: string | null
          sender_name?: string | null
          sender_whatsapp?: string | null
          tenant_id?: string | null
          title?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_portfolio_shares_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_portfolio_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_priority_weights: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          weight_key: string
          weight_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          weight_key: string
          weight_value: number
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          weight_key?: string
          weight_value?: number
        }
        Relationships: []
      }
      crm_quote_approval_requests: {
        Row: {
          approved_at: string | null
          approved_ip: string | null
          approved_user_agent: string | null
          client_email: string | null
          client_id: string
          client_name: string
          created_at: string
          document_id: string
          expires_at: string
          id: string
          status: string
          tenant_id: string
          token_hash_sha256: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_ip?: string | null
          approved_user_agent?: string | null
          client_email?: string | null
          client_id: string
          client_name: string
          created_at?: string
          document_id: string
          expires_at?: string
          id?: string
          status?: string
          tenant_id?: string
          token_hash_sha256: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          approved_at?: string | null
          approved_ip?: string | null
          approved_user_agent?: string | null
          client_email?: string | null
          client_id?: string
          client_name?: string
          created_at?: string
          document_id?: string
          expires_at?: string
          id?: string
          status?: string
          tenant_id?: string
          token_hash_sha256?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quote_approval_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quote_approval_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "crm_client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quote_approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_retention_deletions: {
        Row: {
          client_id: string
          client_name: string | null
          deleted_at: string
          event_type: string | null
          id: string
          lost_at: string | null
          reason: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_name?: string | null
          deleted_at?: string
          event_type?: string | null
          id?: string
          lost_at?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_name?: string | null
          deleted_at?: string
          event_type?: string | null
          id?: string
          lost_at?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_signature_audit_logs: {
        Row: {
          canonical_payload: string
          client_id: string
          cpf_cliente: string
          created_at: string
          data_hora: string
          document_id: string
          email_cliente: string | null
          hash_validacao_sha256: string
          id: string
          ip_cliente: string
          pdf_file_id: string | null
          signature_request_id: string
          signed_pdf_file_id: string | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          canonical_payload: string
          client_id: string
          cpf_cliente: string
          created_at?: string
          data_hora?: string
          document_id: string
          email_cliente?: string | null
          hash_validacao_sha256: string
          id?: string
          ip_cliente: string
          pdf_file_id?: string | null
          signature_request_id: string
          signed_pdf_file_id?: string | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          canonical_payload?: string
          client_id?: string
          cpf_cliente?: string
          created_at?: string
          data_hora?: string
          document_id?: string
          email_cliente?: string | null
          hash_validacao_sha256?: string
          id?: string
          ip_cliente?: string
          pdf_file_id?: string | null
          signature_request_id?: string
          signed_pdf_file_id?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_signature_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_audit_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "crm_client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_audit_logs_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_audit_logs_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "crm_signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_audit_logs_signed_pdf_file_id_fkey"
            columns: ["signed_pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_signature_requests: {
        Row: {
          client_email: string | null
          client_id: string
          client_name: string
          cpf_cliente: string | null
          created_at: string
          created_by: string | null
          document_id: string
          expires_at: string | null
          external_document_id: string | null
          external_metadata: Json
          external_provider: string | null
          external_recipient_id: string | null
          external_signing_token: string | null
          external_status: string | null
          external_url: string | null
          hash_validacao_sha256: string | null
          id: string
          ip_cliente: string | null
          signed_at: string | null
          signed_pdf_file_id: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          tenant_id: string | null
          token: string
          token_hash_sha256: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_id: string
          client_name: string
          cpf_cliente?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          expires_at?: string | null
          external_document_id?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_recipient_id?: string | null
          external_signing_token?: string | null
          external_status?: string | null
          external_url?: string | null
          hash_validacao_sha256?: string | null
          id?: string
          ip_cliente?: string | null
          signed_at?: string | null
          signed_pdf_file_id?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          tenant_id?: string | null
          token?: string
          token_hash_sha256?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_id?: string
          client_name?: string
          cpf_cliente?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          expires_at?: string | null
          external_document_id?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_recipient_id?: string | null
          external_signing_token?: string | null
          external_status?: string | null
          external_url?: string | null
          hash_validacao_sha256?: string | null
          id?: string
          ip_cliente?: string | null
          signed_at?: string | null
          signed_pdf_file_id?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          tenant_id?: string | null
          token?: string
          token_hash_sha256?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_signature_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "crm_client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_requests_signed_pdf_file_id_fkey"
            columns: ["signed_pdf_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_signature_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_playbook_steps: {
        Row: {
          active: boolean
          created_at: string
          due_offset_days: number
          event_type: string | null
          id: string
          reason: string | null
          stage: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          due_offset_days?: number
          event_type?: string | null
          id?: string
          reason?: string | null
          stage: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          due_offset_days?: number
          event_type?: string | null
          id?: string
          reason?: string | null
          stage?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_webhook_retry_queue: {
        Row: {
          acknowledged: boolean
          client_id: string | null
          created_at: string
          event_type: string
          headers: Json
          id: string
          last_error: string | null
          last_retried_at: string | null
          max_retries: number
          next_retry_at: string
          payload: Json
          provider: string
          retry_count: number
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          client_id?: string | null
          created_at?: string
          event_type: string
          headers?: Json
          id?: string
          last_error?: string | null
          last_retried_at?: string | null
          max_retries?: number
          next_retry_at?: string
          payload: Json
          provider: string
          retry_count?: number
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          client_id?: string | null
          created_at?: string
          event_type?: string
          headers?: Json
          id?: string
          last_error?: string | null
          last_retried_at?: string | null
          max_retries?: number
          next_retry_at?: string
          payload?: Json
          provider?: string
          retry_count?: number
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_webhook_retry_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webhook_retry_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_extraction_drafts: {
        Row: {
          applied_at: string | null
          clauses_payload: Json
          created_at: string
          created_by: string | null
          event_id: string
          finance_payload: Json
          id: string
          job_id: string
          review_status: Database["public"]["Enums"]["document_extraction_review_status"]
          reviewed_by: string | null
          stored_file_id: string
          supplier_payload: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          clauses_payload?: Json
          created_at?: string
          created_by?: string | null
          event_id: string
          finance_payload?: Json
          id?: string
          job_id: string
          review_status?: Database["public"]["Enums"]["document_extraction_review_status"]
          reviewed_by?: string | null
          stored_file_id: string
          supplier_payload?: Json
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          clauses_payload?: Json
          created_at?: string
          created_by?: string | null
          event_id?: string
          finance_payload?: Json
          id?: string
          job_id?: string
          review_status?: Database["public"]["Enums"]["document_extraction_review_status"]
          reviewed_by?: string | null
          stored_file_id?: string
          supplier_payload?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_extraction_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extraction_drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "document_processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extraction_drafts_stored_file_id_fkey"
            columns: ["stored_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extraction_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_processing_jobs: {
        Row: {
          async_job_run_id: string | null
          attempt_count: number
          chat_message_id: string | null
          chat_thread_id: string | null
          context_id: string | null
          context_type: Database["public"]["Enums"]["document_context_type"]
          created_at: string
          created_by: string | null
          error_payload: Json
          finished_at: string | null
          id: string
          input_payload: Json
          model: string
          processing_kind: Database["public"]["Enums"]["document_processing_kind"]
          provider: string
          result_payload: Json
          started_at: string | null
          status: Database["public"]["Enums"]["document_processing_status"]
          stored_file_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          async_job_run_id?: string | null
          attempt_count?: number
          chat_message_id?: string | null
          chat_thread_id?: string | null
          context_id?: string | null
          context_type: Database["public"]["Enums"]["document_context_type"]
          created_at?: string
          created_by?: string | null
          error_payload?: Json
          finished_at?: string | null
          id?: string
          input_payload?: Json
          model?: string
          processing_kind: Database["public"]["Enums"]["document_processing_kind"]
          provider?: string
          result_payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["document_processing_status"]
          stored_file_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          async_job_run_id?: string | null
          attempt_count?: number
          chat_message_id?: string | null
          chat_thread_id?: string | null
          context_id?: string | null
          context_type?: Database["public"]["Enums"]["document_context_type"]
          created_at?: string
          created_by?: string | null
          error_payload?: Json
          finished_at?: string | null
          id?: string
          input_payload?: Json
          model?: string
          processing_kind?: Database["public"]["Enums"]["document_processing_kind"]
          provider?: string
          result_payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["document_processing_status"]
          stored_file_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_jobs_async_job_run_id_fkey"
            columns: ["async_job_run_id"]
            isOneToOne: false
            referencedRelation: "async_job_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_processing_jobs_stored_file_id_fkey"
            columns: ["stored_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_processing_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_versions: {
        Row: {
          created_at: string
          created_by: string | null
          editor_payload: Json
          id: string
          rendered_html: string | null
          template_id: string
          variables_schema: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          editor_payload?: Json
          id?: string
          rendered_html?: string | null
          template_id: string
          variables_schema?: Json
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          editor_payload?: Json
          id?: string
          rendered_html?: string | null
          template_id?: string
          variables_schema?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          document_kind: Database["public"]["Enums"]["document_template_kind"]
          editor_format: string
          id: string
          is_default: boolean
          logo_file_id: string | null
          logo_url: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          document_kind: Database["public"]["Enums"]["document_template_kind"]
          editor_format?: string
          id?: string
          is_default?: boolean
          logo_file_id?: string | null
          logo_url?: string | null
          name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          document_kind?: Database["public"]["Enums"]["document_template_kind"]
          editor_format?: string
          id?: string
          is_default?: boolean
          logo_file_id?: string | null
          logo_url?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkin_config: {
        Row: {
          created_at: string
          event_id: string
          id: string
          pin_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          pin_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          pin_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkin_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_client_access: {
        Row: {
          access_token_hash: string | null
          client_name: string | null
          client_phone: string | null
          event_id: string
          expires_at: string | null
          id: string
          revoked_at: string | null
        }
        Insert: {
          access_token_hash?: string | null
          client_name?: string | null
          client_phone?: string | null
          event_id: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
        }
        Update: {
          access_token_hash?: string | null
          client_name?: string | null
          client_phone?: string | null
          event_id?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_client_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_command_alerts: {
        Row: {
          alert_type: string
          created_at: string
          dedupe_key: string
          event_id: string
          id: string
          message: string
          resolved_at: string | null
          severity: string
          tenant_id: string | null
          triggered_for: string | null
          vendor_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          dedupe_key: string
          event_id: string
          id?: string
          message: string
          resolved_at?: string | null
          severity: string
          tenant_id?: string | null
          triggered_for?: string | null
          vendor_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          dedupe_key?: string
          event_id?: string
          id?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          tenant_id?: string | null
          triggered_for?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_command_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_command_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_command_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_command_config: {
        Row: {
          created_at: string
          event_id: string
          late_grace_minutes: number
          lead_minutes: number[]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          late_grace_minutes?: number
          lead_minutes?: number[]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          late_grace_minutes?: number
          lead_minutes?: number[]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_command_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_command_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_command_incidents: {
        Row: {
          action_plan: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          tenant_id: string | null
          title: string
          vendor_id: string | null
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string | null
          title: string
          vendor_id?: string | null
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string | null
          title?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_command_incidents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_command_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_command_incidents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_couple_updates: {
        Row: {
          author_name: string | null
          author_role: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          kind: string
          message: string
          photo_file_id: string | null
          photo_url: string | null
          tenant_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          author_name?: string | null
          author_role?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          kind?: string
          message: string
          photo_file_id?: string | null
          photo_url?: string | null
          tenant_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          author_name?: string | null
          author_role?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          kind?: string
          message?: string
          photo_file_id?: string | null
          photo_url?: string | null
          tenant_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_couple_updates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_couple_updates_photo_file_id_fkey"
            columns: ["photo_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_couple_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          event_id: string
          file_id: string | null
          file_type: string | null
          file_url: string | null
          id: string
          name: string
          tenant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          file_id?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          file_id?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expenses: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          name: string
          status: string
          tenant_id: string | null
          value: number
          vendor_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          name: string
          status?: string
          tenant_id?: string | null
          value?: number
          vendor_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          name?: string
          status?: string
          tenant_id?: string | null
          value?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_expenses_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_groups: {
        Row: {
          created_at: string
          event_id: string
          group_label: string | null
          id: string
          last_portal_saved_at: string | null
          source: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          group_label?: string | null
          id?: string
          last_portal_saved_at?: string | null
          source?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          group_label?: string | null
          id?: string
          last_portal_saved_at?: string | null
          source?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guest_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guests: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          companion_names: Json
          confirmed: boolean
          created_at: string
          created_by: string | null
          dietary_restrictions: string | null
          event_id: string
          family_group_id: string | null
          group_leader_id: string | null
          group_sort_order: number
          guest_source: string
          id: string
          invite_dispatch_channel: string | null
          invite_dispatch_error: string | null
          invite_dispatch_last_at: string | null
          invite_dispatch_message_id: string | null
          invite_dispatch_payload: Json
          invite_dispatch_status: string | null
          invite_token: string | null
          invited_at: string | null
          is_group_leader: boolean
          name: string
          phone: string | null
          plus_one_count: number
          qr_token: string | null
          responded_at: string | null
          rsvp_note: string | null
          rsvp_status: string
          table_id: string | null
          tenant_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_names?: Json
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          dietary_restrictions?: string | null
          event_id: string
          family_group_id?: string | null
          group_leader_id?: string | null
          group_sort_order?: number
          guest_source?: string
          id?: string
          invite_dispatch_channel?: string | null
          invite_dispatch_error?: string | null
          invite_dispatch_last_at?: string | null
          invite_dispatch_message_id?: string | null
          invite_dispatch_payload?: Json
          invite_dispatch_status?: string | null
          invite_token?: string | null
          invited_at?: string | null
          is_group_leader?: boolean
          name: string
          phone?: string | null
          plus_one_count?: number
          qr_token?: string | null
          responded_at?: string | null
          rsvp_note?: string | null
          rsvp_status?: string
          table_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_names?: Json
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          dietary_restrictions?: string | null
          event_id?: string
          family_group_id?: string | null
          group_leader_id?: string | null
          group_sort_order?: number
          guest_source?: string
          id?: string
          invite_dispatch_channel?: string | null
          invite_dispatch_error?: string | null
          invite_dispatch_last_at?: string | null
          invite_dispatch_message_id?: string | null
          invite_dispatch_payload?: Json
          invite_dispatch_status?: string | null
          invite_token?: string | null
          invited_at?: string | null
          is_group_leader?: boolean
          name?: string
          phone?: string | null
          plus_one_count?: number
          qr_token?: string | null
          responded_at?: string | null
          rsvp_note?: string | null
          rsvp_status?: string
          table_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "event_guest_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_group_leader_id_fkey"
            columns: ["group_leader_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_gallery_items: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          file_id: string | null
          id: string
          image_url: string
          sort_order: number
          status: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          file_id?: string | null
          id?: string
          image_url: string
          sort_order?: number
          status?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          file_id?: string | null
          id?: string
          image_url?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_gallery_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_gallery_items_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_song_suggestions: {
        Row: {
          artist: string | null
          created_at: string
          event_id: string
          guest_name: string
          id: string
          link: string | null
          moderated_at: string | null
          song_title: string
          status: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          event_id: string
          guest_name?: string
          id?: string
          link?: string | null
          moderated_at?: string | null
          song_title: string
          status?: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          event_id?: string
          guest_name?: string
          id?: string
          link?: string | null
          moderated_at?: string | null
          song_title?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_song_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_map_fixtures: {
        Row: {
          created_at: string
          created_by: string | null
          custom_label: string | null
          event_id: string
          h: number
          id: string
          tenant_id: string | null
          type: string
          updated_at: string
          w: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_label?: string | null
          event_id: string
          h?: number
          id?: string
          tenant_id?: string | null
          type: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_label?: string | null
          event_id?: string
          h?: number
          id?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_map_fixtures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_map_fixtures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_meetings: {
        Row: {
          ata_retry_count: number
          created_at: string
          daily_room_name: string | null
          event_id: string
          id: string
          notes: string | null
          room_url: string | null
          scheduled_at: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ata_retry_count?: number
          created_at?: string
          daily_room_name?: string | null
          event_id: string
          id?: string
          notes?: string | null
          room_url?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ata_retry_count?: number
          created_at?: string
          daily_room_name?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          room_url?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_meetings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notes: {
        Row: {
          color: string | null
          content: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          event_id: string
          expense_id: string
          id: string
          method: string
          note: string | null
          paid_at: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id: string
          expense_id: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id?: string
          expense_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_expense_fk"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "event_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reception_tokens: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string
          id: string
          member_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          member_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          member_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reception_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reception_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "event_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          name: string
          note: string | null
          pos_x: number | null
          pos_y: number | null
          posx: number | null
          posy: number | null
          seats: number | null
          shape: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          name: string
          note?: string | null
          pos_x?: number | null
          pos_y?: number | null
          posx?: number | null
          posy?: number | null
          seats?: number | null
          shape?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          name?: string
          note?: string | null
          pos_x?: number | null
          pos_y?: number | null
          posx?: number | null
          posy?: number | null
          seats?: number | null
          shape?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          assignee_name: string | null
          completed: boolean
          created_at: string
          created_by: string | null
          due_date: string | null
          event_id: string
          id: string
          notes: string | null
          position: number
          priority: string | null
          tenant_id: string | null
          text: string
        }
        Insert: {
          assignee_name?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          event_id: string
          id?: string
          notes?: string | null
          position?: number
          priority?: string | null
          tenant_id?: string | null
          text: string
        }
        Update: {
          assignee_name?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          position?: number
          priority?: string | null
          tenant_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_members: {
        Row: {
          address: string | null
          advisor_team_id: string | null
          advisor_team_member_id: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_leader: boolean
          name: string
          phone: string | null
          photo_file_id: string | null
          photo_url: string | null
          role: string | null
          team_name: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          advisor_team_id?: string | null
          advisor_team_member_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_leader?: boolean
          name: string
          phone?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          role?: string | null
          team_name?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          advisor_team_id?: string | null
          advisor_team_member_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_leader?: boolean
          name?: string
          phone?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          role?: string | null
          team_name?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_team_members_advisor_team_id_fkey"
            columns: ["advisor_team_id"]
            isOneToOne: false
            referencedRelation: "advisor_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_advisor_team_member_id_fkey"
            columns: ["advisor_team_member_id"]
            isOneToOne: false
            referencedRelation: "advisor_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_timeline: {
        Row: {
          activity: string
          assignee_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string
          id: string
          position: number
          tenant_id: string | null
          time: string
        }
        Insert: {
          activity: string
          assignee_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id: string
          id?: string
          position?: number
          tenant_id?: string | null
          time: string
        }
        Update: {
          activity?: string
          assignee_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string
          id?: string
          position?: number
          tenant_id?: string | null
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendor_selections: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_selections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendor_status: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          status: string
          tenant_id: string | null
          updated_by: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          status: string
          tenant_id?: string | null
          updated_by: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id?: string | null
          updated_by?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_status_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_status_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendors: {
        Row: {
          catalog_vendor_id: string | null
          category: string
          contract_document_id: string | null
          control_token: string | null
          created_at: string
          created_by: string | null
          email: string | null
          event_id: string
          expected_arrival_time: string | null
          expected_done_time: string | null
          id: string
          import_draft_id: string | null
          import_review_reason: string | null
          import_review_status: string
          is_self_vendor: boolean
          name: string
          notes: string | null
          phone: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          catalog_vendor_id?: string | null
          category: string
          contract_document_id?: string | null
          control_token?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id: string
          expected_arrival_time?: string | null
          expected_done_time?: string | null
          id?: string
          import_draft_id?: string | null
          import_review_reason?: string | null
          import_review_status?: string
          is_self_vendor?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          catalog_vendor_id?: string | null
          category?: string
          contract_document_id?: string | null
          control_token?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id?: string
          expected_arrival_time?: string | null
          expected_done_time?: string | null
          id?: string
          import_draft_id?: string | null
          import_review_reason?: string | null
          import_review_status?: string
          is_self_vendor?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_vendors_catalog_vendor_id_fkey"
            columns: ["catalog_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "event_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_import_draft_id_fkey"
            columns: ["import_draft_id"]
            isOneToOne: false
            referencedRelation: "document_extraction_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_website_settings: {
        Row: {
          address: string | null
          allow_client_editing: boolean
          canva_dns_configured_at: string | null
          canva_dns_error: string | null
          canva_dns_reverted_at: string | null
          canva_dns_status: string
          canva_txt_host: string | null
          canva_txt_value_hash: string | null
          cloudflare_record_ids: Json
          color_secondary: string
          end_time: string | null
          event_id: string
          features_option: string
          font_body: string
          font_family: string
          font_title: string
          gift_pix_description: string | null
          gift_pix_key: string | null
          gift_pix_qr_file_id: string | null
          gift_pix_qr_image_url: string | null
          hero_image_url: string | null
          hero_position: string
          id: string
          invitation_experience: Json
          invite_hosting_mode: string
          is_published: boolean
          maps_url: string | null
          overlay_intensity: number
          previous_dns_snapshot: Json
          sections_visible: Json
          site_name: string | null
          start_time: string | null
          story_image_url: string | null
          story_text: string | null
          subdomain_slug: string | null
          theme: string
          theme_color: string
        }
        Insert: {
          address?: string | null
          allow_client_editing?: boolean
          canva_dns_configured_at?: string | null
          canva_dns_error?: string | null
          canva_dns_reverted_at?: string | null
          canva_dns_status?: string
          canva_txt_host?: string | null
          canva_txt_value_hash?: string | null
          cloudflare_record_ids?: Json
          color_secondary?: string
          end_time?: string | null
          event_id: string
          features_option?: string
          font_body?: string
          font_family?: string
          font_title?: string
          gift_pix_description?: string | null
          gift_pix_key?: string | null
          gift_pix_qr_file_id?: string | null
          gift_pix_qr_image_url?: string | null
          hero_image_url?: string | null
          hero_position?: string
          id?: string
          invitation_experience?: Json
          invite_hosting_mode?: string
          is_published?: boolean
          maps_url?: string | null
          overlay_intensity?: number
          previous_dns_snapshot?: Json
          sections_visible?: Json
          site_name?: string | null
          start_time?: string | null
          story_image_url?: string | null
          story_text?: string | null
          subdomain_slug?: string | null
          theme?: string
          theme_color?: string
        }
        Update: {
          address?: string | null
          allow_client_editing?: boolean
          canva_dns_configured_at?: string | null
          canva_dns_error?: string | null
          canva_dns_reverted_at?: string | null
          canva_dns_status?: string
          canva_txt_host?: string | null
          canva_txt_value_hash?: string | null
          cloudflare_record_ids?: Json
          color_secondary?: string
          end_time?: string | null
          event_id?: string
          features_option?: string
          font_body?: string
          font_family?: string
          font_title?: string
          gift_pix_description?: string | null
          gift_pix_key?: string | null
          gift_pix_qr_file_id?: string | null
          gift_pix_qr_image_url?: string | null
          hero_image_url?: string | null
          hero_position?: string
          id?: string
          invitation_experience?: Json
          invite_hosting_mode?: string
          is_published?: boolean
          maps_url?: string | null
          overlay_intensity?: number
          previous_dns_snapshot?: Json
          sections_visible?: Json
          site_name?: string | null
          start_time?: string | null
          story_image_url?: string | null
          story_text?: string | null
          subdomain_slug?: string | null
          theme?: string
          theme_color?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_website_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_website_settings_gift_pix_qr_file_id_fkey"
            columns: ["gift_pix_qr_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget_total: number | null
          couple: string | null
          couple_photo_file_id: string | null
          couple_photo_url: string | null
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          guests_planned: number | null
          id: string
          invite_dress_code: string | null
          invite_message_template: string | null
          location: string | null
          location_city: string | null
          location_complement: string | null
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_neighborhood: string | null
          location_number: string | null
          location_place_id: string | null
          location_place_instagram: string | null
          location_place_name: string | null
          location_place_phone: string | null
          location_place_website: string | null
          location_state: string | null
          location_street: string | null
          location_zip_code: string | null
          name: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
          whatsapp_image_file_id: string | null
          whatsapp_image_url: string | null
        }
        Insert: {
          budget_total?: number | null
          couple?: string | null
          couple_photo_file_id?: string | null
          couple_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type: string
          guests_planned?: number | null
          id?: string
          invite_dress_code?: string | null
          invite_message_template?: string | null
          location?: string | null
          location_city?: string | null
          location_complement?: string | null
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_neighborhood?: string | null
          location_number?: string | null
          location_place_id?: string | null
          location_place_instagram?: string | null
          location_place_name?: string | null
          location_place_phone?: string | null
          location_place_website?: string | null
          location_state?: string | null
          location_street?: string | null
          location_zip_code?: string | null
          name: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
          whatsapp_image_file_id?: string | null
          whatsapp_image_url?: string | null
        }
        Update: {
          budget_total?: number | null
          couple?: string | null
          couple_photo_file_id?: string | null
          couple_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          guests_planned?: number | null
          id?: string
          invite_dress_code?: string | null
          invite_message_template?: string | null
          location?: string | null
          location_city?: string | null
          location_complement?: string | null
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_neighborhood?: string | null
          location_number?: string | null
          location_place_id?: string | null
          location_place_instagram?: string | null
          location_place_name?: string | null
          location_place_phone?: string | null
          location_place_website?: string | null
          location_state?: string | null
          location_street?: string | null
          location_zip_code?: string | null
          name?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
          whatsapp_image_file_id?: string | null
          whatsapp_image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_couple_photo_file_id_fkey"
            columns: ["couple_photo_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_whatsapp_image_file_id_fkey"
            columns: ["whatsapp_image_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          event_id: string
          expense_id: string
          id: string
          method: string
          note: string | null
          paid_at: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id: string
          expense_id: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id?: string
          expense_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "event_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          scope: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled: boolean
          flag_key: string
          id?: string
          scope: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          scope?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_overrides_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "feature_flag_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          category: string
          created_at: string
          default_enabled: boolean
          description: string | null
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_intentions: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          event_id: string
          guest_message: string | null
          guest_name: string
          guest_phone: string
          id: string
          status: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          event_id: string
          guest_message?: string | null
          guest_name: string
          guest_phone: string
          id?: string
          status?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          event_id?: string
          guest_message?: string | null
          guest_name?: string
          guest_phone?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_intentions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          channel: string
          created_at: string
          id: string
          lead_id: string
          payload: Json
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      help_tickets: {
        Row: {
          attachment_url: string | null
          created_at: string
          description: string
          id: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          description: string
          id?: string
          status?: string
          subject: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_webhook_tokens: {
        Row: {
          created_at: string
          expires_at: string
          purpose: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          purpose: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          purpose?: string
          token?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          desired_plan: string | null
          email: string | null
          id: string
          name: string | null
          origin: string | null
          payload: Json
          phone: string | null
          source: string | null
          status: string
        }
        Insert: {
          created_at?: string
          desired_plan?: string | null
          email?: string | null
          id?: string
          name?: string | null
          origin?: string | null
          payload?: Json
          phone?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          desired_plan?: string | null
          email?: string | null
          id?: string
          name?: string | null
          origin?: string | null
          payload?: Json
          phone?: string | null
          source?: string | null
          status?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          pdf_url: string | null
          summary_markdown: string | null
          transcript_raw: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          pdf_url?: string | null
          summary_markdown?: string | null
          transcript_raw?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          pdf_url?: string | null
          summary_markdown?: string | null
          transcript_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "event_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_tenant_backfill_audit: {
        Row: {
          created_at: string
          details: Json
          id: number
          legacy_user_id: string | null
          migration_name: string
          resolved_tenant_id: string | null
          row_id: string | null
          status: string
          table_name: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: number
          legacy_user_id?: string | null
          migration_name: string
          resolved_tenant_id?: string | null
          row_id?: string | null
          status: string
          table_name: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: number
          legacy_user_id?: string | null
          migration_name?: string
          resolved_tenant_id?: string | null
          row_id?: string | null
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      migration_tenant_backfill_issues: {
        Row: {
          created_at: string
          details: Json
          id: number
          issue_code: string
          legacy_user_id: string | null
          migration_name: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: number
          issue_code: string
          legacy_user_id?: string | null
          migration_name: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: number
          issue_code?: string
          legacy_user_id?: string | null
          migration_name?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      plan_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          tenant_id: string
          thread_id: string
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          thread_id: string
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          thread_id?: string
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ai_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "plan_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ai_threads: {
        Row: {
          channel: string
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ai_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ai_turns: {
        Row: {
          ai_used: boolean
          created_at: string
          current_path: string | null
          error_code: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          prompt_text: string
          provider: string
          request_metadata: Json
          response_metadata: Json
          response_text: string | null
          source: string
          system_prompt_version_id: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          ai_used?: boolean
          created_at?: string
          current_path?: string | null
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt_text: string
          provider?: string
          request_metadata?: Json
          response_metadata?: Json
          response_text?: string | null
          source: string
          system_prompt_version_id?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          ai_used?: boolean
          created_at?: string
          current_path?: string | null
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt_text?: string
          provider?: string
          request_metadata?: Json
          response_metadata?: Json
          response_text?: string | null
          source?: string
          system_prompt_version_id?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ai_turns_system_prompt_version_id_fkey"
            columns: ["system_prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_system_prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_ai_turns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ia_knowledge: {
        Row: {
          chunk_hash: string
          chunk_text: string
          created_at: string
          embedding: string
          id: string
          is_active: boolean
          knowledge_scope: string
          metadata: Json
          source: string | null
          source_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chunk_hash: string
          chunk_text: string
          created_at?: string
          embedding: string
          id?: string
          is_active?: boolean
          knowledge_scope?: string
          metadata?: Json
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chunk_hash?: string
          chunk_text?: string
          created_at?: string
          embedding?: string
          id?: string
          is_active?: boolean
          knowledge_scope?: string
          metadata?: Json
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_ia_support_chunks: {
        Row: {
          chunk_hash: string
          chunk_index: number
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          is_active: boolean
          knowledge_scope: string
          metadata: Json
          module_key: string
          section_title: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          chunk_hash: string
          chunk_index: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          is_active?: boolean
          knowledge_scope: string
          metadata?: Json
          module_key?: string
          section_title?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          chunk_hash?: string
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          is_active?: boolean
          knowledge_scope?: string
          metadata?: Json
          module_key?: string
          section_title?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ia_support_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "plan_ia_support_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_ia_support_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ia_support_documents: {
        Row: {
          created_at: string
          doc_type: string
          feature_keys: string[]
          id: string
          is_active: boolean
          knowledge_scope: string
          metadata: Json
          module_key: string
          plan_scope: string[]
          route_patterns: string[]
          slug: string
          source_path: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          feature_keys?: string[]
          id?: string
          is_active?: boolean
          knowledge_scope: string
          metadata?: Json
          module_key?: string
          plan_scope?: string[]
          route_patterns?: string[]
          slug: string
          source_path?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          feature_keys?: string[]
          id?: string
          is_active?: boolean
          knowledge_scope?: string
          metadata?: Json
          module_key?: string
          plan_scope?: string[]
          route_patterns?: string[]
          slug?: string
          source_path?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ia_support_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_help_docs: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          module: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          module: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          module?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_tenants: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          branding: Json
          created_at: string
          created_by: string | null
          id: string
          logo_file_id: string | null
          metadata: Json
          name: string
          primary_user_id: string | null
          slug: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          logo_file_id?: string | null
          metadata?: Json
          name: string
          primary_user_id?: string | null
          slug: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          logo_file_id?: string | null
          metadata?: Json
          name?: string
          primary_user_id?: string | null
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_tenants_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_asaas_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          first_received_at: string
          last_received_at: string
          processed_at: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          first_received_at?: string
          last_received_at?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          first_received_at?: string
          last_received_at?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          first_received_at: string
          last_received_at: string
          processed_at: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          first_received_at?: string
          last_received_at?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          first_received_at?: string
          last_received_at?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          city: string | null
          consent_accepted_at: string | null
          created_at: string
          events_per_month: number | null
          full_name: string | null
          phone: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          website_or_instagram: string | null
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          events_per_month?: number | null
          full_name?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          website_or_instagram?: string | null
        }
        Update: {
          business_name?: string | null
          city?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          events_per_month?: number | null
          full_name?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          website_or_instagram?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      public_endpoint_rate_limit_buckets: {
        Row: {
          bucket_start: string
          created_at: string
          endpoint: string
          hits: number
          scope: string
        }
        Insert: {
          bucket_start: string
          created_at?: string
          endpoint: string
          hits?: number
          scope: string
        }
        Update: {
          bucket_start?: string
          created_at?: string
          endpoint?: string
          hits?: number
          scope?: string
        }
        Relationships: []
      }
      public_endpoint_rate_limits: {
        Row: {
          hits: number
          identifier_hash: string
          scope: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          hits?: number
          identifier_hash: string
          scope: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          hits?: number
          identifier_hash?: string
          scope?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      stored_files: {
        Row: {
          bucket: string
          byte_size: number
          content_type: string | null
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          last_accessed_at: string | null
          metadata: Json
          object_key: string
          original_name: string
          owner_user_id: string
          provider: string
          status: string
          uploaded_at: string | null
          visibility: string
        }
        Insert: {
          bucket: string
          byte_size?: number
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          last_accessed_at?: string | null
          metadata?: Json
          object_key: string
          original_name: string
          owner_user_id: string
          provider?: string
          status?: string
          uploaded_at?: string | null
          visibility?: string
        }
        Update: {
          bucket?: string
          byte_size?: number
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_accessed_at?: string | null
          metadata?: Json
          object_key?: string
          original_name?: string
          owner_user_id?: string
          provider?: string
          status?: string
          uploaded_at?: string | null
          visibility?: string
        }
        Relationships: []
      }
      subscription_leads: {
        Row: {
          created_at: string
          desired_plan: string
          events_volume: string
          id: string
          name: string
          phone: string
          professional_type: string
          source: string
          start_timing: string
        }
        Insert: {
          created_at?: string
          desired_plan: string
          events_volume: string
          id?: string
          name: string
          phone: string
          professional_type: string
          source?: string
          start_timing: string
        }
        Update: {
          created_at?: string
          desired_plan?: string
          events_volume?: string
          id?: string
          name?: string
          phone?: string
          professional_type?: string
          source?: string
          start_timing?: string
        }
        Relationships: []
      }
      super_admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_banners: {
        Row: {
          body: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          scope: string
          starts_at: string
          tenant_id: string | null
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          body: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          scope?: string
          starts_at?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          variant?: string
        }
        Update: {
          body?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          scope?: string
          starts_at?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          metadata: Json
          page: string
          path: string | null
          referrer: string | null
          session_id: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: number
          metadata?: Json
          page: string
          path?: string | null
          referrer?: string | null
          session_id: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: number
          metadata?: Json
          page?: string
          path?: string | null
          referrer?: string | null
          session_id?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_rate_limit_buckets: {
        Row: {
          bucket_start: string
          created_at: string
          hits: number
          rate_key: string
        }
        Insert: {
          bucket_start: string
          created_at?: string
          hits?: number
          rate_key: string
        }
        Update: {
          bucket_start?: string
          created_at?: string
          hits?: number
          rate_key?: string
        }
        Relationships: []
      }
      telemetry_session_page_views: {
        Row: {
          created_at: string
          duration_ms: number | null
          entered_at: string
          exited_at: string | null
          id: number
          metadata: Json
          path: string
          referrer: string | null
          route_pattern: string | null
          session_id: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          entered_at: string
          exited_at?: string | null
          id?: number
          metadata?: Json
          path: string
          referrer?: string | null
          route_pattern?: string | null
          session_id: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: number
          metadata?: Json
          path?: string
          referrer?: string | null
          route_pattern?: string | null
          session_id?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_session_page_views_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          role: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          role: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          role?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_finance_balance: {
        Row: {
          base_balance: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_balance?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_balance?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_finance_balance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_finance_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id: string
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_finance_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_finance_entries: {
        Row: {
          amount: number
          client_name: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          proof_file_id: string | null
          proof_url: string | null
          received_at: string | null
          source_event_id: string | null
          source_expense_id: string | null
          source_payment_id: string | null
          source_vendor_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          received_at?: string | null
          source_event_id?: string | null
          source_expense_id?: string | null
          source_payment_id?: string | null
          source_vendor_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          received_at?: string | null
          source_event_id?: string | null
          source_expense_id?: string | null
          source_payment_id?: string | null
          source_vendor_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_finance_entries_proof_file_id_fkey"
            columns: ["proof_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_entries_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_entries_source_expense_id_fkey"
            columns: ["source_expense_id"]
            isOneToOne: false
            referencedRelation: "event_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_entries_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "expense_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_entries_source_vendor_id_fkey"
            columns: ["source_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_finance_expenses: {
        Row: {
          amount: number
          category_id: string | null
          category_label: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          proof_file_id: string | null
          proof_url: string | null
          reason: string | null
          status: string
          team_member_name: string | null
          team_member_role: string | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          category_label?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          reason?: string | null
          status?: string
          team_member_name?: string | null
          team_member_role?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          category_label?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          reason?: string | null
          status?: string
          team_member_name?: string | null
          team_member_role?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_finance_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_expenses_proof_file_id_fkey"
            columns: ["proof_file_id"]
            isOneToOne: false
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_finance_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_finance_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_finance_onboarding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_state: {
        Row: {
          auth_provider: string
          avatar_file_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_verified_soft_at: string | null
          setup_completed_at: string | null
          setup_started_at: string | null
          tenant_id: string | null
          trial_ends_at: string | null
          trial_start_at: string | null
          updated_at: string
          user_id: string
          verification_email_last_sent_at: string | null
        }
        Insert: {
          auth_provider?: string
          avatar_file_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_soft_at?: string | null
          setup_completed_at?: string | null
          setup_started_at?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id: string
          verification_email_last_sent_at?: string | null
        }
        Update: {
          auth_provider?: string
          avatar_file_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_soft_at?: string | null
          setup_completed_at?: string | null
          setup_started_at?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id?: string
          verification_email_last_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plan_assistant_hint_state: {
        Row: {
          hint_id: string
          last_action: string
          last_action_at: string
          last_dismissed_at: string | null
          last_opened_at: string | null
          last_shown_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          hint_id: string
          last_action?: string
          last_action_at?: string
          last_dismissed_at?: string | null
          last_opened_at?: string | null
          last_shown_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          hint_id?: string
          last_action?: string
          last_action_at?: string
          last_dismissed_at?: string | null
          last_opened_at?: string | null
          last_shown_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_session_controls: {
        Row: {
          blocked_reason: string | null
          force_logout_after: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          blocked_reason?: string | null
          force_logout_after?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          blocked_reason?: string | null
          force_logout_after?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_ui_preferences: {
        Row: {
          created_at: string
          dashboard_sidebar_start_collapsed: boolean
          default_event_tab: string
          event_sidebar_order: string[]
          event_sidebar_start_collapsed: boolean
          show_trial_banner: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_sidebar_start_collapsed?: boolean
          default_event_tab?: string
          event_sidebar_order?: string[]
          event_sidebar_start_collapsed?: boolean
          show_trial_banner?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_sidebar_start_collapsed?: boolean
          default_event_tab?: string
          event_sidebar_order?: string[]
          event_sidebar_start_collapsed?: boolean
          show_trial_banner?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          assessor_id: string
          category: string
          city: string | null
          cover_image_file_id: string | null
          cover_image_url: string | null
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_visible_in_vitrine: boolean
          name: string
          phone: string | null
          presentation_file_id: string | null
          presentation_url: string | null
          price_range: string | null
          state: string | null
          whatsapp: string | null
        }
        Insert: {
          assessor_id: string
          category: string
          city?: string | null
          cover_image_file_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_visible_in_vitrine?: boolean
          name: string
          phone?: string | null
          presentation_file_id?: string | null
          presentation_url?: string | null
          price_range?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Update: {
          assessor_id?: string
          category?: string
          city?: string | null
          cover_image_file_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_visible_in_vitrine?: boolean
          name?: string
          phone?: string | null
          presentation_file_id?: string | null
          presentation_url?: string | null
          price_range?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      webhook_delivery_failures: {
        Row: {
          error_message: string | null
          event_type: string
          external_reference: string | null
          first_failed_at: string
          id: string
          last_failed_at: string
          payload: Json
          provider: string
          resolved_at: string | null
          response_status: number | null
          retry_count: number
          status: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          external_reference?: string | null
          first_failed_at?: string
          id?: string
          last_failed_at?: string
          payload?: Json
          provider: string
          resolved_at?: string | null
          response_status?: number | null
          retry_count?: number
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          external_reference?: string | null
          first_failed_at?: string
          id?: string
          last_failed_at?: string
          payload?: Json
          provider?: string
          resolved_at?: string | null
          response_status?: number | null
          retry_count?: number
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_failures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      whatsapp_rsvp_messages: {
        Row: {
          created_at: string
          direction: string
          event_id: string
          evolution_message_id: string | null
          family_group_id: string | null
          id: string
          interactive_kind: string | null
          interactive_payload: Json
          interactive_reply_id: string | null
          leader_guest_id: string | null
          message_type: string
          payload: Json
          processed_status: string
          text_body: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: string
          event_id: string
          evolution_message_id?: string | null
          family_group_id?: string | null
          id?: string
          interactive_kind?: string | null
          interactive_payload?: Json
          interactive_reply_id?: string | null
          leader_guest_id?: string | null
          message_type?: string
          payload?: Json
          processed_status?: string
          text_body?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          event_id?: string
          evolution_message_id?: string | null
          family_group_id?: string | null
          id?: string
          interactive_kind?: string | null
          interactive_payload?: Json
          interactive_reply_id?: string | null
          leader_guest_id?: string | null
          message_type?: string
          payload?: Json
          processed_status?: string
          text_body?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_rsvp_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_messages_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "event_guest_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_messages_leader_guest_id_fkey"
            columns: ["leader_guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_rsvp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_rsvp_threads: {
        Row: {
          created_at: string
          event_id: string
          family_group_id: string | null
          flow_state: string
          id: string
          last_confidence: number | null
          last_inbound_at: string | null
          last_interactive_payload: Json
          last_interactive_type: string | null
          last_outbound_at: string | null
          last_resolution_payload: Json
          leader_guest_id: string | null
          manual_review_reason: string | null
          pending_companion_guest_id: string | null
          pending_companion_ids: string[]
          phone_normalized: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          family_group_id?: string | null
          flow_state?: string
          id?: string
          last_confidence?: number | null
          last_inbound_at?: string | null
          last_interactive_payload?: Json
          last_interactive_type?: string | null
          last_outbound_at?: string | null
          last_resolution_payload?: Json
          leader_guest_id?: string | null
          manual_review_reason?: string | null
          pending_companion_guest_id?: string | null
          pending_companion_ids?: string[]
          phone_normalized: string
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          family_group_id?: string | null
          flow_state?: string
          id?: string
          last_confidence?: number | null
          last_inbound_at?: string | null
          last_interactive_payload?: Json
          last_interactive_type?: string | null
          last_outbound_at?: string | null
          last_resolution_payload?: Json
          leader_guest_id?: string | null
          manual_review_reason?: string | null
          pending_companion_guest_id?: string | null
          pending_companion_ids?: string[]
          phone_normalized?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_rsvp_threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_threads_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "event_guest_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_threads_leader_guest_id_fkey"
            columns: ["leader_guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rsvp_threads_pending_companion_guest_id_fkey"
            columns: ["pending_companion_guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_tenant_finance_movements: {
        Row: {
          amount: number | null
          category_color: string | null
          category_id: string | null
          category_label: string | null
          client_name: string | null
          created_at: string | null
          direction: string | null
          event_name: string | null
          expected_on: string | null
          is_derived: boolean | null
          movement_id: string | null
          movement_source: string | null
          notes: string | null
          occurred_on: string | null
          payment_method: string | null
          proof_file_id: string | null
          proof_url: string | null
          source_event_id: string | null
          source_expense_id: string | null
          source_payment_id: string | null
          source_vendor_id: string | null
          status: string | null
          team_member_name: string | null
          team_member_role: string | null
          tenant_id: string | null
          title: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_subscription_period: {
        Args: { current_period_end: string }
        Returns: string
      }
      anonymize_crm_client_data: {
        Args: { p_client_id: string; p_reason?: string }
        Returns: boolean
      }
      backfill_events_tenant_from_owner: {
        Args: { p_dry_run?: boolean }
        Returns: {
          candidate_count: number
          updated_count: number
        }[]
      }
      backfill_stored_file_entity_links: {
        Args: never
        Returns: {
          reference_name: string
          updated_count: number
        }[]
      }
      bootstrap_current_user_account: {
        Args: {
          p_avatar_url?: string
          p_display_name?: string
          p_provider?: string
        }
        Returns: Json
      }
      build_event_guest_groups_snapshot: {
        Args: { p_event_id: string }
        Returns: Json
      }
      build_invitation_gallery_items: {
        Args: { p_event_id: string; p_public_only?: boolean }
        Returns: Json
      }
      build_invitation_song_suggestions: {
        Args: { p_event_id: string; p_public_only?: boolean }
        Returns: Json
      }
      build_public_site_messages: {
        Args: { p_event_id: string }
        Returns: Json
      }
      check_public_endpoint_rate_limit: {
        Args: {
          p_endpoint: string
          p_limit?: number
          p_scope: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      check_telemetry_rate_limit: {
        Args: {
          p_limit?: number
          p_rate_key: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      clear_stored_file_entity_link: {
        Args: { p_entity_id: string; p_file_id: string }
        Returns: undefined
      }
      complete_billing_onboarding: {
        Args: {
          p_accept_consent?: boolean
          p_business_name: string
          p_city: string
          p_events_per_month?: number
          p_full_name: string
          p_phone: string
          p_state: string
          p_website_or_instagram?: string
        }
        Returns: Json
      }
      complete_current_user_setup: {
        Args: { p_business_name: string; p_business_phone?: string }
        Returns: Json
      }
      confirm_client_gift_intention_by_token: {
        Args: { p_event_id: string; p_intention_id: string; p_token: string }
        Returns: {
          amount: number
          confirmed_at: string
          created_at: string
          event_id: string
          guest_message: string
          guest_name: string
          guest_phone: string
          id: string
          status: string
        }[]
      }
      consume_public_rate_limit: {
        Args: {
          p_identifier_hash: string
          p_max_hits: number
          p_scope: string
          p_window_ms: number
        }
        Returns: {
          allowed: boolean
          hits: number
          remaining: number
          retry_after_ms: number
          window_started_at: string
        }[]
      }
      create_client_update_by_token: {
        Args: {
          p_author_name?: string
          p_message: string
          p_photo_file_id?: string
          p_photo_url?: string
          p_title: string
          p_token: string
        }
        Returns: string
      }
      create_gift_intention_by_slug: {
        Args: {
          p_amount: number
          p_guest_message?: string
          p_guest_name: string
          p_guest_phone: string
          p_slug: string
        }
        Returns: {
          amount: number
          event_id: string
          gift_pix_description: string
          gift_pix_key: string
          gift_pix_qr_image_url: string
          intention_id: string
          status: string
        }[]
      }
      create_public_site_message_by_slug: {
        Args: {
          p_author_name?: string
          p_message: string
          p_slug: string
          p_title?: string
        }
        Returns: {
          author_name: string
          created_at: string
          id: string
          message: string
        }[]
      }
      create_template_version: {
        Args: {
          p_content: string
          p_description: string
          p_name: string
          p_tenant_id: string
          p_type: string
          p_user_id: string
        }
        Returns: {
          id: string
          version: number
        }[]
      }
      current_user_access_role: {
        Args: { p_user_id?: string }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      default_site_body_font_for_theme: {
        Args: { p_theme: string }
        Returns: string
      }
      default_site_primary_color_for_theme: {
        Args: { p_theme: string }
        Returns: string
      }
      default_site_secondary_color_for_theme: {
        Args: { p_theme: string }
        Returns: string
      }
      default_site_theme_for_event_type: {
        Args: { p_event_type: string }
        Returns: string
      }
      default_site_title_font_for_theme: {
        Args: { p_theme: string }
        Returns: string
      }
      delete_client_guest_group_by_token: {
        Args: {
          p_group_id?: string
          p_leader_guest_id?: string
          p_token: string
        }
        Returns: Json
      }
      delete_event_cascade: { Args: { p_event_id: string }; Returns: boolean }
      delete_vendor: { Args: { p_vendor_id: string }; Returns: boolean }
      enqueue_webhook_retry: {
        Args: {
          p_client_id?: string
          p_error?: string
          p_event_type: string
          p_headers?: Json
          p_payload: Json
          p_provider: string
          p_tenant_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      ensure_crm_playbook_defaults: { Args: never; Returns: number }
      event_access_resolution: {
        Args: { p_event_id: string; p_user_id?: string }
        Returns: string
      }
      event_tenant_fallback_risks: {
        Args: never
        Returns: {
          details: Json
          event_id: string
          event_name: string
          event_tenant_id: string
          issue_code: string
          legacy_user_id: string
          owner_primary_tenant_id: string
        }[]
      }
      export_crm_client_data: { Args: { p_client_id: string }; Returns: Json }
      generate_crm_followups: { Args: never; Returns: number }
      generate_crm_stage_playbook_tasks: { Args: never; Returns: number }
      get_active_template: {
        Args: { p_tenant_id: string; p_type: string }
        Returns: {
          content: string
          created_at: string
          description: string
          id: string
          name: string
          type: string
          version: number
        }[]
      }
      get_admin_help_tickets: {
        Args: never
        Returns: {
          advisor_email: string
          advisor_name: string
          attachment_url: string
          created_at: string
          description: string
          id: string
          status: string
          subject: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          updated_at: string
          user_id: string
        }[]
      }
      get_admin_overview_snapshot: {
        Args: {
          p_activity_limit?: number
          p_activity_window_days?: number
          p_include_admin_activity?: boolean
          p_user_limit?: number
        }
        Returns: Json
      }
      get_admin_user_detail: {
        Args: { p_include_admin_activity?: boolean; p_user_id: string }
        Returns: Json
      }
      get_admin_users_page: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_query?: string
          p_role_filter?: string
          p_status_filter?: string
        }
        Returns: Json
      }
      get_ai_usage_dashboard: {
        Args: {
          p_from: string
          p_tenant_id?: string
          p_to: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_billing_access_context: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      get_client_data_room: {
        Args: { p_client_id: string }
        Returns: {
          created_at: string
          documents: Json
          external_dataroom_id: string
          external_link_id: string
          external_url: string
          id: string
          status: string
        }[]
      }
      get_client_event_invitation_experience_by_token: {
        Args: { p_event_id: string; p_token: string }
        Returns: {
          event_id: string
          gallery_items: Json
          invitation_experience: Json
          song_suggestions: Json
        }[]
      }
      get_client_event_website_settings_by_token: {
        Args: { p_event_id: string; p_token: string }
        Returns: {
          address: string
          color_primary: string
          color_secondary: string
          end_time: string
          event_date: string
          event_id: string
          event_location: string
          event_name: string
          event_type: string
          features_option: string
          font_body: string
          font_title: string
          gift_pix_description: string
          gift_pix_key: string
          gift_pix_qr_file_id: string
          gift_pix_qr_image_url: string
          hero_image_url: string
          hero_position: string
          invite_hosting_mode: string
          is_published: boolean
          maps_url: string
          overlay_intensity: number
          recent_messages: Json
          sections_visible: Json
          start_time: string
          story_image_url: string
          story_text: string
          subdomain_slug: string
          theme: string
        }[]
      }
      get_client_gift_intentions_by_token: {
        Args: { p_event_id: string; p_token: string }
        Returns: {
          amount: number
          confirmed_at: string
          created_at: string
          event_id: string
          guest_message: string
          guest_name: string
          guest_phone: string
          id: string
          status: string
        }[]
      }
      get_client_integration_events: {
        Args: { p_client_id: string }
        Returns: {
          created_at: string
          error_message: string
          event_type: string
          id: string
          metadata: Json
          provider: string
          status: string
        }[]
      }
      get_client_portal_snapshot_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_client_updates_by_token: {
        Args: { p_token: string }
        Returns: {
          author_name: string
          author_role: string
          created_at: string
          event_id: string
          id: string
          kind: string
          message: string
          photo_file_id: string
          photo_url: string
          title: string
        }[]
      }
      get_crm_execution_metrics: {
        Args: never
        Returns: {
          metric: string
          value: number
        }[]
      }
      get_crm_funnel_metrics: {
        Args: never
        Returns: {
          avg_days_in_stage: number
          conversion_rate: number
          leads: number
          stage: string
        }[]
      }
      get_crm_operational_metrics: {
        Args: never
        Returns: {
          metric: string
          priority: string
          value: number
        }[]
      }
      get_crm_pipeline_forecast: {
        Args: never
        Returns: {
          leads: number
          stage: string
          total_budget: number
          weighted_budget: number
          win_rate: number
        }[]
      }
      get_crm_priority_queue: {
        Args: { p_limit?: number }
        Returns: {
          client_id: string
          client_name: string
          due_date: string
          next_action: string
          priority_reason: string
          priority_score: number
          stage: string
        }[]
      }
      get_crm_priority_weights: {
        Args: never
        Returns: {
          default_value: number
          label: string
          weight_key: string
          weight_value: number
        }[]
      }
      get_current_access_context: { Args: never; Returns: Json }
      get_current_runtime_context: { Args: never; Returns: Json }
      get_effective_feature_flags: {
        Args: { p_tenant_id?: string; p_user_id: string }
        Returns: {
          enabled: boolean
          flag_key: string
          source_scope: string
          updated_at: string
        }[]
      }
      get_effective_plan_id: { Args: { p_user_id?: string }; Returns: string }
      get_event_gift_intentions_for_owner: {
        Args: { p_event_id: string }
        Returns: {
          amount: number
          confirmed_at: string
          created_at: string
          event_id: string
          guest_message: string
          guest_name: string
          guest_phone: string
          id: string
          status: string
        }[]
      }
      get_event_guest_groups: { Args: { p_event_id: string }; Returns: Json }
      get_event_overview_metrics: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_event_vendor_selections: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          event_id: string
          id: string
          notes: string
          status: string
          vendor_category: string
          vendor_cover_image_file_id: string
          vendor_cover_image_url: string
          vendor_display_order: number
          vendor_email: string
          vendor_id: string
          vendor_is_visible_in_vitrine: boolean
          vendor_name: string
          vendor_phone: string
          vendor_presentation_file_id: string
          vendor_presentation_url: string
          vendor_whatsapp: string
        }[]
      }
      get_global_marketplace_vendors: {
        Args: {
          p_category?: string
          p_city?: string
          p_price_range?: string
          p_search?: string
        }
        Returns: Json
      }
      get_guest_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          companion_names: Json
          companions: Json
          couple: string
          dietary_restrictions: string
          event_date: string
          event_id: string
          event_name: string
          family_group_id: string
          guest_id: string
          guest_name: string
          invite_dress_code: string
          invite_message_template: string
          is_group_leader: boolean
          location: string
          plus_one_count: number
          rsvp_note: string
          rsvp_status: string
          table_name: string
        }[]
      }
      get_operational_health_dashboard: {
        Args: { p_window_days?: number }
        Returns: Json
      }
      get_portfolio_share_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          pdf_file_id: string
          pdf_url: string
          sender_email: string
          sender_instagram: string
          sender_name: string
          sender_whatsapp: string
          title: string
        }[]
      }
      get_public_event_invitation_experience_by_slug: {
        Args: { p_slug: string }
        Returns: {
          event_id: string
          gallery_items: Json
          invitation_experience: Json
          song_suggestions: Json
        }[]
      }
      get_public_event_site_by_slug: {
        Args: { p_slug: string }
        Returns: {
          address: string
          color_primary: string
          color_secondary: string
          end_time: string
          event_date: string
          event_id: string
          event_location: string
          event_name: string
          event_type: string
          font_body: string
          font_title: string
          gift_pix_description: string
          gift_pix_qr_image_url: string
          hero_image_url: string
          hero_position: string
          is_published: boolean
          maps_url: string
          overlay_intensity: number
          recent_messages: Json
          sections_visible: Json
          start_time: string
          story_image_url: string
          story_text: string
          subdomain_slug: string
          theme: string
        }[]
      }
      get_public_vendor_showcase_by_slug: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_request_ip: { Args: never; Returns: string }
      get_signature_request_by_token: {
        Args: { p_token: string }
        Returns: {
          client_email: string
          client_name: string
          document_content: string
          document_title: string
          expires_at: string
          request_id: string
          status: string
        }[]
      }
      get_site_by_slug: {
        Args: { p_slug: string }
        Returns: {
          address: string
          allow_client_editing: boolean
          color_primary: string
          color_secondary: string
          end_time: string
          event_date: string
          event_id: string
          event_location: string
          event_name: string
          event_type: string
          features_option: string
          font_body: string
          font_title: string
          gift_pix_description: string
          gift_pix_key: string
          gift_pix_qr_file_id: string
          gift_pix_qr_image_url: string
          hero_image_url: string
          hero_position: string
          invitation_experience: Json
          invite_hosting_mode: string
          is_published: boolean
          maps_url: string
          overlay_intensity: number
          recent_messages: Json
          sections_visible: Json
          start_time: string
          story_image_url: string
          story_text: string
          subdomain_slug: string
          theme: string
        }[]
      }
      get_super_admin_hub_snapshot:
        | {
            Args: {
              p_activity_limit?: number
              p_activity_window_days?: number
              p_user_limit?: number
            }
            Returns: Json
          }
        | {
            Args: { p_activity_limit: number; p_user_limit: number }
            Returns: Json
          }
      get_vendor_by_token: {
        Args: { p_token: string }
        Returns: {
          event_date: string
          event_id: string
          event_name: string
          status: string
          vendor_category: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_vendor_by_token_v2: {
        Args: { p_token: string }
        Returns: {
          event_date: string
          event_id: string
          event_name: string
          expected_arrival_time: string
          expected_done_time: string
          latest_note: string
          latest_updated_at: string
          status: string
          vendor_category: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_vendor_status_history_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          note: string
          status: string
          updated_by: string
        }[]
      }
      get_vendors: {
        Args: never
        Returns: {
          assessor_id: string
          category: string
          city: string | null
          cover_image_file_id: string | null
          cover_image_url: string | null
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_visible_in_vitrine: boolean
          name: string
          phone: string | null
          presentation_file_id: string | null
          presentation_url: string | null
          price_range: string | null
          state: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_whatsapp_rsvp_review_queue: {
        Args: { p_event_id: string }
        Returns: Json
      }
      hash_event_client_access_token: {
        Args: { p_token: string }
        Returns: string
      }
      ingest_telemetry_event: {
        Args: {
          p_event_name: string
          p_metadata?: Json
          p_page: string
          p_path?: string
          p_referrer?: string
          p_session_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      is_super_admin: { Args: { p_user_id?: string }; Returns: boolean }
      link_catalog_vendor_to_event: {
        Args: { p_event_id: string; p_vendor_id: string }
        Returns: {
          catalog_vendor_id: string | null
          category: string
          contract_document_id: string | null
          control_token: string | null
          created_at: string
          created_by: string | null
          email: string | null
          event_id: string
          expected_arrival_time: string | null
          expected_done_time: string | null
          id: string
          import_draft_id: string | null
          import_review_reason: string | null
          import_review_status: string
          is_self_vendor: boolean
          name: string
          notes: string | null
          phone: string | null
          status: string | null
          tenant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "event_vendors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_current_user_soft_email_verified: { Args: never; Returns: Json }
      match_plan_ia_knowledge: {
        Args: {
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
          p_scope?: string
        }
        Returns: {
          chunk_text: string
          id: string
          knowledge_scope: string
          metadata: Json
          similarity: number
          source: string
          source_url: string
          title: string
        }[]
      }
      match_plan_ia_support_chunks: {
        Args: {
          p_candidate_pool?: number
          p_feature_keys?: string[]
          p_match_count?: number
          p_match_threshold?: number
          p_module_key?: string
          p_plan_id?: string
          p_query_embedding: string
          p_route_path?: string
          p_scope?: string
          p_tenant_id?: string
        }
        Returns: {
          base_similarity: number
          chunk_id: string
          chunk_text: string
          doc_type: string
          document_id: string
          final_score: number
          knowledge_scope: string
          metadata: Json
          module_key: string
          module_score: number
          route_patterns: string[]
          route_score: number
          tenant_id: string
          title: string
        }[]
      }
      moderate_client_invitation_song_suggestion_by_token: {
        Args: {
          p_event_id: string
          p_status: string
          p_suggestion_id: string
          p_token: string
        }
        Returns: {
          artist: string
          created_at: string
          guest_name: string
          id: string
          link: string
          song_title: string
          status: string
        }[]
      }
      normalize_event_type: { Args: { p_value: string }; Returns: string }
      normalize_invitation_experience: {
        Args: { p_value: Json }
        Returns: Json
      }
      normalize_site_sections_visible: {
        Args: { p_value: Json }
        Returns: Json
      }
      plan_ia_assert_tenant_scope: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      plan_ia_get_event_snapshot: {
        Args: {
          p_event_id?: string
          p_event_name?: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      plan_ia_get_pending_clients: {
        Args: { p_limit?: number; p_tenant_id: string; p_user_id: string }
        Returns: Json
      }
      plan_ia_get_priority_clients: {
        Args: { p_limit?: number; p_tenant_id: string; p_user_id: string }
        Returns: Json
      }
      plan_ia_get_revenue_forecast: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: Json
      }
      purge_crm_lost_clients: { Args: { p_days?: number }; Returns: number }
      remove_event_vendor_selection: {
        Args: { p_event_id: string; p_vendor_id: string }
        Returns: boolean
      }
      reorder_vendors: { Args: { p_ordered_ids: string[] }; Returns: number }
      requesting_tenant_id: { Args: never; Returns: string }
      resolve_event_client_access: {
        Args: { p_token: string }
        Returns: {
          access_id: string
          client_name: string
          client_phone: string
          event_id: string
          expires_at: string
        }[]
      }
      resolve_primary_tenant_id: {
        Args: { p_user_id?: string }
        Returns: string
      }
      rotate_guest_invite_token: {
        Args: { p_guest_id: string }
        Returns: string
      }
      rotate_portfolio_share_token: {
        Args: { p_share_id: string }
        Returns: string
      }
      rotate_signature_request_token: {
        Args: { p_request_id: string }
        Returns: string
      }
      rotate_vendor_control_token: {
        Args: { p_vendor_id: string }
        Returns: string
      }
      run_security_audit_checks: { Args: never; Returns: Json }
      sign_signature_request_by_token: {
        Args: {
          p_signer_email?: string
          p_signer_name: string
          p_token: string
        }
        Returns: boolean
      }
      slugify_text: { Args: { p_input: string }; Returns: string }
      submit_guest_rsvp_by_token: {
        Args: {
          p_companion_names?: Json
          p_dietary_restrictions?: string
          p_plus_one_count?: number
          p_rsvp_note?: string
          p_status: string
          p_token: string
        }
        Returns: undefined
      }
      submit_public_invitation_song_suggestion: {
        Args: {
          p_artist?: string
          p_guest_name: string
          p_link?: string
          p_slug: string
          p_song_title: string
        }
        Returns: {
          artist: string
          created_at: string
          guest_name: string
          id: string
          link: string
          song_title: string
          status: string
        }[]
      }
      submit_vendor_by_invite: {
        Args: {
          p_cover_file_id?: string
          p_presentation_file_id?: string
          p_slug: string
          p_vendor: Json
        }
        Returns: Json
      }
      sync_event_guest_group_rollup: {
        Args: { p_family_group_id: string }
        Returns: undefined
      }
      sync_stored_file_entity_link: {
        Args: { p_entity_id: string; p_file_id: string }
        Returns: undefined
      }
      update_vendor_status_by_token:
        | { Args: { p_status: string; p_token: string }; Returns: undefined }
        | {
            Args: { p_note: string; p_status: string; p_token: string }
            Returns: undefined
          }
      upsert_client_event_invitation_experience_by_token: {
        Args: {
          p_event_id: string
          p_gallery_items?: Json
          p_invitation_experience: Json
          p_token: string
        }
        Returns: {
          event_id: string
          gallery_items: Json
          invitation_experience: Json
          song_suggestions: Json
        }[]
      }
      upsert_client_event_website_settings_by_token:
        | {
            Args: {
              p_address?: string
              p_color_secondary?: string
              p_end_time?: string
              p_event_id: string
              p_font_body?: string
              p_font_title?: string
              p_gift_pix_description?: string
              p_gift_pix_qr_file_id?: string
              p_gift_pix_qr_image_url?: string
              p_hero_image_url?: string
              p_hero_position?: string
              p_is_published?: boolean
              p_maps_url?: string
              p_overlay_intensity?: number
              p_sections_visible?: Json
              p_site_name?: string
              p_start_time?: string
              p_story_image_url?: string
              p_story_text?: string
              p_subdomain_slug?: string
              p_theme?: string
              p_theme_color?: string
              p_token: string
            }
            Returns: {
              address: string
              color_primary: string
              color_secondary: string
              end_time: string
              event_date: string
              event_id: string
              event_location: string
              event_name: string
              event_type: string
              font_body: string
              font_title: string
              gift_pix_description: string
              gift_pix_qr_file_id: string
              gift_pix_qr_image_url: string
              hero_image_url: string
              hero_position: string
              is_published: boolean
              maps_url: string
              overlay_intensity: number
              recent_messages: Json
              sections_visible: Json
              start_time: string
              story_image_url: string
              story_text: string
              subdomain_slug: string
              theme: string
            }[]
          }
        | {
            Args: {
              p_address?: string
              p_color_secondary?: string
              p_end_time?: string
              p_event_id: string
              p_features_option?: string
              p_font_body?: string
              p_font_title?: string
              p_gift_pix_description?: string
              p_gift_pix_key?: string
              p_gift_pix_qr_file_id?: string
              p_gift_pix_qr_image_url?: string
              p_hero_image_url?: string
              p_hero_position?: string
              p_invite_hosting_mode?: string
              p_is_published?: boolean
              p_maps_url?: string
              p_overlay_intensity?: number
              p_sections_visible?: Json
              p_site_name?: string
              p_start_time?: string
              p_story_image_url?: string
              p_story_text?: string
              p_subdomain_slug?: string
              p_theme?: string
              p_theme_color?: string
              p_token: string
            }
            Returns: {
              address: string
              color_primary: string
              color_secondary: string
              end_time: string
              event_date: string
              event_id: string
              event_location: string
              event_name: string
              event_type: string
              features_option: string
              font_body: string
              font_title: string
              gift_pix_description: string
              gift_pix_key: string
              gift_pix_qr_file_id: string
              gift_pix_qr_image_url: string
              hero_image_url: string
              hero_position: string
              invite_hosting_mode: string
              is_published: boolean
              maps_url: string
              overlay_intensity: number
              recent_messages: Json
              sections_visible: Json
              start_time: string
              story_image_url: string
              story_text: string
              subdomain_slug: string
              theme: string
            }[]
          }
        | {
            Args: {
              p_event_id: string
              p_font_family?: string
              p_hero_image_url?: string
              p_is_published?: boolean
              p_subdomain_slug?: string
              p_theme_color?: string
              p_token: string
            }
            Returns: {
              event_id: string
              font_family: string
              hero_image_url: string
              is_published: boolean
              subdomain_slug: string
              theme_color: string
            }[]
          }
      upsert_client_event_website_settings_v2_by_token: {
        Args: {
          p_address?: string
          p_color_secondary?: string
          p_end_time?: string
          p_event_id: string
          p_features_option?: string
          p_font_body?: string
          p_font_title?: string
          p_gift_pix_description?: string
          p_gift_pix_key?: string
          p_gift_pix_qr_file_id?: string
          p_gift_pix_qr_image_url?: string
          p_hero_image_url?: string
          p_hero_position?: string
          p_invite_hosting_mode?: string
          p_is_published?: boolean
          p_maps_url?: string
          p_overlay_intensity?: number
          p_sections_visible?: Json
          p_site_name?: string
          p_start_time?: string
          p_story_image_url?: string
          p_story_text?: string
          p_subdomain_slug?: string
          p_theme?: string
          p_theme_color?: string
          p_token: string
        }
        Returns: {
          address: string
          color_primary: string
          color_secondary: string
          end_time: string
          event_date: string
          event_id: string
          event_location: string
          event_name: string
          event_type: string
          features_option: string
          font_body: string
          font_title: string
          gift_pix_description: string
          gift_pix_key: string
          gift_pix_qr_file_id: string
          gift_pix_qr_image_url: string
          hero_image_url: string
          hero_position: string
          invite_hosting_mode: string
          is_published: boolean
          maps_url: string
          overlay_intensity: number
          recent_messages: Json
          sections_visible: Json
          start_time: string
          story_image_url: string
          story_text: string
          subdomain_slug: string
          theme: string
        }[]
      }
      upsert_client_guest_group_by_token: {
        Args: {
          p_group_id?: string
          p_group_label?: string
          p_leader?: Json
          p_members?: Json
          p_token: string
        }
        Returns: Json
      }
      upsert_event_vendor_selection: {
        Args: {
          p_event_id: string
          p_notes?: string
          p_status?: string
          p_vendor_id: string
        }
        Returns: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          status: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_vendor_selections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_vendor: {
        Args: { p_vendor: Json }
        Returns: {
          assessor_id: string
          category: string
          city: string | null
          cover_image_file_id: string | null
          cover_image_url: string | null
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_visible_in_vitrine: boolean
          name: string
          phone: string | null
          presentation_file_id: string | null
          presentation_url: string | null
          price_range: string | null
          state: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_can_access_crm_client: {
        Args: { p_client_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_can_access_event: {
        Args: { p_event_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_can_access_tenant: {
        Args: { p_tenant_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_can_access_vendor_catalog: {
        Args: { p_user_id?: string; p_vendor_id: string }
        Returns: boolean
      }
      user_has_dashboard_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      user_has_tenant_membership: {
        Args: { p_tenant_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_owns_event: { Args: { p_event_id: string }; Returns: boolean }
    }
    Enums: {
      client_document_status: "draft" | "ready" | "approved" | "archived"
      document_context_type: "event" | "crm_client" | "global"
      document_extraction_review_status:
        | "pending_review"
        | "approved"
        | "discarded"
        | "applied"
      document_processing_kind:
        | "contract_extraction"
        | "contract_analysis"
        | "document_generation"
      document_processing_status:
        | "uploading"
        | "queued"
        | "processing"
        | "needs_review"
        | "done"
        | "failed"
        | "cancelled"
      document_template_kind: "quote" | "contract"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      client_document_status: ["draft", "ready", "approved", "archived"],
      document_context_type: ["event", "crm_client", "global"],
      document_extraction_review_status: [
        "pending_review",
        "approved",
        "discarded",
        "applied",
      ],
      document_processing_kind: [
        "contract_extraction",
        "contract_analysis",
        "document_generation",
      ],
      document_processing_status: [
        "uploading",
        "queued",
        "processing",
        "needs_review",
        "done",
        "failed",
        "cancelled",
      ],
      document_template_kind: ["quote", "contract"],
    },
  },
} as const
