/**
 * Hand-written types mirroring the Supabase schema (supabase/schema.v1.sql + migrations 002-011).
 * Phase 2 added the V3 columns that exist in the database (items.moderation_*, profiles.account_status
 * and friends) and the `inactive` listing status. Phase 4 added items.rent_unit / rent_max_units (011),
 * contact_shares + its RPCs (010) and the reports insert. Tables/RPCs that no screen uses yet (categories,
 * audit_logs, staff_* and admin_* functions) are intentionally not typed until they are needed.
 * Regenerate with `npx supabase gen types typescript --project-id <ref>` if you prefer.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Category = 'books' | 'notes' | 'electronics' | 'stationary';
type ListingType = 'sell' | 'rent';
type ListingStatus = 'active' | 'sold' | 'rented' | 'inactive';
type ModerationStatus = 'approved' | 'pending' | 'hidden' | 'rejected';
type AccountStatus = 'active' | 'suspended' | 'banned';
type Role = 'student' | 'moderator' | 'admin';
type RentUnit = 'day' | 'week' | 'month';
type ContactShareStatus = 'requested' | 'approved' | 'declined' | 'revoked';
type ReportReason = 'scam' | 'prohibited_item' | 'misleading_information' | 'duplicate_listing' | 'harassment' | 'inappropriate_content' | 'other';
type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          role: Role;
          account_status: AccountStatus;
          suspended_until: string | null;
          suspension_reason: string | null;
          warning_count: number;
          last_warning_at: string | null;
          last_warning_reason: string | null;
          status_changed_at: string | null;
          status_changed_by: string | null;
        };
        Insert: { id: string; display_name: string; email: string; role?: Role };
        Update: { display_name?: string; email?: string; role?: Role };
        Relationships: [];
      };
      items: {
        Row: {
          id: number;
          seller_id: string | null;
          seller_name: string;
          title: string;
          description: string;
          category: Category;
          listing_type: ListingType;
          price: number;
          condition_label: string;
          image_url: string | null;
          campus_location: string;
          status: ListingStatus;
          created_at: string;
          moderation_status: ModerationStatus;
          moderation_reason: string | null;
          moderated_at: string | null;
          moderated_by: string | null;
          rent_unit: RentUnit | null;
          rent_max_units: number | null;
        };
        Insert: {
          seller_id?: string | null;
          seller_name?: string;
          title: string;
          description?: string;
          category: Category;
          listing_type: ListingType;
          price: number;
          condition_label?: string;
          image_url?: string | null;
          campus_location?: string;
          status?: ListingStatus;
          rent_unit?: RentUnit | null;
          rent_max_units?: number | null;
        };
        Update: {
          title?: string;
          description?: string;
          category?: Category;
          listing_type?: ListingType;
          price?: number;
          condition_label?: string;
          image_url?: string | null;
          campus_location?: string;
          status?: ListingStatus;
          rent_unit?: RentUnit | null;
          rent_max_units?: number | null;
        };
        Relationships: [];
      };
      item_private: {
        Row: { item_id: number; contact_email: string; contact_phone: string };
        Insert: { item_id: number; contact_email?: string; contact_phone?: string };
        Update: { contact_email?: string; contact_phone?: string };
        Relationships: [];
      };
      wishlists: {
        Row: { user_id: string; item_id: number; created_at: string };
        Insert: { user_id?: string; item_id: number };
        Update: never;
        Relationships: [
          { foreignKeyName: 'wishlists_item_id_fkey'; columns: ['item_id']; isOneToOne: false; referencedRelation: 'items'; referencedColumns: ['id'] },
        ];
      };
      conversations: {
        Row: { id: number; item_id: number; buyer_id: string; seller_id: string; buyer_name: string; created_at: string };
        Insert: { item_id: number; buyer_id?: string; seller_id?: string; buyer_name?: string };
        Update: never;
        Relationships: [
          { foreignKeyName: 'conversations_item_id_fkey'; columns: ['item_id']; isOneToOne: false; referencedRelation: 'items'; referencedColumns: ['id'] },
        ];
      };
      messages: {
        Row: { id: number; conversation_id: number; sender_id: string; body: string; created_at: string };
        Insert: { conversation_id: number; sender_id?: string; body: string };
        Update: never;
        Relationships: [];
      };
      contact_shares: {
        Row: {
          conversation_id: number;
          item_id: number;
          buyer_id: string;
          seller_id: string;
          status: ContactShareStatus;
          requested_at: string;
          decided_at: string | null;
        };
        Insert: never; // written only by the request_contact / respond_contact_request / revoke_contact_share RPCs
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: {
          id: number;
          reporter_id: string | null;
          reported_user_id: string | null;
          listing_id: number | null;
          reason: ReportReason;
          description: string;
          status: ReportStatus;
          created_at: string;
        };
        // reporter, status and the reported user of a listing report are set by a database trigger, not by the client
        Insert: { listing_id?: number | null; reported_user_id?: string | null; reason: ReportReason; description?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_display_name_reserved: {
        Args: { p_name: string };
        Returns: boolean;
      };
      get_contact: {
        Args: { p_item_id: number };
        Returns: { name: string; email: string; phone: string }[];
      };
      request_contact: { Args: { p_conversation_id: number }; Returns: string };
      respond_contact_request: { Args: { p_conversation_id: number; p_approve: boolean }; Returns: string };
      revoke_contact_share: { Args: { p_conversation_id: number }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
