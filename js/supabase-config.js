// js/supabase-config.js

// Reemplaza esto con tu URL de Supabase y tu Anon Key
const SUPABASE_URL = "https://emmglwrqufduvzzlwyfy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ep2BTk52wttSoDLcW4LYYw_L1V8kKSa";

export const isMock = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export let supabase = null;

if (!isMock) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Ejecutando en Modo Mock. Configura SUPABASE_URL y SUPABASE_ANON_KEY para usar la base de datos.");
}
