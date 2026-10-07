import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function run() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SECRET_KEY}`);
    const data = await res.json();
    fs.writeFileSync('openapi.json', JSON.stringify(data, null, 2));
}
run();
