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
          role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
          workspace: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          role?: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
          workspace?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string
          role?: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
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
        }
      }
      human_resource: {
        Row: {
          id: number
          name: string
          factory: string | null
          machine: string | null
          position: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          factory?: string | null
          machine?: string | null
          position?: string | null
          phone?: string | null
        }
        Update: {
          name?: string
          factory?: string | null
          machine?: string | null
          position?: string | null
          phone?: string | null
          updated_at?: string
        }
      }
      hr_daily: {
        Row: {
          id: number
          factory: string
          pdate: string
          totalem: number | null
          absent_ids: number[] | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          factory: string
          pdate: string
          totalem?: number | null
          absent_ids?: number[] | null
        }
        Update: {
          totalem?: number | null
          absent_ids?: number[] | null
          updated_at?: string | null
        }
      }
    }   // end Tables
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
    }
  }
}
