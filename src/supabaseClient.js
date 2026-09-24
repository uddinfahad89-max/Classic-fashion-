import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment variables or custom localStorage override
const getEnvVar = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore error in non-Vite environments
  }
  return '';
};

const getLocalConfig = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || '';
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return '';
};

// Default or configured credentials
const configuredUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || '';
const configuredAnonKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || '';

// Fallback dummy credentials to prevent createClient throwing on unconfigured start
const defaultUrl = configuredUrl && configuredUrl.startsWith('http')
  ? configuredUrl
  : 'https://placeholder-project.supabase.co';

const defaultAnonKey = configuredAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = () => {
  const currentUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || '';
  const currentKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || '';
  return Boolean(
    currentUrl &&
    currentKey &&
    currentUrl.startsWith('https://') &&
    !currentUrl.includes('placeholder-project') &&
    !currentKey.includes('placeholder')
  );
};

export const getSupabaseConfig = () => {
  const currentUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || '';
  const currentKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || '';
  return {
    url: currentUrl,
    key: currentKey,
    isConfigured: isSupabaseConfigured(),
  };
};

export const setCustomSupabaseCredentials = (url, key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (url) window.localStorage.setItem('pos_supabase_url', url.trim());
      else window.localStorage.removeItem('pos_supabase_url');

      if (key) window.localStorage.setItem('pos_supabase_anon_key', key.trim());
      else window.localStorage.removeItem('pos_supabase_anon_key');
    }
  } catch (e) {
    console.warn('Failed to save Supabase credentials:', e);
  }
};

export const supabase = createClient(defaultUrl, defaultAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
