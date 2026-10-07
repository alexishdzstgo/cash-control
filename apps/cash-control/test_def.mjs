import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: qData, error } = await supabase.rpc('invoke_sql', { query: `
        select pg_get_functiondef(p.oid)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where p.proname = 'admin_issue_operator_session'
        and n.nspname = 'public';
    `});
    
    if (error) {
        // invoke_sql might not exist, but let's try direct postgres connection via small script
        console.log("Error invoking SQL (expected if invoke_sql not defined):", error.message);
    } else {
        console.log(qData);
    }
}
run();
