import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SECRET_KEY;
    const res = await fetch(url);
    const data = await res.json();
    const rpcs = Object.keys(data.paths).filter(p => p.startsWith('/rpc/'));
    console.log(JSON.stringify(rpcs, null, 2));
}

run();
