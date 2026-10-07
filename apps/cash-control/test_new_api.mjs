import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: meli } = await supabase.from('business_members').select('*').ilike('username', '%meli%').single();

    console.log("Activating member (Meli)...");
    const { data: act, error: errA } = await supabase.rpc('admin_activate_workstation_member', {
        p_member_id: meli.id,
        p_workstation_token_hash: 'test_token_' + Date.now()
    });
    console.log("Activation result:", errA || "Success", act);
}

run();
