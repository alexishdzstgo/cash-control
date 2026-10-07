import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: qData, error } = await supabase.from('bank_accounts').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(qData);
    }
}
run();
