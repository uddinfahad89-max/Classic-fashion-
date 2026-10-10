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
const CANONICAL_SUPABASE_URL = 'https://tklqslizkqtispiyuder.supabase.co';
const CANONICAL_SUPABASE_KEY = 'sb_publishable_9C6A0sMh9-KBoxhJnfBExA_wzMLOcnf';

const configuredUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || CANONICAL_SUPABASE_URL;
const configuredAnonKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || CANONICAL_SUPABASE_KEY;

// Fallback dummy credentials to prevent createClient throwing on unconfigured start
const defaultUrl = (configuredUrl && configuredUrl.startsWith('http'))
  ? configuredUrl
  : CANONICAL_SUPABASE_URL;

const defaultAnonKey = configuredAnonKey || CANONICAL_SUPABASE_KEY;

export const isSupabaseConfigured = () => {
  const currentUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || CANONICAL_SUPABASE_URL;
  const currentKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || CANONICAL_SUPABASE_KEY;
  return Boolean(
    currentUrl &&
    currentKey &&
    currentUrl.startsWith('https://') &&
    !currentUrl.includes('placeholder-project') &&
    !currentKey.includes('placeholder')
  );
};

export const getSupabaseConfig = () => {
  const currentUrl = getLocalConfig('pos_supabase_url') || getEnvVar('VITE_SUPABASE_URL') || CANONICAL_SUPABASE_URL;
  const currentKey = getLocalConfig('pos_supabase_anon_key') || getEnvVar('VITE_SUPABASE_ANON_KEY') || CANONICAL_SUPABASE_KEY;
  return {
    url: currentUrl,
    key: currentKey,
    isConfigured: isSupabaseConfigured(),
  };
};

export const setCustomSupabaseCredentials = (url, key) => {
  try {
    const cleanUrl = url ? url.trim() : '';
    const cleanKey = key ? key.trim() : '';

    if (typeof window !== 'undefined' && window.localStorage) {
      if (cleanUrl) window.localStorage.setItem('pos_supabase_url', cleanUrl);
      else window.localStorage.removeItem('pos_supabase_url');

      if (cleanKey) window.localStorage.setItem('pos_supabase_anon_key', cleanKey);
      else window.localStorage.removeItem('pos_supabase_anon_key');
    }

    // Also persist to server disk so other devices and browsers immediately have it
    if (typeof fetch !== 'undefined') {
      fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
      }).catch((e) => console.warn('Server supabase config sync notice:', e));
    }
  } catch (e) {
    console.warn('Failed to save Supabase credentials:', e);
  }
};

// Initial background check: fetch shared credentials from server if localStorage is empty
if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
  fetch('/api/supabase/config')
    .then((r) => r.json())
    .then((cfg) => {
      if (cfg && cfg.url && cfg.key && !window.localStorage.getItem('pos_supabase_url')) {
        window.localStorage.setItem('pos_supabase_url', cfg.url);
        window.localStorage.setItem('pos_supabase_anon_key', cfg.key);
      }
    })
    .catch(() => {});
}

export const supabase = createClient(defaultUrl, defaultAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
