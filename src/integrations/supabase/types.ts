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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          date: string
          doctor: string
          doctor_advice: string | null
          follow_up_tests: string | null
          id: string
          location: string
          notes: string | null
          prescriptions: string | null
          rating: number | null
          recording_url: string | null
          status: string
          symptoms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          doctor: string
          doctor_advice?: string | null
          follow_up_tests?: string | null
          id?: string
          location?: string
          notes?: string | null
          prescriptions?: string | null
          rating?: number | null
          recording_url?: string | null
          status?: string
          symptoms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          doctor?: string
          doctor_advice?: string | null
          follow_up_tests?: string | null
          id?: string
          location?: string
          notes?: string | null
          prescriptions?: string | null
          rating?: number | null
          recording_url?: string | null
          status?: string
          symptoms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          attachment_url: string | null
          category: string
          created_at: string
          date: string | null
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          category?: string
          created_at?: string
          date?: string | null
          description: string
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          category?: string
          created_at?: string
          date?: string | null
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          created_at: string
          dose: string
          end_date: string | null
          food_timing: string
          id: string
          med_type: string
          name: string
          schedule: string
          start_date: string | null
          stock: number
          taken: boolean
          taken_at: string | null
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string
          end_date?: string | null
          food_timing?: string
          id?: string
          med_type?: string
          name: string
          schedule?: string
          start_date?: string | null
          stock?: number
          taken?: boolean
          taken_at?: string | null
          time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string
          end_date?: string | null
          food_timing?: string
          id?: string
          med_type?: string
          name?: string
          schedule?: string
          start_date?: string | null
          stock?: number
          taken?: boolean
          taken_at?: string | null
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aadhaar_id: string | null
          age: string | null
          allergies: Json | null
          avatar_url: string | null
          blood_group: string | null
          chronic_conditions: Json | null
          created_at: string
          date_of_birth: string | null
          dnr: boolean | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          family_history: Json | null
          gender: string | null
          id: string
          jehovah_witness: boolean | null
          location: string | null
          name: string
          organ_donor: boolean | null
          past_surgeries: Json | null
          phone: string | null
          updated_at: string
          user_id: string
          vaccinations: Json | null
        }
        Insert: {
          aadhaar_id?: string | null
          age?: string | null
          allergies?: Json | null
          avatar_url?: string | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          created_at?: string
          date_of_birth?: string | null
          dnr?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_history?: Json | null
          gender?: string | null
          id?: string
          jehovah_witness?: boolean | null
          location?: string | null
          name?: string
          organ_donor?: boolean | null
          past_surgeries?: Json | null
          phone?: string | null
          updated_at?: string
          user_id: string
          vaccinations?: Json | null
        }
        Update: {
          aadhaar_id?: string | null
          age?: string | null
          allergies?: Json | null
          avatar_url?: string | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          created_at?: string
          date_of_birth?: string | null
          dnr?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_history?: Json | null
          gender?: string | null
          id?: string
          jehovah_witness?: boolean | null
          location?: string | null
          name?: string
          organ_donor?: boolean | null
          past_surgeries?: Json | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          vaccinations?: Json | null
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          advance_minutes: number
          created_at: string
          enabled: boolean
          frequency: number
          id: string
          reminder_type: string
          tone: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          advance_minutes?: number
          created_at?: string
          enabled?: boolean
          frequency?: number
          id?: string
          reminder_type?: string
          tone?: string
          updated_at?: string
          user_id: string
          volume?: number
        }
        Update: {
          advance_minutes?: number
          created_at?: string
          enabled?: boolean
          frequency?: number
          id?: string
          reminder_type?: string
          tone?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          date: string
          id: string
          original_text: string
          simplified_text: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          original_text?: string
          simplified_text?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          original_text?: string
          simplified_text?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          source: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          source?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          source?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
