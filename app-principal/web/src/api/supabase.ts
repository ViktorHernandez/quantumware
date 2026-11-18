import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigurado = Boolean(url && key);

export const supabase: SupabaseClient = createClient(
  url || 'http://localhost',
  key || 'clave-no-configurada',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'quantumware-auth',
    },
  },
);
