/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ({} as Record<string, string | undefined>);
const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
// Accept either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
const supabaseKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;
let supabaseConfigured = false;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    supabaseConfigured = true;
  } catch (err) {
    console.warn('[Journeo] Supabase client initialization failed:', err);
    supabase = createClient('https://placeholder.supabase.co', 'placeholder');
  }
} else {
  console.warn(
    '[Journeo] Supabase is not fully configured in .env.\n' +
    'Provide VITE_SUPABASE_URL (e.g. https://xyz.supabase.co) and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
  supabase = createClient('https://placeholder.supabase.co', 'placeholder');
}

export { supabase, supabaseConfigured };
