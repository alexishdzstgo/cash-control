import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: members, error } = await supabase
        .from('business_members')
        .select('*')
        .eq('business_id', '24f9fbd1-3234-4b4c-aca3-ad121cdb08ba')
        .eq('status', 'active');
        
    console.log(members);
}
run();
