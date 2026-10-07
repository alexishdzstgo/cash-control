import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function testExpiration(hours) {
    const wsTokenHash = crypto.randomBytes(32).toString('hex');
    const wsExp = new Date(Date.now() + 23*60*60*1000).toISOString();
    const memberId = 'ba33bb4e-a612-4ee1-b0de-eaeca819349e'; // Zef
    
    // Create WS
    await supabase.rpc('admin_create_workstation_session', {
        p_business_id: '24f9fbd1-3234-4b4c-aca3-ad121cdb08ba',
        p_created_by_member_id: memberId,
        p_token_hash: wsTokenHash,
        p_expires_at: wsExp
    });
    
    // Activate member
    const { error: actErr } = await supabase.rpc('admin_activate_workstation_member', {
        p_workstation_token_hash: wsTokenHash,
        p_member_id: memberId
    });
    if (actErr) {
        console.log(`Hours: ${hours}, ActError:`, actErr.message);
        return;
    }
    
    // Attempt Op
    const opExp = new Date(Date.now() + hours*60*60*1000).toISOString();
    const opTokenHash = crypto.randomBytes(32).toString('hex');
    
    const { error } = await supabase.rpc('admin_issue_operator_session', {
        p_workstation_token_hash: wsTokenHash,
        p_member_id: memberId,
        p_token_hash: opTokenHash,
        p_expires_at: opExp
    });
    
    console.log(`Hours: ${hours}, Error:`, error ? error.message : 'SUCCESS');
}

async function run() {
    await testExpiration(12);
    await testExpiration(24);
}
run();
