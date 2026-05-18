import { createClient } from '@supabase/supabase-js';

// URL limpia, estrictamente SIN el "/rest/v1/" al final
const supabaseUrl = 'https://tfbzghjjfcaqmkzsxrrs.supabase.co'; 
const supabaseKey = 'sb_publishable_7dkBdGu87mnWz-acprRjzA_vHBujcwB'; 

export const supabase = createClient(supabaseUrl, supabaseKey);