/**
 * Hand-written Database types for the Supabase tables we own.
 *
 * Once the schema settles, replace this file with output of:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          calibration: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          calibration?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          exercise_type: string;
          started_at: string;
          ended_at: string | null;
          total_reps: number;
          avg_form_score: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_type: string;
          started_at?: string;
          ended_at?: string | null;
          total_reps?: number;
          avg_form_score?: number | null;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
        Relationships: [];
      };
      sets: {
        Row: {
          id: string;
          session_id: string;
          set_number: number;
          reps: number;
          avg_form_score: number | null;
          issues_detected: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          set_number: number;
          reps?: number;
          avg_form_score?: number | null;
          issues_detected?: string[];
        };
        Update: Partial<Database['public']['Tables']['sets']['Insert']>;
        Relationships: [];
      };
      reps: {
        Row: {
          id: string;
          set_id: string;
          rep_number: number;
          form_score: number | null;
          issues: string[];
          duration_ms: number | null;
          keypoint_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          rep_number: number;
          form_score?: number | null;
          issues?: string[];
          duration_ms?: number | null;
          keypoint_snapshot?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['reps']['Insert']>;
        Relationships: [];
      };
      session_muscle_load: {
        Row: {
          id: string;
          session_id: string;
          muscle_group: string;
          total_activation_score: number;
          peak_activation: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          muscle_group: string;
          total_activation_score?: number;
          peak_activation?: number;
        };
        Update: Partial<Database['public']['Tables']['session_muscle_load']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
