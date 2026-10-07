import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data, error } = await supabase.from('pg_proc')
        .select('proname, proargnames')
        .ilike('proname', 'admin_assign_participation_responsibility%');

    console.log("Found:", data, error);
}

run();
