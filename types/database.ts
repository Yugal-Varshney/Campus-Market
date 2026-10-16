/**
 * Hand-written types mirroring the Supabase schema (supabase/schema.v1.sql + migrations 002-011).
 * Phase 5 added the read-only moderation tables and the staff_* / admin_* RPC signatures used by the staff screens.
 * Phase 2 added the V3 columns that exist in the database (items.moderation_*, profiles.account_status
 * and friends) and the `inactive` listing status. Phase 4 added items.rent_unit / rent_max_units (011),
 * contact_shares + its RPCs (010) and the reports insert. Tables/RPCs that no screen uses yet (categories,
 * audit_logs, staff_* and admin_* functions) are intentionally not typed until they are needed.
 * Regenerate with `npx supabase gen types typescript --project-id <ref>` if you prefer.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Category = string; // a categories.slug (migration 008 made categories a table; admins can add more)
type ListingType = 'sell' | 'rent';
type ListingStatus = 'active' | 'sold' | 'rented' | 'inactive';
type ModerationStatus = 'approved' | 'pending' | 'hidden' | 'rejected';
type AccountStatus = 'active' | 'suspended' | 'banned';
type Role = 'student' | 'moderator' | 'admin';
type RentUnit = 'day' | 'week' | 'month';
type ContactShareStatus = 'requested' | 'approved' | 'declined' | 'revoked';
type ReportReason = 'scam' | 'prohibited_item' | 'misleading_information' | 'duplicate_listing' | 'harassment' | 'inappropriate_content' | 'other';
type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

/** One row of staff_get_user() / admin_search_users(); email is only filled in for admins. */
type StaffUserRow = {
  id: string;
  display_name: string;
  role: Role;
  account_status: AccountStatus;
  effective_status: AccountStatus;
  suspended_until: string | null;
  suspension_reason?: string | null;
  warning_count: number;
  email: string | null;
};

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
      conversation_reads: {
        Row: { conversation_id: number; user_id: string; last_read_at: string };
        Insert: never; // written only by the mark_conversation_read RPC
        Update: never;
        Relationships: [];
      };
      saved_searches: {
        Row: { id: number; user_id: string; query: string; label: string; notify: boolean; last_checked_at: string; created_at: string };
        Insert: { user_id?: string; query: string; label: string; notify?: boolean };
        Update: { notify?: boolean; last_checked_at?: string };
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
          reviewed_by: string | null;
          reviewed_at: string | null;
          target_snapshot: { type?: string; listing_title?: string; reported_user_name?: string };
          created_at: string;
        };
        // reporter, status and the reported user of a listing report are set by a database trigger, not by the client
        Insert: { listing_id?: number | null; reported_user_id?: string | null; reason: ReportReason; description?: string };
        Update: never;
        Relationships: [];
      };
      moderation_actions: {
        Row: {
          id: number; created_at: string; actor_id: string; actor_role: string; action: string;
          target_user_id: string | null; listing_id: number | null; report_id: number | null; reason: string;
        };
        Insert: never; Update: never; Relationships: [];
      };
      categories: {
        Row: { id: number; name: string; slug: string; description: string; is_active: boolean; sort_order: number; created_at: string; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number; created_at: string; actor_id: string | null; actor_role: string; actor_name: string | null;
          action: string; category: string; target_type: string | null; target_id: string | null; reason: string | null; source: string;
        };
        Insert: never; Update: never; Relationships: [];
      };
      security_events: {
        Row: { id: number; created_at: string; user_id: string | null; event_type: string; severity: string; source: string };
        Insert: never; Update: never; Relationships: [];
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
      acting_role: { Args: Record<PropertyKey, never>; Returns: string };
      admin_create_category: { Args: { p_name: string; p_slug: string; p_description?: string }; Returns: number };
      admin_update_category: { Args: { p_id: number; p_name: string; p_description: string; p_sort_order: number }; Returns: number };
      admin_set_category_active: { Args: { p_id: number; p_active: boolean; p_reason: string }; Returns: number };
      staff_claim_report: { Args: { p_report_id: number }; Returns: number };
      staff_resolve_report: { Args: { p_report_id: number; p_reason: string }; Returns: number };
      staff_dismiss_report: { Args: { p_report_id: number; p_reason: string }; Returns: number };
      staff_hide_listing: { Args: { p_listing_id: number; p_reason: string; p_report_id?: number | null }; Returns: number };
      staff_restore_listing: { Args: { p_listing_id: number; p_reason: string; p_report_id?: number | null }; Returns: number };
      staff_warn_user: { Args: { p_user_id: string; p_reason: string; p_report_id?: number | null }; Returns: number };
      staff_suspend_user: { Args: { p_user_id: string; p_until: string | null; p_reason: string; p_report_id?: number | null }; Returns: number };
      staff_unsuspend_user: { Args: { p_user_id: string; p_reason: string }; Returns: number };
      admin_ban_user: { Args: { p_user_id: string; p_reason: string; p_report_id?: number | null }; Returns: number };
      admin_unban_user: { Args: { p_user_id: string; p_reason: string }; Returns: number };
      admin_set_role: { Args: { p_user_id: string; p_new_role: string; p_reason: string }; Returns: number };
      staff_get_user: { Args: { p_user_id: string }; Returns: StaffUserRow[] };
      admin_search_users: { Args: { p_query: string; p_limit?: number; p_offset?: number }; Returns: StaffUserRow[] };
      request_contact: { Args: { p_conversation_id: number }; Returns: string };
      respond_contact_request: { Args: { p_conversation_id: number; p_approve: boolean }; Returns: string };
      revoke_contact_share: { Args: { p_conversation_id: number }; Returns: undefined };
      admin_usage_summary: { Args: { p_days?: number }; Returns: Json };
      get_unread_count: { Args: Record<PropertyKey, never>; Returns: number };
      mark_conversation_read: { Args: { p_conversation_id: number }; Returns: undefined };
      get_trending_items: { Args: { p_days?: number; p_limit?: number }; Returns: { item_id: number; score: number }[] };
      get_popular_searches: { Args: { p_days?: number; p_min_users?: number; p_limit?: number }; Returns: { search_query: string; searchers: number }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
