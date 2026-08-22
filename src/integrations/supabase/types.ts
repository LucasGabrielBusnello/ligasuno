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
      academic_terms: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
          term_end_date: string | null
          term_start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
          term_end_date?: string | null
          term_start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
          term_end_date?: string | null
          term_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          details: Json
          id: string
          path: string | null
          target: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          details?: Json
          id?: string
          path?: string | null
          target?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          details?: Json
          id?: string
          path?: string | null
          target?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      ad_analytics: {
        Row: {
          action: string
          ad_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          ad_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          ad_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_analytics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          description: string | null
          display_order: number
          end_date: string | null
          id: string
          image_url: string
          placement: string
          redirect_url: string
          start_date: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url: string
          placement?: string
          redirect_url: string
          start_date?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string
          placement?: string
          redirect_url?: string
          start_date?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          annual_fee_credit_monthly: number
          annual_fee_pix_monthly: number
          fee_atletica_event_fixed: number | null
          fee_atletica_event_pct: number | null
          fee_atletica_membership_fixed: number | null
          fee_atletica_membership_pct: number | null
          fee_atletica_product_fixed: number | null
          fee_atletica_product_pct: number | null
          fee_event_fixed: number
          fee_event_pct: number
          fee_minicourse_fixed: number
          fee_minicourse_pct: number
          fee_selection_fixed: number
          fee_selection_pct: number
          fee_semester_fixed: number
          fee_semester_pct: number
          id: number
          maintenance_enabled: boolean
          updated_at: string
        }
        Insert: {
          annual_fee_credit_monthly?: number
          annual_fee_pix_monthly?: number
          fee_atletica_event_fixed?: number | null
          fee_atletica_event_pct?: number | null
          fee_atletica_membership_fixed?: number | null
          fee_atletica_membership_pct?: number | null
          fee_atletica_product_fixed?: number | null
          fee_atletica_product_pct?: number | null
          fee_event_fixed?: number
          fee_event_pct?: number
          fee_minicourse_fixed?: number
          fee_minicourse_pct?: number
          fee_selection_fixed?: number
          fee_selection_pct?: number
          fee_semester_fixed?: number
          fee_semester_pct?: number
          id?: number
          maintenance_enabled?: boolean
          updated_at?: string
        }
        Update: {
          annual_fee_credit_monthly?: number
          annual_fee_pix_monthly?: number
          fee_atletica_event_fixed?: number | null
          fee_atletica_event_pct?: number | null
          fee_atletica_membership_fixed?: number | null
          fee_atletica_membership_pct?: number | null
          fee_atletica_product_fixed?: number | null
          fee_atletica_product_pct?: number | null
          fee_event_fixed?: number
          fee_event_pct?: number
          fee_minicourse_fixed?: number
          fee_minicourse_pct?: number
          fee_selection_fixed?: number
          fee_selection_pct?: number
          fee_semester_fixed?: number
          fee_semester_pct?: number
          id?: number
          maintenance_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      athletic_asset_loans: {
        Row: {
          asset_id: string
          borrower_email: string | null
          borrower_name: string
          borrower_phone: string | null
          created_at: string
          id: string
          return_date: string | null
          returned_at: string | null
        }
        Insert: {
          asset_id: string
          borrower_email?: string | null
          borrower_name: string
          borrower_phone?: string | null
          created_at?: string
          id?: string
          return_date?: string | null
          returned_at?: string | null
        }
        Update: {
          asset_id?: string
          borrower_email?: string | null
          borrower_name?: string
          borrower_phone?: string | null
          created_at?: string
          id?: string
          return_date?: string | null
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_asset_loans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "athletic_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_assets: {
        Row: {
          acquisition_date: string | null
          athletic_id: string
          available_quantity: number
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          athletic_id: string
          available_quantity?: number
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          athletic_id?: string
          available_quantity?: number
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_assets_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_band_instruments: {
        Row: {
          athletic_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          athletic_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          athletic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_band_instruments_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_cash_entries: {
        Row: {
          athletic_id: string
          category: Database["public"]["Enums"]["athletic_cash_category"]
          created_at: string
          created_by: string | null
          description: string
          gross_amount: number
          id: string
          is_income: boolean
          mp_fee: number
          net_amount: number
          occurred_at: string
          platform_fee: number
          receipt_url: string | null
          related_membership_payment_id: string | null
          related_order_id: string | null
          related_ticket_id: string | null
          updated_at: string
        }
        Insert: {
          athletic_id: string
          category: Database["public"]["Enums"]["athletic_cash_category"]
          created_at?: string
          created_by?: string | null
          description: string
          gross_amount?: number
          id?: string
          is_income?: boolean
          mp_fee?: number
          net_amount?: number
          occurred_at?: string
          platform_fee?: number
          receipt_url?: string | null
          related_membership_payment_id?: string | null
          related_order_id?: string | null
          related_ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          athletic_id?: string
          category?: Database["public"]["Enums"]["athletic_cash_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          gross_amount?: number
          id?: string
          is_income?: boolean
          mp_fee?: number
          net_amount?: number
          occurred_at?: string
          platform_fee?: number
          receipt_url?: string | null
          related_membership_payment_id?: string | null
          related_order_id?: string | null
          related_ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_cash_entries_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_collections: {
        Row: {
          active: boolean
          athletic_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          athletic_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          athletic_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_collections_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_event_tickets: {
        Row: {
          batch_id: string | null
          buyer_cpf: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_user_id: string | null
          code: string
          created_at: string
          event_id: string
          id: string
          mp_payment_id: string | null
          payment_methods: Json | null
          price_paid: number | null
          sold_at: string | null
          sold_by: string | null
          sold_channel: string | null
          status: Database["public"]["Enums"]["athletic_ticket_status"]
          updated_at: string
          used_at: string | null
        }
        Insert: {
          batch_id?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_user_id?: string | null
          code: string
          created_at?: string
          event_id: string
          id?: string
          mp_payment_id?: string | null
          payment_methods?: Json | null
          price_paid?: number | null
          sold_at?: string | null
          sold_by?: string | null
          sold_channel?: string | null
          status?: Database["public"]["Enums"]["athletic_ticket_status"]
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          batch_id?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_user_id?: string | null
          code?: string
          created_at?: string
          event_id?: string
          id?: string
          mp_payment_id?: string | null
          payment_methods?: Json | null
          price_paid?: number | null
          sold_at?: string | null
          sold_by?: string | null
          sold_channel?: string | null
          status?: Database["public"]["Enums"]["athletic_ticket_status"]
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "athletic_events"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_events: {
        Row: {
          athletic_id: string
          created_at: string
          description: string | null
          end_date: string | null
          ends_at: string | null
          gallery: Json
          id: string
          image_url: string | null
          location: string | null
          online_sales_open: boolean
          price_member: number
          price_visitor: number
          published: boolean
          starts_at: string | null
          theme_color: string | null
          tickets_sold: number
          title: string
          total_tickets: number
          updated_at: string
        }
        Insert: {
          athletic_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          online_sales_open?: boolean
          price_member?: number
          price_visitor?: number
          published?: boolean
          starts_at?: string | null
          theme_color?: string | null
          tickets_sold?: number
          title: string
          total_tickets?: number
          updated_at?: string
        }
        Update: {
          athletic_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          online_sales_open?: boolean
          price_member?: number
          price_visitor?: number
          published?: boolean
          starts_at?: string | null
          theme_color?: string | null
          tickets_sold?: number
          title?: string
          total_tickets?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_events_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_infinitepay_accounts: {
        Row: {
          api_key_encrypted: string | null
          athletic_id: string
          connected_at: string
          handle: string
          id: string
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          athletic_id: string
          connected_at?: string
          handle: string
          id?: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          athletic_id?: string
          connected_at?: string
          handle?: string
          id?: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_infinitepay_accounts_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: true
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_membership_cycles: {
        Row: {
          athletic_id: string
          created_at: string
          ends_at: string
          id: string
          is_current: boolean
          name: string
          open: boolean
          price_new: number
          price_renewal: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          athletic_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_current?: boolean
          name: string
          open?: boolean
          price_new: number
          price_renewal: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          athletic_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_current?: boolean
          name?: string
          open?: boolean
          price_new?: number
          price_renewal?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_membership_cycles_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_membership_payments: {
        Row: {
          amount: number
          athletic_id: string
          buyer_cpf: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          id: string
          matricula: string | null
          member_until: string | null
          membership_id: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          period_days: number
          semestre: string | null
          status: Database["public"]["Enums"]["athletic_order_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          athletic_id: string
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          member_until?: string | null
          membership_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          period_days?: number
          semestre?: string | null
          status?: Database["public"]["Enums"]["athletic_order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          athletic_id?: string
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          member_until?: string | null
          membership_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          period_days?: number
          semestre?: string | null
          status?: Database["public"]["Enums"]["athletic_order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_membership_payments_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletic_membership_payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "athletic_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_memberships: {
        Row: {
          active: boolean
          added_manually: boolean
          athletic_id: string
          cpf: string | null
          created_at: string
          cycle_id: string | null
          director_tabs: string[] | null
          email: string
          full_name: string
          id: string
          invite_sent_at: string | null
          matricula: string | null
          member_until: string | null
          phone: string | null
          role: Database["public"]["Enums"]["athletic_role"]
          semestre: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          added_manually?: boolean
          athletic_id: string
          cpf?: string | null
          created_at?: string
          cycle_id?: string | null
          director_tabs?: string[] | null
          email: string
          full_name: string
          id?: string
          invite_sent_at?: string | null
          matricula?: string | null
          member_until?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["athletic_role"]
          semestre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          added_manually?: boolean
          athletic_id?: string
          cpf?: string | null
          created_at?: string
          cycle_id?: string | null
          director_tabs?: string[] | null
          email?: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          matricula?: string | null
          member_until?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["athletic_role"]
          semestre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_memberships_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletic_memberships_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "athletic_membership_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_mp_accounts: {
        Row: {
          access_token: string
          athletic_id: string
          connected_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          live_mode: boolean
          public_key: string | null
          refresh_token: string | null
          scope: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          athletic_id: string
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          athletic_id?: string
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_mp_accounts_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: true
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_partners: {
        Row: {
          active: boolean
          athletic_id: string
          created_at: string
          description: string | null
          discount_text: string | null
          display_order: number
          id: string
          image_url: string | null
          link_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          athletic_id: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          athletic_id?: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_partners_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_product_order_items: {
        Row: {
          delivered_at: string | null
          delivered_by: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          title: string
          unit_price: number
          variant: Json | null
        }
        Insert: {
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          quantity?: number
          title: string
          unit_price: number
          variant?: Json | null
        }
        Update: {
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          title?: string
          unit_price?: number
          variant?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_product_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "athletic_product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletic_product_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "athletic_products"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_product_orders: {
        Row: {
          athletic_id: string
          buyer_cpf: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          buyer_registration: string | null
          buyer_semester: number | null
          created_at: string
          discount_total: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          notes: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["athletic_order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          athletic_id: string
          buyer_cpf?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          buyer_registration?: string | null
          buyer_semester?: number | null
          created_at?: string
          discount_total?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["athletic_order_status"]
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          athletic_id?: string
          buyer_cpf?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          buyer_registration?: string | null
          buyer_semester?: number | null
          created_at?: string
          discount_total?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["athletic_order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_product_orders_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_products: {
        Row: {
          active: boolean
          athletic_id: string
          badge_text: string | null
          collection_id: string | null
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          images: Json
          is_highlight: boolean
          is_new: boolean
          member_price: number | null
          price: number
          sales_deadline: string | null
          second_item_discount_pct: number
          show_stock_warning: boolean
          stock: number | null
          stock_warning_threshold: number | null
          title: string
          updated_at: string
          variants: Json
        }
        Insert: {
          active?: boolean
          athletic_id: string
          badge_text?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          images?: Json
          is_highlight?: boolean
          is_new?: boolean
          member_price?: number | null
          price?: number
          sales_deadline?: string | null
          second_item_discount_pct?: number
          show_stock_warning?: boolean
          stock?: number | null
          stock_warning_threshold?: number | null
          title: string
          updated_at?: string
          variants?: Json
        }
        Update: {
          active?: boolean
          athletic_id?: string
          badge_text?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          images?: Json
          is_highlight?: boolean
          is_new?: boolean
          member_price?: number | null
          price?: number
          sales_deadline?: string | null
          second_item_discount_pct?: number
          show_stock_warning?: boolean
          stock?: number | null
          stock_warning_threshold?: number | null
          title?: string
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "athletic_products_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletic_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "athletic_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_social_actions: {
        Row: {
          athletic_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          athletic_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          athletic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_social_actions_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_sport_enrollments: {
        Row: {
          created_at: string
          id: string
          sport_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sport_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sport_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletic_sport_enrollments_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "athletic_sports"
            referencedColumns: ["id"]
          },
        ]
      }
      athletic_sports: {
        Row: {
          active: boolean
          athletic_id: string
          coach: string | null
          created_at: string
          description: string | null
          display_order: number
          enrollment_open: boolean
          gender: string
          id: string
          image_url: string | null
          max_capacity: number | null
          name: string
          schedule: string | null
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          active?: boolean
          athletic_id: string
          coach?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          enrollment_open?: boolean
          gender?: string
          id?: string
          image_url?: string | null
          max_capacity?: number | null
          name: string
          schedule?: string | null
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          active?: boolean
          athletic_id?: string
          coach?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          enrollment_open?: boolean
          gender?: string
          id?: string
          image_url?: string | null
          max_capacity?: number | null
          name?: string
          schedule?: string | null
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletic_sports_athletic_id_fkey"
            columns: ["athletic_id"]
            isOneToOne: false
            referencedRelation: "athletics"
            referencedColumns: ["id"]
          },
        ]
      }
      athletics: {
        Row: {
          band_description: string | null
          band_image_url: string | null
          band_whatsapp_url: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          history_description: string | null
          history_images: Json
          history_title: string | null
          history_years: Json
          id: string
          logo_url: string | null
          maintenance_enabled: boolean
          membership_period_days: number
          membership_price: number
          memberships_open: boolean
          name: string
          president_id: string | null
          primary_color: string
          published: boolean
          secondary_color: string
          short_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          band_description?: string | null
          band_image_url?: string | null
          band_whatsapp_url?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          history_description?: string | null
          history_images?: Json
          history_title?: string | null
          history_years?: Json
          id?: string
          logo_url?: string | null
          maintenance_enabled?: boolean
          membership_period_days?: number
          membership_price?: number
          memberships_open?: boolean
          name: string
          president_id?: string | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          short_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          band_description?: string | null
          band_image_url?: string | null
          band_whatsapp_url?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          history_description?: string | null
          history_images?: Json
          history_title?: string | null
          history_years?: Json
          id?: string
          logo_url?: string | null
          maintenance_enabled?: boolean
          membership_period_days?: number
          membership_price?: number
          memberships_open?: boolean
          name?: string
          president_id?: string | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          short_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      camed_bookings: {
        Row: {
          created_at: string
          extra_participants: string | null
          id: string
          modality: string
          phone: string
          reason: string
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_participants?: string | null
          id?: string
          modality: string
          phone: string
          reason: string
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_participants?: string | null
          id?: string
          modality?: string
          phone?: string
          reason?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camed_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "camed_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      camed_contact_buttons: {
        Row: {
          created_at: string
          display_order: number
          id: string
          label: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          label: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      camed_course_documents: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camed_course_infos: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          link_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camed_documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          mime_type: string | null
          name: string
          parent_id: string | null
          size_bytes: number | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          name: string
          parent_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          parent_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camed_documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "camed_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      camed_info: {
        Row: {
          description: string
          email: string | null
          hero_image_url: string | null
          history_description: string | null
          history_images: Json
          history_title: string
          id: number
          subtitle: string
          title: string
          updated_at: string
          whatsapp_apikey: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          description?: string
          email?: string | null
          hero_image_url?: string | null
          history_description?: string | null
          history_images?: Json
          history_title?: string
          id?: number
          subtitle?: string
          title?: string
          updated_at?: string
          whatsapp_apikey?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          description?: string
          email?: string | null
          hero_image_url?: string | null
          history_description?: string | null
          history_images?: Json
          history_title?: string
          id?: number
          subtitle?: string
          title?: string
          updated_at?: string
          whatsapp_apikey?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      camed_members: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          role: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          role?: string
        }
        Relationships: []
      }
      camed_messages: {
        Row: {
          created_at: string
          id: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      camed_news: {
        Row: {
          category: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          link: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          title?: string
        }
        Relationships: []
      }
      camed_panel_access: {
        Row: {
          created_at: string
          email: string
          id: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      camed_presidents: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      camed_settings: {
        Row: {
          id: number
          league_registration_fee: number
          maintenance_enabled: boolean
          semestrality_fee: number
          updated_at: string
        }
        Insert: {
          id?: number
          league_registration_fee?: number
          maintenance_enabled?: boolean
          semestrality_fee?: number
          updated_at?: string
        }
        Update: {
          id?: number
          league_registration_fee?: number
          maintenance_enabled?: boolean
          semestrality_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      camed_slots: {
        Row: {
          allow_in_person: boolean
          allow_online: boolean
          attendant_name: string | null
          created_at: string
          created_by: string | null
          id: string
          slot_at: string
          updated_at: string
        }
        Insert: {
          allow_in_person?: boolean
          allow_online?: boolean
          attendant_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          slot_at: string
          updated_at?: string
        }
        Update: {
          allow_in_person?: boolean
          allow_online?: boolean
          attendant_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          slot_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificate_email_log: {
        Row: {
          cpf: string | null
          email: string
          error: string | null
          full_name: string
          id: string
          league_id: string
          sent_at: string
          status: string
          total_hours: number
          user_id: string
        }
        Insert: {
          cpf?: string | null
          email: string
          error?: string | null
          full_name: string
          id?: string
          league_id: string
          sent_at?: string
          status?: string
          total_hours?: number
          user_id: string
        }
        Update: {
          cpf?: string | null
          email?: string
          error?: string | null
          full_name?: string
          id?: string
          league_id?: string
          sent_at?: string
          status?: string
          total_hours?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_email_log_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_email_log_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subdivisions: {
        Row: {
          afternoon_end: string | null
          afternoon_start: string | null
          class_code: string
          created_at: string
          id: string
          letter: string
          morning_end: string | null
          morning_start: string | null
          night_end: string | null
          night_start: string | null
          updated_at: string
        }
        Insert: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          class_code: string
          created_at?: string
          id?: string
          letter: string
          morning_end?: string | null
          morning_start?: string | null
          night_end?: string | null
          night_start?: string | null
          updated_at?: string
        }
        Update: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          class_code?: string
          created_at?: string
          id?: string
          letter?: string
          morning_end?: string | null
          morning_start?: string | null
          night_end?: string | null
          night_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coordination_staff: {
        Row: {
          bio: string | null
          created_at: string
          display_order: number
          email: string | null
          id: string
          image_url: string | null
          name: string
          role_key: string
          title: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          image_url?: string | null
          name: string
          role_key: string
          title: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          image_url?: string | null
          name?: string
          role_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_checkins: {
        Row: {
          by_user_id: string | null
          checked_in_at: string
          checkin_index: number
          created_at: string
          event_id: string
          id: string
          method: string
          registration_id: string
        }
        Insert: {
          by_user_id?: string | null
          checked_in_at?: string
          checkin_index: number
          created_at?: string
          event_id: string
          id?: string
          method?: string
          registration_id: string
        }
        Update: {
          by_user_id?: string | null
          checked_in_at?: string
          checkin_index?: number
          created_at?: string
          event_id?: string
          id?: string
          method?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "league_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_email_log: {
        Row: {
          event_id: string
          id: string
          kind: string
          recipient: string
          reference_id: string | null
          sent_at: string
        }
        Insert: {
          event_id: string
          id?: string
          kind: string
          recipient: string
          reference_id?: string | null
          sent_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          kind?: string
          recipient?: string
          reference_id?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          base_price: number
          category: string
          checkin_code: string | null
          course: string
          cpf: string
          created_at: string
          discount_reason: string | null
          event_id: string
          full_name: string
          id: string
          paid_price: number
          referred_by: string | null
          social_name: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number
          category?: string
          checkin_code?: string | null
          course: string
          cpf: string
          created_at?: string
          discount_reason?: string | null
          event_id: string
          full_name: string
          id?: string
          paid_price?: number
          referred_by?: string | null
          social_name?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number
          category?: string
          checkin_code?: string | null
          course?: string
          cpf?: string
          created_at?: string
          discount_reason?: string | null
          event_id?: string
          full_name?: string
          id?: string
          paid_price?: number
          referred_by?: string | null
          social_name?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "league_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_snapshots: {
        Row: {
          event_id: string
          id: string
          payload: Json
          taken_at: string
        }
        Insert: {
          event_id: string
          id?: string
          payload: Json
          taken_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          payload?: Json
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "league_events"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          label: string
          term_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          label: string
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          label?: string
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      ifmsa_info: {
        Row: {
          cartilha_cta: string | null
          cartilha_description: string | null
          cartilha_title: string | null
          cartilha_url: string | null
          description: string | null
          hero_image_url: string | null
          id: number
          instagram_url: string | null
          logo_url: string | null
          subtitle: string | null
          title: string
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          cartilha_cta?: string | null
          cartilha_description?: string | null
          cartilha_title?: string | null
          cartilha_url?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          cartilha_cta?: string | null
          cartilha_description?: string | null
          cartilha_title?: string | null
          cartilha_url?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      ifmsa_members: {
        Row: {
          acronym: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          role: string
          sector_code: string | null
        }
        Insert: {
          acronym?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          role: string
          sector_code?: string | null
        }
        Update: {
          acronym?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          role?: string
          sector_code?: string | null
        }
        Relationships: []
      }
      ifmsa_panel_access: {
        Row: {
          created_at: string
          email: string
          id: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ifmsa_sectors: {
        Row: {
          code: string
          color: string
          created_at: string
          description: string | null
          display_order: number
          emoji: string | null
          full_name: string | null
          highlights: Json
          icon_url: string | null
          id: string
          image_url: string | null
          is_exchange: boolean
          links: Json
          name: string
          published: boolean
          short_description: string | null
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          full_name?: string | null
          highlights?: Json
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_exchange?: boolean
          links?: Json
          name: string
          published?: boolean
          short_description?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          full_name?: string | null
          highlights?: Json
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_exchange?: boolean
          links?: Json
          name?: string
          published?: boolean
          short_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ifmsa_testimonials: {
        Row: {
          created_at: string
          display_order: number
          id: string
          location: string | null
          name: string
          photo_url: string | null
          program: string | null
          published: boolean
          quote: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          location?: string | null
          name: string
          photo_url?: string | null
          program?: string | null
          published?: boolean
          quote: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          location?: string | null
          name?: string
          photo_url?: string | null
          program?: string | null
          published?: boolean
          quote?: string
        }
        Relationships: []
      }
      league_activities: {
        Row: {
          caption: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_open: boolean
          league_id: string
          participating_league_ids: string[]
          starts_at: string | null
          title: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_open?: boolean
          league_id: string
          participating_league_ids?: string[]
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_open?: boolean
          league_id?: string
          participating_league_ids?: string[]
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_activities_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_activities_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_asaas_accounts: {
        Row: {
          account_email: string | null
          account_name: string | null
          api_key_encrypted: string
          connected_at: string
          league_id: string
          sandbox: boolean
          updated_at: string
          wallet_id: string | null
        }
        Insert: {
          account_email?: string | null
          account_name?: string | null
          api_key_encrypted: string
          connected_at?: string
          league_id: string
          sandbox?: boolean
          updated_at?: string
          wallet_id?: string | null
        }
        Update: {
          account_email?: string | null
          account_name?: string | null
          api_key_encrypted?: string
          connected_at?: string
          league_id?: string
          sandbox?: boolean
          updated_at?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_asaas_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_asaas_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_attendance: {
        Row: {
          activity: string
          activity_date: string
          created_at: string
          description: string | null
          hours: number
          id: string
          league_id: string
          present: boolean
          status: string
          user_id: string
        }
        Insert: {
          activity: string
          activity_date: string
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          league_id: string
          present?: boolean
          status?: string
          user_id: string
        }
        Update: {
          activity?: string
          activity_date?: string
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          league_id?: string
          present?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_attendance_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_attendance_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_cash_entries: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          league_id: string
          notes: string | null
          occurred_at: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          kind: string
          league_id: string
          notes?: string | null
          occurred_at?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          league_id?: string
          notes?: string | null
          occurred_at?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_cash_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_cash_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_certificate_templates: {
        Row: {
          created_at: string
          font_family: string
          id: string
          league_id: string
          name_box: Json
          signature_box: Json
          template_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          font_family?: string
          id?: string
          league_id: string
          name_box?: Json
          signature_box?: Json
          template_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          font_family?: string
          id?: string
          league_id?: string
          name_box?: Json
          signature_box?: Json
          template_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_certificate_templates_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_certificate_templates_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_content: {
        Row: {
          content_key: string
          content_value: string
          id: string
          league_id: string
          updated_at: string
        }
        Insert: {
          content_key: string
          content_value: string
          id?: string
          league_id: string
          updated_at?: string
        }
        Update: {
          content_key?: string
          content_value?: string
          id?: string
          league_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_content_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_content_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_efi_accounts: {
        Row: {
          account_name: string | null
          client_id_encrypted: string
          client_secret_encrypted: string
          connected_at: string
          created_at: string
          league_id: string
          sandbox: boolean
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          client_id_encrypted: string
          client_secret_encrypted: string
          connected_at?: string
          created_at?: string
          league_id: string
          sandbox?: boolean
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          client_id_encrypted?: string
          client_secret_encrypted?: string
          connected_at?: string
          created_at?: string
          league_id?: string
          sandbox?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_efi_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_efi_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_events: {
        Row: {
          accepting_registrations: boolean
          checkin_count: number
          checkin_schedule: Json
          created_at: string
          description: string | null
          end_date: string | null
          event_date: string | null
          free_minicourse_quota: number
          freeze_on_event_day: boolean
          full_name_required: boolean
          id: string
          image_url: string | null
          league_id: string
          max_seats: number | null
          partner_league_ids: string[]
          price_ligante: number
          price_partner: number
          price_visitor: number
          published: boolean
          registration_deadline: string | null
          registration_link: string | null
          schedule: string | null
          title: string
          total_hours: number | null
        }
        Insert: {
          accepting_registrations?: boolean
          checkin_count?: number
          checkin_schedule?: Json
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          free_minicourse_quota?: number
          freeze_on_event_day?: boolean
          full_name_required?: boolean
          id?: string
          image_url?: string | null
          league_id: string
          max_seats?: number | null
          partner_league_ids?: string[]
          price_ligante?: number
          price_partner?: number
          price_visitor?: number
          published?: boolean
          registration_deadline?: string | null
          registration_link?: string | null
          schedule?: string | null
          title: string
          total_hours?: number | null
        }
        Update: {
          accepting_registrations?: boolean
          checkin_count?: number
          checkin_schedule?: Json
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          free_minicourse_quota?: number
          freeze_on_event_day?: boolean
          full_name_required?: boolean
          id?: string
          image_url?: string | null
          league_id?: string
          max_seats?: number | null
          partner_league_ids?: string[]
          price_ligante?: number
          price_partner?: number
          price_visitor?: number
          published?: boolean
          registration_deadline?: string | null
          registration_link?: string | null
          schedule?: string | null
          title?: string
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_infinitepay_accounts: {
        Row: {
          connected_at: string
          handle: string
          league_id: string
        }
        Insert: {
          connected_at?: string
          handle: string
          league_id: string
        }
        Update: {
          connected_at?: string
          handle?: string
          league_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_infinitepay_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_infinitepay_accounts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_leave_requests: {
        Row: {
          created_at: string
          id: string
          league_id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      league_likes: {
        Row: {
          created_at: string
          id: string
          league_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_likes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_likes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_memberships: {
        Row: {
          created_at: string
          id: string
          league_id: string
          permissions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_memberships_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_memberships_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_minicourses: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          instructor: string
          is_free: boolean
          location: string | null
          max_registrations: number
          price: number
          price_ligante: number | null
          published: boolean
          starts_at: string
          title: string
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          instructor: string
          is_free?: boolean
          location?: string | null
          max_registrations?: number
          price?: number
          price_ligante?: number | null
          published?: boolean
          starts_at: string
          title: string
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          instructor?: string
          is_free?: boolean
          location?: string | null
          max_registrations?: number
          price?: number
          price_ligante?: number | null
          published?: boolean
          starts_at?: string
          title?: string
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_minicourses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "league_events"
            referencedColumns: ["id"]
          },
        ]
      }
      league_mp_accounts: {
        Row: {
          access_token: string
          connected_at: string
          expires_at: string | null
          id: string
          league_id: string
          live_mode: boolean
          mp_user_id: string
          public_key: string | null
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          expires_at?: string | null
          id?: string
          league_id: string
          live_mode?: boolean
          mp_user_id: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          expires_at?: string | null
          id?: string
          league_id?: string
          live_mode?: boolean
          mp_user_id?: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      league_news: {
        Row: {
          category: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          league_id: string
          link: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          league_id: string
          link?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          league_id?: string
          link?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_news_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_news_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_notifications: {
        Row: {
          created_at: string
          id: string
          league_id: string
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          message: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          message?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_notifications_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_notifications_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_points: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          league_id: string
          points: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          league_id: string
          points: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          league_id?: string
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_points_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_points_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_president_signatures: {
        Row: {
          created_at: string
          id: string
          league_id: string
          president_name: string | null
          signature_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          president_name?: string | null
          signature_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          president_name?: string | null
          signature_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_president_signatures_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_president_signatures_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_quiz_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          quiz_id: string
          selected: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          quiz_id: string
          selected: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          quiz_id?: string
          selected?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_quiz_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "league_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      league_quiz_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_private: boolean
          league_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          league_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          league_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_quiz_sets_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_quiz_sets_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_quizzes: {
        Row: {
          correct_answer: number
          created_at: string
          display_order: number
          explanation: string | null
          id: string
          image_url: string | null
          options: Json
          question: string
          quiz_set_id: string
        }
        Insert: {
          correct_answer: number
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          image_url?: string | null
          options: Json
          question: string
          quiz_set_id: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json
          question?: string
          quiz_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_quizzes_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "league_quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      league_schedule_items: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          league_id: string
          name: string
          scheduled_date: string
          scheduled_time: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          league_id: string
          name: string
          scheduled_date: string
          scheduled_time?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          league_id?: string
          name?: string
          scheduled_date?: string
          scheduled_time?: string | null
        }
        Relationships: []
      }
      league_score_requests: {
        Row: {
          approved_points: number | null
          created_at: string
          description: string
          id: string
          league_id: string
          points_requested: number
          receipt_url: string | null
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_points?: number | null
          created_at?: string
          description: string
          id?: string
          league_id: string
          points_requested: number
          receipt_url?: string | null
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_points?: number | null
          created_at?: string
          description?: string
          id?: string
          league_id?: string
          points_requested?: number
          receipt_url?: string | null
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_score_requests_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_score_requests_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_selection_exam_attempts: {
        Row: {
          answers: Json
          created_at: string
          delivery_position: number | null
          exam_id: string
          id: string
          option_orders: Json
          paused_at: string | null
          question_order: Json
          registration_id: string
          score: number | null
          started_at: string
          submitted_at: string | null
          time_used_ms: number
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          delivery_position?: number | null
          exam_id: string
          id?: string
          option_orders?: Json
          paused_at?: string | null
          question_order?: Json
          registration_id: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          time_used_ms?: number
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          delivery_position?: number | null
          exam_id?: string
          id?: string
          option_orders?: Json
          paused_at?: string | null
          question_order?: Json
          registration_id?: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          time_used_ms?: number
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_selection_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "league_selection_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_selection_exam_questions: {
        Row: {
          correct_answer: number
          created_at: string
          display_order: number
          exam_id: string
          id: string
          image_url: string | null
          options: Json
          question: string
        }
        Insert: {
          correct_answer: number
          created_at?: string
          display_order?: number
          exam_id: string
          id?: string
          image_url?: string | null
          options: Json
          question: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          display_order?: number
          exam_id?: string
          id?: string
          image_url?: string | null
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_selection_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "league_selection_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_selection_exams: {
        Row: {
          created_at: string
          id: string
          league_id: string
          published: boolean
          reentry_code: string
          send_answers_email: boolean
          shuffle: boolean
          time_limit_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          published?: boolean
          reentry_code?: string
          send_answers_email?: boolean
          shuffle?: boolean
          time_limit_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          published?: boolean
          reentry_code?: string
          send_answers_email?: boolean
          shuffle?: boolean
          time_limit_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      league_selection_quotas: {
        Row: {
          created_at: string
          id: string
          league_id: string
          restrict_to_semester: boolean
          seats: number
          semester: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          restrict_to_semester?: boolean
          seats?: number
          semester: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          restrict_to_semester?: boolean
          seats?: number
          semester?: number
        }
        Relationships: []
      }
      league_selection_ranking_history: {
        Row: {
          created_at: string
          id: string
          league_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      league_selection_registrations: {
        Row: {
          cpf: string
          created_at: string
          delivery_position: number | null
          email: string
          full_name: string
          grade: number | null
          id: string
          league_id: string
          paid_price: number
          phone: string
          present: boolean
          ranked_position: number | null
          ranked_semester: number | null
          ranked_via: string | null
          registration_number: string | null
          semester: number
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          delivery_position?: number | null
          email: string
          full_name: string
          grade?: number | null
          id?: string
          league_id: string
          paid_price?: number
          phone: string
          present?: boolean
          ranked_position?: number | null
          ranked_semester?: number | null
          ranked_via?: string | null
          registration_number?: string | null
          semester: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          delivery_position?: number | null
          email?: string
          full_name?: string
          grade?: number | null
          id?: string
          league_id?: string
          paid_price?: number
          phone?: string
          present?: boolean
          ranked_position?: number | null
          ranked_semester?: number | null
          ranked_via?: string | null
          registration_number?: string | null
          semester?: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      league_sheets_sync: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          league_id: string
          spreadsheet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          league_id: string
          spreadsheet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          league_id?: string
          spreadsheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_sheets_sync_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_sheets_sync_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          league_id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          league_id: string
          price_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          league_id?: string
          price_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          initial_setup_done: boolean
          name: string
          paid_until: string | null
          payment_provider: string
          president_id: string | null
          president2_id: string | null
          published: boolean
          selection_deadline: string | null
          selection_exam_date: string | null
          selection_exam_description: string | null
          selection_exam_time: string | null
          selection_open: boolean
          selection_total_seats: number
          slug: string
          theme_color: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          initial_setup_done?: boolean
          name: string
          paid_until?: string | null
          payment_provider?: string
          president_id?: string | null
          president2_id?: string | null
          published?: boolean
          selection_deadline?: string | null
          selection_exam_date?: string | null
          selection_exam_description?: string | null
          selection_exam_time?: string | null
          selection_open?: boolean
          selection_total_seats?: number
          slug: string
          theme_color?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          initial_setup_done?: boolean
          name?: string
          paid_until?: string | null
          payment_provider?: string
          president_id?: string | null
          president2_id?: string | null
          published?: boolean
          selection_deadline?: string | null
          selection_exam_date?: string | null
          selection_exam_description?: string | null
          selection_exam_time?: string | null
          selection_open?: boolean
          selection_total_seats?: number
          slug?: string
          theme_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      minicourse_checkins: {
        Row: {
          by_user_id: string | null
          checked_in_at: string
          created_at: string
          id: string
          method: string
          minicourse_id: string
          registration_id: string
        }
        Insert: {
          by_user_id?: string | null
          checked_in_at?: string
          created_at?: string
          id?: string
          method?: string
          minicourse_id: string
          registration_id: string
        }
        Update: {
          by_user_id?: string | null
          checked_in_at?: string
          created_at?: string
          id?: string
          method?: string
          minicourse_id?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minicourse_checkins_minicourse_id_fkey"
            columns: ["minicourse_id"]
            isOneToOne: false
            referencedRelation: "league_minicourses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_checkins_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "minicourse_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      minicourse_exclusive_slots: {
        Row: {
          created_at: string
          id: string
          league_id: string
          minicourse_id: string
          price: number | null
          seats: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          minicourse_id: string
          price?: number | null
          seats: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          minicourse_id?: string
          price?: number | null
          seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "minicourse_exclusive_slots_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_exclusive_slots_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_exclusive_slots_minicourse_id_fkey"
            columns: ["minicourse_id"]
            isOneToOne: false
            referencedRelation: "league_minicourses"
            referencedColumns: ["id"]
          },
        ]
      }
      minicourse_registrations: {
        Row: {
          checkin_code: string | null
          cpf: string | null
          created_at: string
          event_registration_id: string
          exclusive_league_id: string | null
          full_name: string | null
          id: string
          minicourse_id: string
          paid_price: number
          quota_used: boolean
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_code?: string | null
          cpf?: string | null
          created_at?: string
          event_registration_id: string
          exclusive_league_id?: string | null
          full_name?: string | null
          id?: string
          minicourse_id: string
          paid_price?: number
          quota_used?: boolean
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_code?: string | null
          cpf?: string | null
          created_at?: string
          event_registration_id?: string
          exclusive_league_id?: string | null
          full_name?: string | null
          id?: string
          minicourse_id?: string
          paid_price?: number
          quota_used?: boolean
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minicourse_registrations_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_registrations_exclusive_league_id_fkey"
            columns: ["exclusive_league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_registrations_exclusive_league_id_fkey"
            columns: ["exclusive_league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minicourse_registrations_minicourse_id_fkey"
            columns: ["minicourse_id"]
            isOneToOne: false
            referencedRelation: "league_minicourses"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          category: string
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          league_id: string | null
          mp_payment_id: string | null
          mp_preapproval_id: string | null
          mp_preference_id: string | null
          payment_method: string | null
          raw: Json | null
          reference_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          league_id?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_preference_id?: string | null
          payment_method?: string | null
          raw?: Json | null
          reference_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          league_id?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_preference_id?: string | null
          payment_method?: string | null
          raw?: Json | null
          reference_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      personal_schedule_items: {
        Row: {
          color: string
          created_at: string
          date: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          class_code: Database["public"]["Enums"]["atm_class"] | null
          course: string | null
          cpf: string | null
          created_at: string
          current_semester: number | null
          email: string
          full_name: string | null
          id: string
          is_unochapeco_student: boolean
          matricula: string | null
          phone: string | null
          profile_reviewed_at: string | null
          registration_number: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          class_code?: Database["public"]["Enums"]["atm_class"] | null
          course?: string | null
          cpf?: string | null
          created_at?: string
          current_semester?: number | null
          email: string
          full_name?: string | null
          id: string
          is_unochapeco_student?: boolean
          matricula?: string | null
          phone?: string | null
          profile_reviewed_at?: string | null
          registration_number?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          class_code?: Database["public"]["Enums"]["atm_class"] | null
          course?: string | null
          cpf?: string | null
          created_at?: string
          current_semester?: number | null
          email?: string
          full_name?: string | null
          id?: string
          is_unochapeco_student?: boolean
          matricula?: string | null
          phone?: string | null
          profile_reviewed_at?: string | null
          registration_number?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      schedule_entries: {
        Row: {
          class_code: Database["public"]["Enums"]["atm_class"]
          color: string | null
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          is_abex: boolean
          kind: Database["public"]["Enums"]["schedule_kind"]
          notes: string | null
          practice_groups: string[]
          rescheduled_from_entry_id: string | null
          rescheduled_to_date: string | null
          shift: Database["public"]["Enums"]["shift_period"]
          start_time: string
          subdivision: string
          subject_id: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          class_code: Database["public"]["Enums"]["atm_class"]
          color?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          is_abex?: boolean
          kind?: Database["public"]["Enums"]["schedule_kind"]
          notes?: string | null
          practice_groups?: string[]
          rescheduled_from_entry_id?: string | null
          rescheduled_to_date?: string | null
          shift: Database["public"]["Enums"]["shift_period"]
          start_time: string
          subdivision?: string
          subject_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          class_code?: Database["public"]["Enums"]["atm_class"]
          color?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          is_abex?: boolean
          kind?: Database["public"]["Enums"]["schedule_kind"]
          notes?: string | null
          practice_groups?: string[]
          rescheduled_from_entry_id?: string | null
          rescheduled_to_date?: string | null
          shift?: Database["public"]["Enums"]["shift_period"]
          start_time?: string
          subdivision?: string
          subject_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_rescheduled_from_entry_id_fkey"
            columns: ["rescheduled_from_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_cycles: {
        Row: {
          amount_cents: number
          closed_at: string | null
          created_at: string
          director_amount_cents: number
          due_date: string
          end_date: string
          id: string
          is_current: boolean
          last_notified_at: string | null
          late_fee_cents: number
          league_id: string
          semester: number
          start_date: string
          updated_at: string
          year: number
        }
        Insert: {
          amount_cents?: number
          closed_at?: string | null
          created_at?: string
          director_amount_cents?: number
          due_date: string
          end_date: string
          id?: string
          is_current?: boolean
          last_notified_at?: string | null
          late_fee_cents?: number
          league_id: string
          semester: number
          start_date: string
          updated_at?: string
          year: number
        }
        Update: {
          amount_cents?: number
          closed_at?: string | null
          created_at?: string
          director_amount_cents?: number
          due_date?: string
          end_date?: string
          id?: string
          is_current?: boolean
          last_notified_at?: string | null
          late_fee_cents?: number
          league_id?: string
          semester?: number
          start_date?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "semester_cycles_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_cycles_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_payments: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          cycle_id: string
          id: string
          league_id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          cycle_id: string
          id?: string
          league_id: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          cycle_id?: string
          id?: string
          league_id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "semester_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_payments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_payments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_ai_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          rule: string
          source_feedback_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          rule: string
          source_feedback_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          rule?: string
          source_feedback_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_ai_rules_source_feedback_id_fkey"
            columns: ["source_feedback_id"]
            isOneToOne: false
            referencedRelation: "sim_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_auscultation_sounds: {
        Row: {
          audio_url: string | null
          category: string
          created_at: string
          description: string | null
          finding_key: string
          id: string
          label: string
          license: string | null
          region: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          category: string
          created_at?: string
          description?: string | null
          finding_key: string
          id?: string
          label: string
          license?: string | null
          region: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          finding_key?: string
          id?: string
          label?: string
          license?: string | null
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      sim_cases: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          diagnosis: string
          exams: Json
          expected_conduct: string | null
          findings: Json
          hidden_history: string | null
          id: string
          level: number
          patient: Json
          patient_image_url: string | null
          published: boolean
          summary: string | null
          title: string
          triage: Json
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          diagnosis: string
          exams?: Json
          expected_conduct?: string | null
          findings?: Json
          hidden_history?: string | null
          id?: string
          level: number
          patient?: Json
          patient_image_url?: string | null
          published?: boolean
          summary?: string | null
          title: string
          triage?: Json
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          exams?: Json
          expected_conduct?: string | null
          findings?: Json
          hidden_history?: string | null
          id?: string
          level?: number
          patient?: Json
          patient_image_url?: string | null
          published?: boolean
          summary?: string | null
          title?: string
          triage?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sim_credit_balances: {
        Row: {
          created_at: string
          credits: number
          total_purchased: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          total_purchased?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          total_purchased?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sim_credit_ledger: {
        Row: {
          amount_brl: number
          cost_brl: number
          created_at: string
          credits: number
          description: string | null
          id: string
          kind: string
          session_id: string | null
          tokens: number
          user_id: string
        }
        Insert: {
          amount_brl?: number
          cost_brl?: number
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          kind: string
          session_id?: string | null
          tokens?: number
          user_id: string
        }
        Update: {
          amount_brl?: number
          cost_brl?: number
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          kind?: string
          session_id?: string | null
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_credit_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_credit_packages: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          id: string
          name: string
          price_brl: number
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          id?: string
          name: string
          price_brl: number
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          id?: string
          name?: string
          price_brl?: number
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      sim_feedback: {
        Row: {
          ai_review: Json | null
          comment: string | null
          created_at: string
          id: string
          rating: string
          session_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_review?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: string
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_review?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_purchases: {
        Row: {
          amount_brl: number
          checkout_url: string | null
          created_at: string
          credits: number
          external_id: string | null
          id: string
          package_id: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_brl: number
          checkout_url?: string | null
          created_at?: string
          credits: number
          external_id?: string | null
          id?: string
          package_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_brl?: number
          checkout_url?: string | null
          created_at?: string
          credits?: number
          external_id?: string | null
          id?: string
          package_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sim_credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_sessions: {
        Row: {
          anamnese: string | null
          area: string | null
          case_id: string
          created_at: string
          exam_requests: Json
          finished_at: string | null
          hypothesis: string | null
          id: string
          level: number | null
          physical_findings: Json
          review: Json | null
          score: number | null
          status: string
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnese?: string | null
          area?: string | null
          case_id: string
          created_at?: string
          exam_requests?: Json
          finished_at?: string | null
          hypothesis?: string | null
          id?: string
          level?: number | null
          physical_findings?: Json
          review?: Json | null
          score?: number | null
          status?: string
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnese?: string | null
          area?: string | null
          case_id?: string
          created_at?: string
          exam_requests?: Json
          finished_at?: string | null
          hypothesis?: string | null
          id?: string
          level?: number | null
          physical_findings?: Json
          review?: Json | null
          score?: number | null
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sim_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_settings: {
        Row: {
          anthropic_key_enc: string | null
          chat_cost_in_brl_per_mtok: number
          chat_cost_out_brl_per_mtok: number
          chat_model: string
          free_credits: number
          gateway_fee_pct: number
          grade_cost_in_brl_per_mtok: number
          grade_cost_out_brl_per_mtok: number
          grade_model: string
          id: boolean
          mp_access_token_enc: string | null
          openai_key_enc: string | null
          price_divisor: number
          tokens_per_credit: number
          updated_at: string
        }
        Insert: {
          anthropic_key_enc?: string | null
          chat_cost_in_brl_per_mtok?: number
          chat_cost_out_brl_per_mtok?: number
          chat_model?: string
          free_credits?: number
          gateway_fee_pct?: number
          grade_cost_in_brl_per_mtok?: number
          grade_cost_out_brl_per_mtok?: number
          grade_model?: string
          id?: boolean
          mp_access_token_enc?: string | null
          openai_key_enc?: string | null
          price_divisor?: number
          tokens_per_credit?: number
          updated_at?: string
        }
        Update: {
          anthropic_key_enc?: string | null
          chat_cost_in_brl_per_mtok?: number
          chat_cost_out_brl_per_mtok?: number
          chat_model?: string
          free_credits?: number
          gateway_fee_pct?: number
          grade_cost_in_brl_per_mtok?: number
          grade_cost_out_brl_per_mtok?: number
          grade_model?: string
          id?: boolean
          mp_access_token_enc?: string | null
          openai_key_enc?: string | null
          price_divisor?: number
          tokens_per_credit?: number
          updated_at?: string
        }
        Relationships: []
      }
      sim_usage_events: {
        Row: {
          completion_tokens: number
          cost_brl: number
          created_at: string
          credits: number
          id: string
          model: string
          phase: string
          prompt_tokens: number
          session_id: string | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          cost_brl?: number
          created_at?: string
          credits?: number
          id?: string
          model: string
          phase: string
          prompt_tokens?: number
          session_id?: string | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          completion_tokens?: number
          cost_brl?: number
          created_at?: string
          credits?: number
          id?: string
          model?: string
          phase?: string
          prompt_tokens?: number
          session_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_usage_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      subject_teachers: {
        Row: {
          subject_id: string
          teacher_id: string
        }
        Insert: {
          subject_id: string
          teacher_id: string
        }
        Update: {
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_codes: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          professor: string | null
          professor_contact: string | null
          semester: number | null
          subdivisions: string[]
          updated_at: string
          workload_hours: number | null
        }
        Insert: {
          class_codes?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          professor?: string | null
          professor_contact?: string | null
          semester?: number | null
          subdivisions?: string[]
          updated_at?: string
          workload_hours?: number | null
        }
        Update: {
          class_codes?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          professor?: string | null
          professor_contact?: string | null
          semester?: number | null
          subdivisions?: string[]
          updated_at?: string
          workload_hours?: number | null
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
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
    }
    Views: {
      public_leagues: {
        Row: {
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string | null
          initial_setup_done: boolean | null
          name: string | null
          paid_until: string | null
          president_id: string | null
          published: boolean | null
          slug: string | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string | null
          initial_setup_done?: boolean | null
          name?: string | null
          paid_until?: string | null
          president_id?: string | null
          published?: boolean | null
          slug?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string | null
          initial_setup_done?: boolean | null
          name?: string | null
          paid_until?: string | null
          president_id?: string | null
          published?: boolean | null
          slug?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_semester: { Args: never; Returns: number }
      camed_panel_permissions: { Args: { _user_id: string }; Returns: string[] }
      can_manage_league_cash: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      find_profile_for_league: {
        Args: { _league_id: string; _query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          username: string
        }[]
      }
      gen_checkin_code: { Args: never; Returns: string }
      get_ad_analytics_summary: {
        Args: { _since: string }
        Returns: {
          action: string
          ad_id: string
          cnt: number
          day: string
          unique_users: number
        }[]
      }
      get_visits_summary: {
        Args: { _granularity: string; _since: string }
        Returns: {
          label: string
          total: number
          unique_count: number
        }[]
      }
      get_visits_totals: {
        Args: { _since: string }
        Returns: {
          total_visits: number
          unique_visitors: number
        }[]
      }
      has_camed_panel_access: { Args: { _user_id: string }; Returns: boolean }
      has_camed_panel_tab: {
        Args: { _tab: string; _user_id: string }
        Returns: boolean
      }
      has_ifmsa_panel_access: { Args: { _user_id: string }; Returns: boolean }
      has_ifmsa_panel_tab: {
        Args: { _tab: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_athletic_director: {
        Args: { _athletic_id: string; _user_id: string }
        Returns: boolean
      }
      is_athletic_member: {
        Args: { _athletic_id: string; _user_id: string }
        Returns: boolean
      }
      is_camed_president: { Args: { _user_id: string }; Returns: boolean }
      is_coordination: { Args: { _user_id: string }; Returns: boolean }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      manager_get_quizzes: {
        Args: { _set_id: string }
        Returns: {
          correct_answer: number
          created_at: string
          display_order: number
          explanation: string
          id: string
          options: Json
          question: string
          quiz_set_id: string
        }[]
      }
      mark_overdue_semester_payments: { Args: never; Returns: number }
      my_quiz_answers: {
        Args: { _set_id: string }
        Returns: {
          correct_answer: number
          explanation: string
          is_correct: boolean
          quiz_id: string
          selected: number
        }[]
      }
      sim_add_credits: {
        Args: {
          _amount: number
          _credits: number
          _description: string
          _user_id: string
        }
        Returns: number
      }
      sim_debit_credits: {
        Args: {
          _cost: number
          _credits: number
          _description: string
          _session_id: string
          _tokens: number
          _user_id: string
        }
        Returns: number
      }
      submit_quiz_answer: {
        Args: { _answer: number; _quiz_id: string }
        Returns: {
          correct_answer: number
          explanation: string
          is_correct: boolean
        }[]
      }
      username_available: { Args: { _username: string }; Returns: boolean }
      users_share_league: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin_master"
        | "presidente"
        | "diretor"
        | "ligante"
        | "visitante"
        | "coordenacao"
      athletic_cash_category:
        | "product"
        | "event_online"
        | "event_manual"
        | "membership"
        | "manual"
        | "withdraw"
      athletic_order_status: "pending" | "paid" | "cancelled" | "refunded"
      athletic_role: "socio" | "diretor" | "presidente"
      athletic_ticket_status:
        | "available"
        | "sold"
        | "used"
        | "cancelled"
        | "reserved"
      atm_class: "ATM31" | "ATM30" | "ATM29" | "ATM28" | "ATM27" | "ATM26"
      delivery_status: "pending" | "delivered"
      order_source: "site" | "manual"
      schedule_kind: "class" | "practice" | "exam" | "green_zone" | "abex"
      shift_period: "morning" | "afternoon" | "night"
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
      app_role: [
        "admin_master",
        "presidente",
        "diretor",
        "ligante",
        "visitante",
        "coordenacao",
      ],
      athletic_cash_category: [
        "product",
        "event_online",
        "event_manual",
        "membership",
        "manual",
        "withdraw",
      ],
      athletic_order_status: ["pending", "paid", "cancelled", "refunded"],
      athletic_role: ["socio", "diretor", "presidente"],
      athletic_ticket_status: [
        "available",
        "sold",
        "used",
        "cancelled",
        "reserved",
      ],
      atm_class: ["ATM31", "ATM30", "ATM29", "ATM28", "ATM27", "ATM26"],
      delivery_status: ["pending", "delivered"],
      order_source: ["site", "manual"],
      schedule_kind: ["class", "practice", "exam", "green_zone", "abex"],
      shift_period: ["morning", "afternoon", "night"],
    },
  },
} as const
