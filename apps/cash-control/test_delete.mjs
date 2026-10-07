import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: qData, error } = await supabase.rpc('admin_delete_member', { 
        p_operator_token_hash: 'x', 
        p_member_id: 'y' 
    });
    console.log(error);
}
run();
