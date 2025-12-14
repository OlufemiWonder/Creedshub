// config.js - Create this file in your root directory
// Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://fftxsxklrotgzturilhr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdHhzeGtscm90Z3p0dXJpbGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzU1OTEsImV4cCI6MjA4MDcxMTU5MX0.YAI8OHdMMw7V0-KK59hHz9nFyGj37o63FMzqPr7YAJ0";

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabase;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
