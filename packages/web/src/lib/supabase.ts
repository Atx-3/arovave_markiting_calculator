import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether Supabase credentials are properly configured.
 * When false, all sync operations should be skipped gracefully.
 */
export const supabaseReady = !!(supabaseUrl && supabaseAnonKey);

if (!supabaseReady) {
    console.error(
        '❌ Supabase credentials missing!\n' +
        '   → VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file.\n' +
        '   → The app will work in offline/local-only mode until credentials are configured.'
    );
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
);
