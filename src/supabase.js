import { createClient } from '@supabase/supabase-js';

// These should ideally be in a .env file, but since this is going to Vercel,
// the user can set these up as environment variables there.
// We use placeholder values to avoid crashes if they are not set yet.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
