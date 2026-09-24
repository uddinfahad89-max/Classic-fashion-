import { SupabaseClient } from '@supabase/supabase-js';

export declare const supabase: SupabaseClient;
export declare const isSupabaseConfigured: () => boolean;
export declare const getSupabaseConfig: () => {
  url: string;
  key: string;
  isConfigured: boolean;
};
export declare const setCustomSupabaseCredentials: (url?: string, key?: string) => void;
export default supabase;
