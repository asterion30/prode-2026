import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://emmglwrqufduvzzlwyfy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ep2BTk52wttSoDLcW4LYYw_L1V8kKSa";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
