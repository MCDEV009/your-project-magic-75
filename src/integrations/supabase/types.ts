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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          condition_a_ru: string | null
          condition_a_uz: string | null
          condition_b_ru: string | null
          condition_b_uz: string | null
          correct_option: number
          created_at: string
          id: string
          image_url: string | null
          max_points: number | null
          model_answer_en: string | null
          model_answer_ru: string | null
          model_answer_uz: string | null
          options: Json
          order_index: number
          points: number
          points_a: number | null
          points_b: number | null
          question_text_en: string | null
          question_text_ru: string | null
          question_text_uz: string
          question_type: Database["public"]["Enums"]["question_type"]
          rubric_ru: string | null
          rubric_uz: string | null
          test_id: string
        }
        Insert: {
          condition_a_ru?: string | null
          condition_a_uz?: string | null
          condition_b_ru?: string | null
          condition_b_uz?: string | null
          correct_option: number
          created_at?: string
          id?: string
          image_url?: string | null
          max_points?: number | null
          model_answer_en?: string | null
          model_answer_ru?: string | null
          model_answer_uz?: string | null
          options?: Json
          order_index?: number
          points?: number
          points_a?: number | null
          points_b?: number | null
          question_text_en?: string | null
          question_text_ru?: string | null
          question_text_uz: string
          question_type?: Database["public"]["Enums"]["question_type"]
          rubric_ru?: string | null
          rubric_uz?: string | null
          test_id: string
        }
        Update: {
          condition_a_ru?: string | null
          condition_a_uz?: string | null
          condition_b_ru?: string | null
          condition_b_uz?: string | null
          correct_option?: number
          created_at?: string
          id?: string
          image_url?: string | null
          max_points?: number | null
          model_answer_en?: string | null
          model_answer_ru?: string | null
          model_answer_uz?: string | null
          options?: Json
          order_index?: number
          points?: number
          points_a?: number | null
          points_b?: number | null
          question_text_en?: string | null
          question_text_ru?: string | null
          question_text_uz?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          rubric_ru?: string | null
          rubric_uz?: string | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          enabled: boolean | null
          id: string
          name_en: string | null
          name_qq: string | null
          name_ru: string | null
          name_uz: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          id?: string
          name_en?: string | null
          name_qq?: string | null
          name_ru?: string | null
          name_uz: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          id?: string
          name_en?: string | null
          name_qq?: string | null
          name_ru?: string | null
          name_uz?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          ai_evaluation: Json | null
          answers: Json
          correct_answers: number | null
          evaluation_status: string | null
          finished_at: string | null
          id: string
          mcq_score: number | null
          participant_id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          test_id: string
          total_questions: number | null
          written_answers: Json | null
          written_score: number | null
        }
        Insert: {
          ai_evaluation?: Json | null
          answers?: Json
          correct_answers?: number | null
          evaluation_status?: string | null
          finished_at?: string | null
          id?: string
          mcq_score?: number | null
          participant_id: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          test_id: string
          total_questions?: number | null
          written_answers?: Json | null
          written_score?: number | null
        }
        Update: {
          ai_evaluation?: Json | null
          answers?: Json
          correct_answers?: number | null
          evaluation_status?: string | null
          finished_at?: string | null
          id?: string
          mcq_score?: number | null
          participant_id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          test_id?: string
          total_questions?: number | null
          written_answers?: Json | null
          written_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "test_participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_participants: {
        Row: {
          created_at: string
          full_name: string
          id: string
          participant_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          participant_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          participant_id?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          allow_retry: boolean
          created_at: string
          created_by: string | null
          description_uz: string | null
          duration_minutes: number
          id: string
          negative_marking: boolean
          randomize_options: boolean
          randomize_questions: boolean
          scheduled_start: string | null
          subject_id: string | null
          test_code: string | null
          test_format: string | null
          title_en: string | null
          title_ru: string | null
          title_uz: string
          updated_at: string
          visibility: Database["public"]["Enums"]["test_visibility"]
        }
        Insert: {
          allow_retry?: boolean
          created_at?: string
          created_by?: string | null
          description_uz?: string | null
          duration_minutes?: number
          id?: string
          negative_marking?: boolean
          randomize_options?: boolean
          randomize_questions?: boolean
          scheduled_start?: string | null
          subject_id?: string | null
          test_code?: string | null
          test_format?: string | null
          title_en?: string | null
          title_ru?: string | null
          title_uz: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["test_visibility"]
        }
        Update: {
          allow_retry?: boolean
          created_at?: string
          created_by?: string | null
          description_uz?: string | null
          duration_minutes?: number
          id?: string
          negative_marking?: boolean
          randomize_options?: boolean
          randomize_questions?: boolean
          scheduled_start?: string | null
          subject_id?: string | null
          test_code?: string | null
          test_format?: string | null
          title_en?: string | null
          title_ru?: string | null
          title_uz?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["test_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "tests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      generate_participant_id: { Args: never; Returns: string }
      generate_test_code: { Args: never; Returns: string }
      get_public_questions: {
        Args: { p_test_id: string }
        Returns: {
          condition_a_ru: string
          condition_a_uz: string
          condition_b_ru: string
          condition_b_uz: string
          created_at: string
          id: string
          image_url: string
          max_points: number
          options: Json
          order_index: number
          points: number
          question_text_en: string
          question_text_ru: string
          question_text_uz: string
          question_type: Database["public"]["Enums"]["question_type"]
          test_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      attempt_status: "in_progress" | "finished"
      question_type: "single_choice" | "written"
      test_visibility: "public" | "private"
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
      app_role: ["admin", "user"],
      attempt_status: ["in_progress", "finished"],
      question_type: ["single_choice", "written"],
      test_visibility: ["public", "private"],
    },
  },
} as const
