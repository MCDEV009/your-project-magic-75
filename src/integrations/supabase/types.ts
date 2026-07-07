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
      admin_audit_log: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          required_roles: string[] | null
          route: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          required_roles?: string[] | null
          route: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          required_roles?: string[] | null
          route?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_analysis_history: {
        Row: {
          analysis_result: Json
          analysis_type: string
          attempt_id: string | null
          created_at: string
          id: string
          model_used: string | null
          participant_id: string | null
          test_id: string | null
        }
        Insert: {
          analysis_result?: Json
          analysis_type?: string
          attempt_id?: string | null
          created_at?: string
          id?: string
          model_used?: string | null
          participant_id?: string | null
          test_id?: string | null
        }
        Update: {
          analysis_result?: Json
          analysis_type?: string
          attempt_id?: string | null
          created_at?: string
          id?: string
          model_used?: string | null
          participant_id?: string | null
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_history_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_history_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      al_xorazmiy_chat_messages: {
        Row: {
          attempt_id: string | null
          content: string
          created_at: string
          id: string
          participant_id: string
          role: string
        }
        Insert: {
          attempt_id?: string | null
          content: string
          created_at?: string
          id?: string
          participant_id: string
          role: string
        }
        Update: {
          attempt_id?: string | null
          content?: string
          created_at?: string
          id?: string
          participant_id?: string
          role?: string
        }
        Relationships: []
      }
      plan_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          status: string
          test_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          status?: string
          test_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          status?: string
          test_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      question_analyses: {
        Row: {
          ai_feedback: Json | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          max_points: number | null
          p_correct: number | null
          points_earned: number | null
          question_id: string
          question_type: string
          rasch_points: number | null
          user_answer: Json | null
        }
        Insert: {
          ai_feedback?: Json | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          max_points?: number | null
          p_correct?: number | null
          points_earned?: number | null
          question_id: string
          question_type: string
          rasch_points?: number | null
          user_answer?: Json | null
        }
        Update: {
          ai_feedback?: Json | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          max_points?: number | null
          p_correct?: number | null
          points_earned?: number | null
          question_id?: string
          question_type?: string
          rasch_points?: number | null
          user_answer?: Json | null
        }
        Relationships: []
      }
      question_analytics: {
        Row: {
          avg_time_seconds: number | null
          correct_count: number
          difficulty_score: number | null
          discrimination_index: number | null
          id: string
          incorrect_count: number
          question_id: string
          skipped_count: number
          test_id: string
          total_attempts: number
          updated_at: string
        }
        Insert: {
          avg_time_seconds?: number | null
          correct_count?: number
          difficulty_score?: number | null
          discrimination_index?: number | null
          id?: string
          incorrect_count?: number
          question_id: string
          skipped_count?: number
          test_id: string
          total_attempts?: number
          updated_at?: string
        }
        Update: {
          avg_time_seconds?: number | null
          correct_count?: number
          difficulty_score?: number | null
          discrimination_index?: number | null
          id?: string
          incorrect_count?: number
          question_id?: string
          skipped_count?: number
          test_id?: string
          total_attempts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_analytics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_analytics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_analytics_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
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
      rasch_settings: {
        Row: {
          id: boolean
          p_max: number
          p_min: number
          prior_mean: number
          prior_strength: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          p_max?: number
          p_min?: number
          prior_mean?: number
          prior_strength?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          p_max?: number
          p_min?: number
          prior_mean?: number
          prior_strength?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      student_rankings: {
        Row: {
          avg_score: number
          best_score: number
          full_name: string
          grade: string | null
          id: string
          last_test_at: string | null
          participant_id: string
          rank_position: number | null
          total_score: number
          total_tests: number
          updated_at: string
        }
        Insert: {
          avg_score?: number
          best_score?: number
          full_name: string
          grade?: string | null
          id?: string
          last_test_at?: string | null
          participant_id: string
          rank_position?: number | null
          total_score?: number
          total_tests?: number
          updated_at?: string
        }
        Update: {
          avg_score?: number
          best_score?: number
          full_name?: string
          grade?: string | null
          id?: string
          last_test_at?: string | null
          participant_id?: string
          rank_position?: number | null
          total_score?: number
          total_tests?: number
          updated_at?: string
        }
        Relationships: []
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
      sunday_free_redemptions: {
        Row: {
          id: string
          redeemed_at: string
          test_id: string
          user_id: string
          weekday_tashkent: number
        }
        Insert: {
          id?: string
          redeemed_at?: string
          test_id: string
          user_id: string
          weekday_tashkent: number
        }
        Update: {
          id?: string
          redeemed_at?: string
          test_id?: string
          user_id?: string
          weekday_tashkent?: number
        }
        Relationships: [
          {
            foreignKeyName: "sunday_free_redemptions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          participant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          participant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      test_pricing: {
        Row: {
          is_free: boolean
          price_uzs: number
          test_id: string
          updated_at: string
        }
        Insert: {
          is_free?: boolean
          price_uzs?: number
          test_id: string
          updated_at?: string
        }
        Update: {
          is_free?: boolean
          price_uzs?: number
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_pricing_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: true
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          test_id: string
          txn_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          test_id: string
          txn_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          test_id?: string
          txn_id?: string | null
          user_id?: string
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
          is_sunday_free: boolean
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
          is_sunday_free?: boolean
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
          is_sunday_free?: boolean
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
      usage_counters: {
        Row: {
          ai_requests: number
          id: string
          image_uploads: number
          mocks_taken: number
          period_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_requests?: number
          id?: string
          image_uploads?: number
          mocks_taken?: number
          period_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_requests?: number
          id?: string
          image_uploads?: number
          mocks_taken?: number
          period_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["wallet_txn_status"]
          type: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["wallet_txn_status"]
          type?: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["wallet_provider"]
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["wallet_txn_status"]
          type?: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      questions_public: {
        Row: {
          condition_a_ru: string | null
          condition_a_uz: string | null
          condition_b_ru: string | null
          condition_b_uz: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          max_points: number | null
          options: Json | null
          order_index: number | null
          points: number | null
          question_text_en: string | null
          question_text_ru: string | null
          question_text_uz: string | null
          question_type: Database["public"]["Enums"]["question_type"] | null
          test_id: string | null
        }
        Insert: {
          condition_a_ru?: string | null
          condition_a_uz?: string | null
          condition_b_ru?: string | null
          condition_b_uz?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          max_points?: number | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text_en?: string | null
          question_text_ru?: string | null
          question_text_uz?: string | null
          question_type?: Database["public"]["Enums"]["question_type"] | null
          test_id?: string | null
        }
        Update: {
          condition_a_ru?: string | null
          condition_a_uz?: string | null
          condition_b_ru?: string | null
          condition_b_uz?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          max_points?: number | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text_en?: string | null
          question_text_ru?: string | null
          question_text_uz?: string | null
          question_type?: Database["public"]["Enums"]["question_type"] | null
          test_id?: string | null
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
    }
    Functions: {
      admin_test_stats: {
        Args: never
        Returns: {
          attempts: number
          avg_score: number
          is_sunday_free: boolean
          sunday_redemptions: number
          test_id: string
          title: string
          unique_participants: number
        }[]
      }
      cancel_wallet_transaction: {
        Args: { _reason?: string; _txn_id: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["wallet_txn_status"]
          type: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_wallet_for_transaction: {
        Args: { _provider_txn_id?: string; _txn_id: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["wallet_txn_status"]
          type: Database["public"]["Enums"]["wallet_txn_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_profile: {
        Args: { _username?: string }
        Returns: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_wallet: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_participant_id: { Args: never; Returns: string }
      generate_test_code: { Args: never; Returns: string }
      get_attempt_status: {
        Args: { p_attempt_id: string }
        Returns: {
          ai_evaluation: Json
          evaluation_status: string
          score: number
          written_score: number
        }[]
      }
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
      get_test_attempt_by_id: {
        Args: { p_attempt_id: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "test_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage_counter: {
        Args: { _field: string }
        Returns: {
          ai_requests: number
          id: string
          image_uploads: number
          mocks_taken: number
          period_month: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "usage_counters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_known_participant: {
        Args: { _participant_id: string }
        Returns: boolean
      }
      link_my_participants: { Args: never; Returns: number }
      log_admin_audit: {
        Args: {
          _granted: boolean
          _required_roles: string[]
          _route: string
          _user_agent?: string
        }
        Returns: undefined
      }
      lookup_email_by_username: { Args: { _username: string }; Returns: string }
      purchase_test_with_wallet: {
        Args: { _test_id: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          test_id: string
          txn_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "test_purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_test_attempt: {
        Args: {
          _answers: Json
          _attempt_id: string
          _finish?: boolean
          _participant_id: string
          _written_answers: Json
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "test_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_has_purchased_test: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "editor" | "analyst"
      attempt_status: "in_progress" | "finished"
      question_type: "single_choice" | "written"
      subscription_plan: "free" | "pro" | "premium"
      test_visibility: "public" | "private" | "paid"
      wallet_provider: "payme" | "click" | "manual"
      wallet_txn_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
      wallet_txn_type: "topup" | "spend" | "refund" | "adjustment"
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
      app_role: ["admin", "user", "super_admin", "editor", "analyst"],
      attempt_status: ["in_progress", "finished"],
      question_type: ["single_choice", "written"],
      subscription_plan: ["free", "pro", "premium"],
      test_visibility: ["public", "private", "paid"],
      wallet_provider: ["payme", "click", "manual"],
      wallet_txn_status: ["pending", "paid", "failed", "cancelled", "refunded"],
      wallet_txn_type: ["topup", "spend", "refund", "adjustment"],
    },
  },
} as const
