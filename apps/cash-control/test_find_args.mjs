import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: meli } = await supabase.from('business_members').select('*').ilike('username', '%meli%').single();
    console.log("Triggering error hint...");
    const { data: act, error: errA } = await supabase.rpc('admin_assign_participation_responsibility_with_pin', {
        p_member_id: meli.id,
        p_workstation_token_hash: 'test',
        p_pin: '1234'
    });
    console.log("Error body:", errA || act);
}

run();
