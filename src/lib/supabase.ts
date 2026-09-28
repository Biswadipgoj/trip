import { createClient } from '@supabase/supabase-js'
import { SITE_URL } from '@/config/site'

// Trip data goes through this site's own /api/sb proxy, never straight to
// Supabase: the proxy checks the httpOnly session cookie and adds a trip pass
// that the database requires. The browser holds no database key at all.

const cloudConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

let refreshing: Promise<boolean> | null = null

/** One refresh at a time, shared by every request that hit an expired token. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => { refreshing = null }, 0) })
  return refreshing
}

/** Renews the 15-minute access cookie once and retries when the proxy says it expired. */
const sessionFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, { ...init, credentials: 'same-origin' })
  if (res.status !== 401 || typeof window === 'undefined') return res
  if (!(await refreshSession())) return res
  return fetch(input, { ...init, credentials: 'same-origin' })
}

function proxyBase(): string {
  return typeof window !== 'undefined' ? `${window.location.origin}/api/sb` : `${SITE_URL}/api/sb`
}

export const supabase = cloudConfigured
  ? createClient(proxyBase(), 'tripmate-session', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: sessionFetch },
    })
  : null

// ─── Type-safe helper: returns null-safe supabase client ──────────────────────
export function getSupabase() {
  return supabase
}

// ─── Database Types (mirrors SQL schema) ─────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id:          string
          trip_code:   string
          name:        string
          password:    string
          creator_id:  string | null
          status:      'active' | 'closed'
          created_at:  string
          closed_at:   string | null
        }
        Insert: Omit<Database['public']['Tables']['trips']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trips']['Insert']>
      }
      members: {
        Row: {
          id:           string
          trip_id:      string
          name:         string
          mobile:       string
          pin:          string
          upi_id:       string | null
          upi_name:     string | null
          avatar_color: string
          joined_at:    string
        }
        Insert: Omit<Database['public']['Tables']['members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['members']['Insert']>
      }
      expenses: {
        Row: {
          id:         string
          trip_id:    string
          title:      string
          amount:     number
          paid_by:    string
          category:   string
          split_type: string
          notes:      string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      expense_participants: {
        Row: {
          id:              string
          expense_id:      string
          member_id:       string
          split_value:     number
          resolved_amount: number
        }
        Insert: Omit<Database['public']['Tables']['expense_participants']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['expense_participants']['Insert']>
      }
      hotel_expenses: {
        Row: {
          id:           string
          trip_id:      string
          title:        string
          total_amount: number
          paid_by:      string
          created_at:   string
        }
        Insert: Omit<Database['public']['Tables']['hotel_expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['hotel_expenses']['Insert']>
      }
      rooms: {
        Row: {
          id:               string
          hotel_expense_id: string
          trip_id:          string
          name:             string
          cost:             number
        }
        Insert: Omit<Database['public']['Tables']['rooms']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
      }
      room_occupants: {
        Row: {
          id:        string
          room_id:   string
          member_id: string
        }
        Insert: Omit<Database['public']['Tables']['room_occupants']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['room_occupants']['Insert']>
      }
      settlement_groups: {
        Row: {
          id:      string
          trip_id: string
          name:    string
        }
        Insert: Omit<Database['public']['Tables']['settlement_groups']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['settlement_groups']['Insert']>
      }
      settlement_group_members: {
        Row: {
          id:        string
          group_id:  string
          member_id: string
        }
        Insert: Omit<Database['public']['Tables']['settlement_group_members']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['settlement_group_members']['Insert']>
      }
      sponsorships: {
        Row: {
          id:                   string
          trip_id:              string
          sponsor_member_id:    string
          sponsored_member_id:  string
        }
        Insert: Omit<Database['public']['Tables']['sponsorships']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sponsorships']['Insert']>
      }
      settlements: {
        Row: {
          id:             string
          trip_id:        string
          from_member_id: string
          to_member_id:   string
          amount:         number
          status:         'pending' | 'paid' | 'confirmed'
          paid_at:        string | null
          confirmed_at:   string | null
          created_at:     string
          updated_at:     string
        }
        Insert: Omit<Database['public']['Tables']['settlements']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['settlements']['Insert']>
      }
    }
    Views: {
      member_balances: {
        Row: {
          member_id:    string
          trip_id:      string
          name:         string
          avatar_color: string
          total_paid:   number
          total_owed:   number
          net_balance:  number
        }
      }
      trip_summary: {
        Row: {
          trip_id:                 string
          trip_name:               string
          trip_code:               string
          status:                  string
          created_at:              string
          closed_at:               string | null
          member_count:            number
          expense_count:           number
          total_expense_amount:    number
          total_hotel_amount:      number
          grand_total:             number
          confirmed_settlements:   number
          total_settlements:       number
        }
      }
    }
  }
}
