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
      autism_centers: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["autism_center_category"]
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          opening_hours: string | null
          phone: string | null
          region: string | null
          services_offered: string[]
          updated_at: string
          verification_status: Database["public"]["Enums"]["autism_center_verification"]
          website: string | null
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["autism_center_category"]
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          opening_hours?: string | null
          phone?: string | null
          region?: string | null
          services_offered?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["autism_center_verification"]
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["autism_center_category"]
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          opening_hours?: string | null
          phone?: string | null
          region?: string | null
          services_offered?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["autism_center_verification"]
          website?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          body_en: string[]
          body_fr: string[]
          category: string
          created_at: string
          created_by: string | null
          excerpt_en: string
          excerpt_fr: string | null
          id: string
          published: boolean
          read_minutes: number
          slug: string
          title_en: string
          title_fr: string | null
          updated_at: string
        }
        Insert: {
          body_en?: string[]
          body_fr?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          excerpt_en?: string
          excerpt_fr?: string | null
          id?: string
          published?: boolean
          read_minutes?: number
          slug: string
          title_en: string
          title_fr?: string | null
          updated_at?: string
        }
        Update: {
          body_en?: string[]
          body_fr?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          excerpt_en?: string
          excerpt_fr?: string | null
          id?: string
          published?: boolean
          read_minutes?: number
          slug?: string
          title_en?: string
          title_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          avatar_url: string | null
          created_at: string
          dob: string | null
          id: string
          name: string
          notes: string | null
          preferred_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name: string
          notes?: string | null
          preferred_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name?: string
          notes?: string | null
          preferred_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      child_milestones: {
        Row: {
          child_id: string
          created_at: string
          done: boolean
          id: string
          journey_slug: string
          milestone_key: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          done?: boolean
          id?: string
          journey_slug: string
          milestone_key: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          done?: boolean
          id?: string
          journey_slug?: string
          milestone_key?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      caregiver_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      growth_journeys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          intro_en: string
          intro_fr: string | null
          milestones: Json
          published: boolean
          slug: string
          sort_order: number
          title_en: string
          title_fr: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro_en?: string
          intro_fr?: string | null
          milestones?: Json
          published?: boolean
          slug: string
          sort_order?: number
          title_en: string
          title_fr?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro_en?: string
          intro_fr?: string | null
          milestones?: Json
          published?: boolean
          slug?: string
          sort_order?: number
          title_en?: string
          title_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      learning_subjects: {
        Row: {
          blurb_en: string
          blurb_fr: string | null
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          slug: string
          sort_order: number
          title_en: string
          title_fr: string | null
          topics: Json
          updated_at: string
        }
        Insert: {
          blurb_en?: string
          blurb_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          title_en: string
          title_fr?: string | null
          topics?: Json
          updated_at?: string
        }
        Update: {
          blurb_en?: string
          blurb_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title_en?: string
          title_fr?: string | null
          topics?: Json
          updated_at?: string
        }
        Relationships: []
      }
      expression_cards: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string | null
          key: string
          label_en: string
          label_fr: string | null
          published: boolean
          sort_order: number
          swatch: string | null
          tone: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          key: string
          label_en: string
          label_fr?: string | null
          published?: boolean
          sort_order?: number
          swatch?: string | null
          tone?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          key?: string
          label_en?: string
          label_fr?: string | null
          published?: boolean
          sort_order?: number
          swatch?: string | null
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_chats: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          lang: string
          prompt: string
          rated_at: string | null
          rating: string | null
          response: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          lang?: string
          prompt: string
          rated_at?: string | null
          rating?: string | null
          response: string
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          lang?: string
          prompt?: string
          rated_at?: string | null
          rating?: string | null
          response?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lesson_notes: {
        Row: {
          blurb_en: string
          blurb_fr: string | null
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          slug: string
          subject: string
          title_en: string
          title_fr: string | null
          topics: Json
          updated_at: string
        }
        Insert: {
          blurb_en?: string
          blurb_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          slug: string
          subject?: string
          title_en: string
          title_fr?: string | null
          topics?: Json
          updated_at?: string
        }
        Update: {
          blurb_en?: string
          blurb_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          slug?: string
          subject?: string
          title_en?: string
          title_fr?: string | null
          topics?: Json
          updated_at?: string
        }
        Relationships: []
      }
      mood_entries: {
        Row: {
          child_id: string | null
          created_at: string
          entry_date: string
          id: string
          mood: string
          note: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          mood: string
          note?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          note: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          category: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          note?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          note?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_child_id: string | null
          avatar_url: string | null
          calm: boolean
          caregiver_name: string | null
          caregiver_objectives: string[] | null
          caregiver_role: string | null
          child_name: string | null
          created_at: string
          email: string | null
          id: string
          lang: string
          onboarded: boolean
          preferred_name: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          active_child_id?: string | null
          avatar_url?: string | null
          calm?: boolean
          caregiver_name?: string | null
          caregiver_objectives?: string[] | null
          caregiver_role?: string | null
          child_name?: string | null
          created_at?: string
          email?: string | null
          id: string
          lang?: string
          onboarded?: boolean
          preferred_name?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          active_child_id?: string | null
          avatar_url?: string | null
          calm?: boolean
          caregiver_name?: string | null
          caregiver_objectives?: string[] | null
          caregiver_role?: string | null
          child_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lang?: string
          onboarded?: boolean
          preferred_name?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_audits: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          target_chat_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          target_chat_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target_chat_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          time_of_day: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          time_of_day?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          time_of_day?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          answers: Json
          child_id: string | null
          created_at: string
          details: Json
          headline: string | null
          id: string
          score_band: string
          score_max: number
          score_value: number
          slug: string
          summary: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          child_id?: string | null
          created_at?: string
          details?: Json
          headline?: string | null
          id?: string
          score_band?: string
          score_max?: number
          score_value?: number
          slug: string
          summary?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          child_id?: string | null
          created_at?: string
          details?: Json
          headline?: string | null
          id?: string
          score_band?: string
          score_max?: number
          score_value?: number
          slug?: string
          summary?: string | null
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      autism_center_category:
        | "special_school"
        | "inclusive_school"
        | "therapy_center"
        | "ngo"
        | "psychologist"
        | "speech_therapist"
        | "occupational_therapist"
        | "pediatrician"
        | "support_group"
      autism_center_verification: "pending" | "verified" | "rejected"
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
      app_role: ["admin", "user", "moderator"],
      autism_center_category: [
        "special_school",
        "inclusive_school",
        "therapy_center",
        "ngo",
        "psychologist",
        "speech_therapist",
        "occupational_therapist",
        "pediatrician",
        "support_group",
      ],
      autism_center_verification: ["pending", "verified", "rejected"],
    },
  },
} as const
