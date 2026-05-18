import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tfbzghjjfcaqmkzsxrrs.supabase.co';
const supabaseKey = 'sb_publishable_7dkBdGu87mnWz-acprRjzA_vHBujcwB';

export const supabase = createClient(supabaseUrl, supabaseKey);