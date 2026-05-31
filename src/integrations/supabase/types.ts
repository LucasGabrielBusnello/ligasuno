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
      app_settings: {
        Row: {
          annual_fee_credit_monthly: number
          annual_fee_pix_monthly: number
          id: number
          updated_at: string
        }
        Insert: {
          annual_fee_credit_monthly?: number
          annual_fee_pix_monthly?: number
          id?: number
          updated_at?: string
        }
        Update: {
          annual_fee_credit_monthly?: number
          annual_fee_pix_monthly?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      camed_info: {
        Row: {
          description: string
          id: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          description?: string
          id?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: number
          subtitle?: string
          title?: string
          updated_at?: string
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
          semestrality_fee: number
          updated_at: string
        }
        Insert: {
          id?: number
          league_registration_fee?: number
          semestrality_fee?: number
          updated_at?: string
        }
        Update: {
          id?: number
          league_registration_fee?: number
          semestrality_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          base_price: number
          category: string
          course: string
          cpf: string
          created_at: string
          discount_reason: string | null
          event_id: string
          full_name: string
          id: string
          paid_price: number
          social_name: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number
          category?: string
          course: string
          cpf: string
          created_at?: string
          discount_reason?: string | null
          event_id: string
          full_name: string
          id?: string
          paid_price?: number
          social_name?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number
          category?: string
          course?: string
          cpf?: string
          created_at?: string
          discount_reason?: string | null
          event_id?: string
          full_name?: string
          id?: string
          paid_price?: number
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
        ]
      }
      league_activities: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          league_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          league_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          league_id?: string
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
      league_attendance: {
        Row: {
          activity: string
          activity_date: string
          created_at: string
          id: string
          league_id: string
          present: boolean
          user_id: string
        }
        Insert: {
          activity: string
          activity_date: string
          created_at?: string
          id?: string
          league_id: string
          present?: boolean
          user_id: string
        }
        Update: {
          activity?: string
          activity_date?: string
          created_at?: string
          id?: string
          league_id?: string
          present?: boolean
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
      league_events: {
        Row: {
          accepting_registrations: boolean
          created_at: string
          description: string | null
          event_date: string | null
          id: string
          image_url: string | null
          league_id: string
          max_seats: number | null
          partner_league_ids: string[]
          price_ligante: number
          price_partner: number
          price_visitor: number
          published: boolean
          registration_link: string | null
          schedule: string | null
          title: string
        }
        Insert: {
          accepting_registrations?: boolean
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          league_id: string
          max_seats?: number | null
          partner_league_ids?: string[]
          price_ligante?: number
          price_partner?: number
          price_visitor?: number
          published?: boolean
          registration_link?: string | null
          schedule?: string | null
          title: string
        }
        Update: {
          accepting_registrations?: boolean
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          league_id?: string
          max_seats?: number | null
          partner_league_ids?: string[]
          price_ligante?: number
          price_partner?: number
          price_visitor?: number
          published?: boolean
          registration_link?: string | null
          schedule?: string | null
          title?: string
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
      league_memberships: {
        Row: {
          created_at: string
          id: string
          league_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
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
          published: boolean
          starts_at: string
          title: string
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
          published?: boolean
          starts_at: string
          title: string
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
          published?: boolean
          starts_at?: string
          title?: string
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
      league_selection_quotas: {
        Row: {
          created_at: string
          id: string
          league_id: string
          seats: number
          semester: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          seats?: number
          semester: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
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
          semester?: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          president_id: string | null
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
          president_id?: string | null
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
          president_id?: string | null
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
      minicourse_registrations: {
        Row: {
          created_at: string
          event_registration_id: string
          id: string
          minicourse_id: string
          paid_price: number
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_registration_id: string
          id?: string
          minicourse_id: string
          paid_price?: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_registration_id?: string
          id?: string
          minicourse_id?: string
          paid_price?: number
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
            foreignKeyName: "minicourse_registrations_minicourse_id_fkey"
            columns: ["minicourse_id"]
            isOneToOne: false
            referencedRelation: "league_minicourses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_camed_president: { Args: { _user_id: string }; Returns: boolean }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin_master"
        | "presidente"
        | "diretor"
        | "ligante"
        | "visitante"
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
      ],
    },
  },
} as const
