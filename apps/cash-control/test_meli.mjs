import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data, error } = await supabase.rpc('get_schema_info'); // Wait, we can't do this easily.
    // Instead:
    const { data: q } = await supabase.from('information_schema.tables').select('*');
    console.log(q);
}

run();
