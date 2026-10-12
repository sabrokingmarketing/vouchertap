export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      breakfast_meetings: {
        Row: {
          created_at: string;
          id: string;
          is_published: boolean;
          meeting_date: string;
          speaker_bio: string | null;
          speaker_image_url: string | null;
          speaker_name: string | null;
          speaker_title: string | null;
          topic: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          meeting_date: string;
          speaker_bio?: string | null;
          speaker_image_url?: string | null;
          speaker_name?: string | null;
          speaker_title?: string | null;
          topic?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          meeting_date?: string;
          speaker_bio?: string | null;
          speaker_image_url?: string | null;
          speaker_name?: string | null;
          speaker_title?: string | null;
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_info: {
        Row: {
          contacts: Json;
          general_email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          contacts?: Json;
          general_email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          contacts?: Json;
          general_email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_registrations: {
        Row: {
          attendees: number;
          created_at: string;
          email: string;
          event_id: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attendees: number;
          created_at?: string;
          email: string;
          event_id: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          attendees?: number;
          created_at?: string;
          email?: string;
          event_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          description: string | null;
          ends_at: string | null;
          form_url: string | null;
          video_url: string | null;
          id: string;
          image_url: string | null;
          is_published: boolean;
          location: string | null;
          registration_enabled: boolean;
          starts_at: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          form_url?: string | null;
          video_url?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          location?: string | null;
          registration_enabled?: boolean;
          starts_at: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          form_url?: string | null;
          video_url?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          location?: string | null;
          registration_enabled?: boolean;
          starts_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          business_email: string | null;
          business_logo_url: string | null;
          business_name: string | null;
          business_website: string | null;
          created_at: string;
          disabled_at: string | null;
          display_name: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          onboarding_completed_at: string | null;
          phone: string | null;
          slk_code: string | null;
          updated_at: string;
          work_phone: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          business_email?: string | null;
          business_logo_url?: string | null;
          business_name?: string | null;
          business_website?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          onboarding_completed_at?: string | null;
          phone?: string | null;
          slk_code?: string | null;
          updated_at?: string;
          work_phone?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          business_email?: string | null;
          business_logo_url?: string | null;
          business_name?: string | null;
          business_website?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          onboarding_completed_at?: string | null;
          phone?: string | null;
          slk_code?: string | null;
          updated_at?: string;
          work_phone?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          notify_events: boolean;
          notify_vouchers: boolean;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          notify_events?: boolean;
          notify_vouchers?: boolean;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          notify_events?: boolean;
          notify_vouchers?: boolean;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      shop_products: {
        Row: {
          category: string;
          colors: string[];
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          images: string[];
          is_active: boolean;
          name: string;
          price: number;
          sizes: string[];
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string;
          colors?: string[];
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          images?: string[];
          is_active?: boolean;
          name: string;
          price?: number;
          sizes?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          colors?: string[];
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          images?: string[];
          is_active?: boolean;
          name?: string;
          price?: number;
          sizes?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      voucher_claims: {
        Row: {
          claimed_at: string;
          cycle_key: string;
          expires_at: string;
          id: string;
          redeemed_at: string | null;
          user_id: string;
          voucher_id: string;
        };
        Insert: {
          claimed_at?: string;
          cycle_key?: string;
          expires_at: string;
          id?: string;
          redeemed_at?: string | null;
          user_id: string;
          voucher_id: string;
        };
        Update: {
          claimed_at?: string;
          cycle_key?: string;
          expires_at?: string;
          id?: string;
          redeemed_at?: string | null;
          user_id?: string;
          voucher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voucher_claims_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          },
        ];
      };
      vouchers: {
        Row: {
          available_from: string;
          available_until: string | null;
          business_address: string | null;
          business_logo_url: string | null;
          business_name: string | null;
          business_phone: string | null;
          claim_window_hours: number;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          is_recurring: boolean;
          terms: string | null;
          title: string;
          value_text: string | null;
        };
        Insert: {
          available_from?: string;
          available_until?: string | null;
          business_address?: string | null;
          business_logo_url?: string | null;
          business_name?: string | null;
          business_phone?: string | null;
          claim_window_hours?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_recurring?: boolean;
          terms?: string | null;
          title: string;
          value_text?: string | null;
        };
        Update: {
          available_from?: string;
          available_until?: string | null;
          business_address?: string | null;
          business_logo_url?: string | null;
          business_name?: string | null;
          business_phone?: string | null;
          claim_window_hours?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_recurring?: boolean;
          terms?: string | null;
          title?: string;
          value_text?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_voucher: {
        Args: { _voucher_id: string };
        Returns: {
          claimed_at: string;
          cycle_key: string;
          expires_at: string;
          id: string;
          redeemed_at: string | null;
          user_id: string;
          voucher_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "voucher_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_member: { Args: { _user_id: string }; Returns: undefined };
      get_broadcast_subscriptions: {
        Args: { _category: string };
        Returns: {
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        }[];
      };
      remove_push_endpoints: { Args: { _endpoints: string[] }; Returns: number };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      redeem_voucher_claim: {
        Args: { _claim_id: string };
        Returns: {
          claimed_at: string;
          cycle_key: string;
          expires_at: string;
          id: string;
          redeemed_at: string | null;
          user_id: string;
          voucher_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "voucher_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_member_disabled: {
        Args: { _disabled: boolean; _user_id: string };
        Returns: undefined;
      };
      set_user_role: {
        Args: {
          _grant: boolean;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const;
