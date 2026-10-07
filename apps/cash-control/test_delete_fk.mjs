import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
    const { data: member, error } = await supabase.from('business_members').select('*').limit(1);
    console.log("Can query members:", !error);
}
run();
