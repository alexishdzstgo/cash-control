import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SECRET_KEY;
    const res = await fetch(url);
    const data = await res.json();

    const rpc = '/rpc/admin_assign_participation_responsibility_with_pin';

    if (data.paths[rpc] && data.paths[rpc].post) {
        console.log(`\n=== ${rpc} ===`);
        const body = data.paths[rpc].post.requestBody;
        if (body) {
            console.log(JSON.stringify(body, null, 2));
        } else {
            console.log("No requestBody found.");
        }
    }
}

run();
