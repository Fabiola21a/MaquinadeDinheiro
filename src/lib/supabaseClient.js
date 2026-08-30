import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rzvcxrftygrddxfjmmqy.supabase.co";
const SUPABASE_KEY = "sb_publishable_URsjQhyVqjBRV8pi7HtofA_SqzQq1dl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
