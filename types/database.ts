export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          role: 'ADMIN' | 'MANAGER' | 'WORKSHOP_MANAGER' | 'TEAM_LEADER' | 'MAINTENANCE' | 'COORDINATION' | 'SALES' | 'HR'
          workspace: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          role?: 'ADMIN' | 'MANAGER' | 'WORKSHOP_MANAGER' | 'TEAM_LEADER' | 'MAINTENANCE' | 'COORDINATION' | 'SALES' | 'HR'
          workspace?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string
          role?: 'ADMIN' | 'MANAGER' | 'WORKSHOP_MANAGER' | 'TEAM_LEADER' | 'MAINTENANCE' | 'COORDINATION' | 'SALES' | 'HR'
          workspace?: string
          updated_at?: string
        }
      }
      data: {
        Row: {
          id: number
          PCODE: string
          INITIALDATE: string | null         // PostgreSQL DATE → "YYYY-MM-DD"
          CUSTOMER: string | null
          WORKSHOP: string | null
          DESCRIPTION: string | null
          QUANTITY: number | null
          DEADLINEDATE: string | null        // PostgreSQL TIMESTAMP WITHOUT TZ → "YYYY-MM-DDTHH:mm:ss"
          STATUS: string | null
          source_name: string | null
          source_last_seen_at: string | null
          source_deleted_at: string | null
          source_deleted_reason: string | null
        }
        Insert: {
          PCODE: string
          INITIALDATE?: string | null
          CUSTOMER?: string | null
          WORKSHOP?: string | null
          DESCRIPTION?: string | null
          QUANTITY?: number | null
          DEADLINEDATE?: string | null
          STATUS?: string | null
          source_name?: string | null
          source_last_seen_at?: string | null
          source_deleted_at?: string | null
          source_deleted_reason?: string | null
        }
        Update: {
          PCODE?: string
          INITIALDATE?: string | null
          CUSTOMER?: string | null
          WORKSHOP?: string | null
          DESCRIPTION?: string | null
          QUANTITY?: number | null
          DEADLINEDATE?: string | null
          STATUS?: string | null
          source_name?: string | null
          source_last_seen_at?: string | null
          source_deleted_at?: string | null
          source_deleted_reason?: string | null
        }
      }
      Norm: {
        Row: {
          id: number
          products: string
          norm: number | null
          nwforce: number | null
          workshop: string | null
          pspeed: number | null
          created_at: string
        }
        Insert: {
          products: string
          norm?: number | null
          nwforce?: number | null
          workshop?: string | null
          pspeed?: number | null
        }
        Update: {
          products?: string
          norm?: number | null
          nwforce?: number | null
          workshop?: string | null
          pspeed?: number | null
        }
      }
      Material: {
        Row: {
          id: number
          product: string
          material: string
          created_at: string
        }
        Insert: {
          product: string
          material: string
        }
        Update: {
          product?: string
          material?: string
        }
      }
      production_order_status: {
        Row: {
          pcode: string
          status: 'Chưa SX' | 'Đang SX' | 'Đã SX'
          produced_quantity: number
          quantity: number
          completion_pct: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          pcode: string
          status: 'Chưa SX' | 'Đang SX' | 'Đã SX'
          produced_quantity?: number
          quantity?: number
          completion_pct?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          status?: 'Chưa SX' | 'Đang SX' | 'Đã SX'
          produced_quantity?: number
          quantity?: number
          completion_pct?: number
          updated_by?: string | null
          updated_at?: string
        }
      }
      Production: {
        Row: {
          id: number
          pdate: string | null
          totalem: string | null
          pcode: string | null
          products: string | null
          material: string | null
          poutput: number | null
          eoutput: number | null
          routput: number | null
          workforce: number | null
          starttime: string | null
          endtime: string | null
          realnorm: number | null
          log: string | null
          save_status: 'draft' | 'closed'
          created_at: string
        }
        Insert: {
          pdate?: string | null
          totalem?: string | null
          pcode?: string | null
          products?: string | null
          material?: string | null
          poutput?: number | null
          eoutput?: number | null
          routput?: number | null
          workforce?: number | null
          starttime?: string | null
          endtime?: string | null
          realnorm?: number | null
          log?: string | null
          save_status?: 'draft' | 'closed'
        }
        Update: {
          pdate?: string | null
          totalem?: string | null
          pcode?: string | null
          products?: string | null
          material?: string | null
          poutput?: number | null
          eoutput?: number | null
          routput?: number | null
          workforce?: number | null
          starttime?: string | null
          endtime?: string | null
          realnorm?: number | null
          log?: string | null
          save_status?: 'draft' | 'closed'
        }
      }
      human_resource: {
        Row: {
          id: number
          name: string
          factory: 'DMC1' | 'DMC3' | 'DMC4' | 'DMC5' | 'PKT-SX' | 'DIEU-PHOI' | 'Khác' | null
          machine: string | null
          position: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          factory?: 'DMC1' | 'DMC3' | 'DMC4' | 'DMC5' | 'PKT-SX' | 'DIEU-PHOI' | 'Khác' | null
          machine?: string | null
          position?: string | null
          phone?: string | null
        }
        Update: {
          name?: string
          factory?: 'DMC1' | 'DMC3' | 'DMC4' | 'DMC5' | 'PKT-SX' | 'DIEU-PHOI' | 'Khác' | null
          machine?: string | null
          position?: string | null
          phone?: string | null
          updated_at?: string
        }
      }
      hr_daily: {
        Row: {
          id: string
          factory: string
          pdate: string
          totalem: number | null
          absent_ids: number[] | null
          transferred_ids: number[] | null
          transfer_records: Json
          auto_filled: boolean
          auto_filled_at: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          factory: string
          pdate: string
          totalem?: number | null
          absent_ids?: number[] | null
          transferred_ids?: number[] | null
          transfer_records?: Json
          auto_filled?: boolean
          auto_filled_at?: string | null
        }
        Update: {
          totalem?: number | null
          absent_ids?: number[] | null
          transferred_ids?: number[] | null
          transfer_records?: Json
          auto_filled?: boolean
          auto_filled_at?: string | null
          updated_at?: string | null
        }
      }
      overtime_requests: {
        Row: {
          id: string
          ot_date: string
          customer: string | null
          pcode: string | null
          workshop: string
          original_workshop: string | null
          ot_category: 'PRODUCTION' | 'DELIVERY' | 'INTERNAL'
          reasons: Json
          total_employees: number
          total_hours: number
          required_output: number | null
          planned_hours: number | null
          notes: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          requested_by: string | null
          approved_by: string | null
          approved_at: string | null
          approval_note: string | null
          approved_overtime_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ot_date: string
          customer?: string | null
          pcode?: string | null
          workshop: string
          original_workshop?: string | null
          ot_category: 'PRODUCTION' | 'DELIVERY' | 'INTERNAL'
          reasons?: Json
          total_employees?: number
          total_hours?: number
          required_output?: number | null
          planned_hours?: number | null
          notes?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected'
          requested_by: string | null
          approved_by?: string | null
          approved_at?: string | null
          approval_note?: string | null
          approved_overtime_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          ot_date: string
          customer: string | null
          pcode: string | null
          workshop: string
          original_workshop: string | null
          ot_category: 'PRODUCTION' | 'DELIVERY' | 'INTERNAL'
          reasons: Json
          total_employees: number
          total_hours: number
          required_output: number | null
          planned_hours: number | null
          notes: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          requested_by: string | null
          approved_by: string | null
          approved_at: string | null
          approval_note: string | null
          approved_overtime_id: string | null
          updated_at: string
        }>
      }
      overtime_request_participants: {
        Row: {
          id: string
          request_id: string
          employee_id: string | null
          employee_name: string
          hours: number
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          employee_id?: string | null
          employee_name: string
          hours: number
          created_at?: string
        }
        Update: Partial<{
          request_id: string
          employee_id: string | null
          employee_name: string
          hours: number
        }>
      }
      maintenance_schedule: {
        Row: {
          id: string
          workshop: string
          machine_code: string
          machine_name: string | null
          maintenance_type: string | null
          scheduled_date: string
          actual_date: string | null
          is_completed: boolean
          is_on_time: boolean | null
          checklist_items: Json | null
          technician: string | null
          notes: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          requested_by: string | null | null
          approved_by: string | null
          approved_at: string | null
          approval_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workshop: string
          machine_code: string
          machine_name?: string | null
          maintenance_type?: string | null
          scheduled_date: string
          actual_date?: string | null
          checklist_items?: Json | null
          technician?: string | null
          notes?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected'
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          approval_note?: string | null
          created_at?: string
        }
        Update: Partial<{
          workshop: string
          machine_code: string
          machine_name: string | null
          maintenance_type: string | null
          scheduled_date: string
          actual_date: string | null
          checklist_items: Json | null
          technician: string | null
          notes: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          requested_by: string | null | null
          approved_by: string | null
          approved_at: string | null
          approval_note: string | null
        }>
      }
      production_defects: {
        Row: {
          id: string
          report_date: string
          workshop: string
          pcode: string | null
          product_name: string | null
          total_qty: number
          defect_qty: number
          defect_type: string | null
          defect_cause: string | null
          unit: string | null
          shift: string | null
          reported_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          report_date: string
          workshop: string
          pcode?: string | null
          product_name?: string | null
          total_qty: number
          defect_qty?: number
          defect_type?: string | null
          defect_cause?: string | null
          unit?: string | null
          shift?: string | null
          reported_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: string
          report_date: string
          workshop: string
          pcode: string | null
          product_name: string | null
          total_qty: number
          defect_qty: number
          defect_type: string | null
          defect_cause: string | null
          unit: string | null
          shift: string | null
          reported_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }>
        Relationships: []
      }
      google_sheet_sync_configs: {
        Row: {
          id: string
          name: string
          enabled: boolean
          sheet_a_file_id: string
          sheet_a_tab_name: string
          sheet_c_file_id: string | null
          sheet_c_tab_name: string
          sheet_b_file_id: string | null
          sheet_b_tab_name: string
          sheet_b_pcode_col: string
          sheet_b_status_col: string
          sheet_b_override_statuses: string[]
          cutoff_date: string | null
          default_status: string
          sheet_c_status: string
          source_name: string
          soft_delete_missing: boolean
          soft_delete_reason: string
          max_soft_delete_ratio: number
          column_map: Json
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          enabled?: boolean
          sheet_a_file_id?: string
          sheet_a_tab_name?: string
          sheet_c_file_id?: string | null
          sheet_c_tab_name?: string
          sheet_b_file_id?: string | null
          sheet_b_tab_name?: string
          sheet_b_pcode_col?: string
          sheet_b_status_col?: string
          sheet_b_override_statuses?: string[]
          cutoff_date?: string | null
          default_status?: string
          sheet_c_status?: string
          source_name?: string
          soft_delete_missing?: boolean
          soft_delete_reason?: string
          max_soft_delete_ratio?: number
          column_map?: Json
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          name: string
          enabled: boolean
          sheet_a_file_id: string
          sheet_a_tab_name: string
          sheet_c_file_id: string | null
          sheet_c_tab_name: string
          sheet_b_file_id: string | null
          sheet_b_tab_name: string
          sheet_b_pcode_col: string
          sheet_b_status_col: string
          sheet_b_override_statuses: string[]
          cutoff_date: string | null
          default_status: string
          sheet_c_status: string
          source_name: string
          soft_delete_missing: boolean
          soft_delete_reason: string
          max_soft_delete_ratio: number
          column_map: Json
          updated_by: string | null
          updated_at: string
        }>
      }
      google_sheet_sync_runs: {
        Row: {
          id: string
          config_id: string | null
          mode: 'test' | 'preview' | 'run'
          status: 'running' | 'success' | 'failed'
          started_at: string
          finished_at: string | null
          initiated_by: string | null
          sheet_rows_read: number
          valid_rows: number
          skipped_rows: number
          inserted_rows: number
          updated_rows: number
          unchanged_rows: number
          soft_deleted_rows: number
          status_overrides: number
          default_status_applied: number
          error_count: number
          summary: Json | null
          error_message: string | null
        }
        Insert: {
          id?: string
          config_id?: string | null
          mode: 'test' | 'preview' | 'run'
          status: 'running' | 'success' | 'failed'
          started_at?: string
          finished_at?: string | null
          initiated_by?: string | null
          sheet_rows_read?: number
          valid_rows?: number
          skipped_rows?: number
          inserted_rows?: number
          updated_rows?: number
          unchanged_rows?: number
          soft_deleted_rows?: number
          status_overrides?: number
          default_status_applied?: number
          error_count?: number
          summary?: Json | null
          error_message?: string | null
        }
        Update: Partial<{
          config_id: string | null
          mode: 'test' | 'preview' | 'run'
          status: 'running' | 'success' | 'failed'
          finished_at: string | null
          initiated_by: string | null
          sheet_rows_read: number
          valid_rows: number
          skipped_rows: number
          inserted_rows: number
          updated_rows: number
          unchanged_rows: number
          soft_deleted_rows: number
          status_overrides: number
          default_status_applied: number
          error_count: number
          summary: Json | null
          error_message: string | null
        }>
      }
    }   // end Tables
    Views: Record<string, never>
    Functions: {
      repair_production_id_sequence: {
        Args: Record<string, never>
        Returns: void
      }
      rpc_apply_google_sheet_sync: {
        Args: {
          p_records: Json
          p_soft_delete_pcodes: string[]
          p_source_name: string
          p_deleted_at: string
          p_soft_delete_reason: string
        }
        Returns: void
      }
    }
    Enums: {
      user_role: 'ADMIN' | 'MANAGER' | 'WORKSHOP_MANAGER' | 'TEAM_LEADER' | 'MAINTENANCE' | 'COORDINATION' | 'SALES' | 'HR'
    }
  }
}
