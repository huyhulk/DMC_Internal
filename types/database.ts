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
      DATA: {
        Row: {
          id: number
          pcode: string
          initialdate: string | null
          workshop: string | null
          customer: string | null
          quantity: string | null
          description: string | null
          deadlinedate: string | null
          deadlinetime: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          pcode: string
          initialdate?: string | null
          workshop?: string | null
          customer?: string | null
          quantity?: string | null
          description?: string | null
          deadlinedate?: string | null
          deadlinetime?: string | null
          status?: string | null
        }
        Update: {
          pcode?: string
          initialdate?: string | null
          workshop?: string | null
          customer?: string | null
          quantity?: string | null
          description?: string | null
          deadlinedate?: string | null
          deadlinetime?: string | null
          status?: string | null
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
    }
  }
}
