import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function testExpiration(hours) {
    const wsTokenHash = crypto.randomBytes(32).toString('hex');
    const wsExp = new Date(Date.now() + 23*60*60*1000).toISOString();
    
    // Create WS
    await supabase.rpc('admin_create_workstation_session', {
        p_business_id: '24f9fbd1-3234-4b4c-aca3-ad121cdb08ba',
        p_created_by_member_id: 'ba33bb4e-a612-4ee1-b0de-eaeca819349e', // Zef
        p_token_hash: wsTokenHash,
        p_expires_at: wsExp
    });
    
    // Attempt Op
    const opExp = new Date(Date.now() + hours*60*60*1000).toISOString();
    const opTokenHash = crypto.randomBytes(32).toString('hex');
    
    const { error } = await supabase.rpc('admin_issue_operator_session', {
        p_workstation_token_hash: wsTokenHash,
        p_member_id: 'ba33bb4e-a612-4ee1-b0de-eaeca819349e', // Zef (same as WS creator)
        p_token_hash: opTokenHash,
        p_expires_at: opExp
    });
    
    console.log(`Hours: ${hours}, Error:`, error ? error.message : 'SUCCESS');
}

async function run() {
    await testExpiration(12);
    await testExpiration(6);
    await testExpiration(24);
    await testExpiration(25);
    await testExpiration(-1);
    
    const wsTokenHash = crypto.randomBytes(32).toString('hex');
    const wsExp = new Date(Date.now() + 23*60*60*1000).toISOString();
    await supabase.rpc('admin_create_workstation_session', {
        p_business_id: '24f9fbd1-3234-4b4c-aca3-ad121cdb08ba',
        p_created_by_member_id: 'ba33bb4e-a612-4ee1-b0de-eaeca819349e',
        p_token_hash: wsTokenHash,
        p_expires_at: wsExp
    });
    
    const { error } = await supabase.rpc('admin_issue_operator_session', {
        p_workstation_token_hash: wsTokenHash,
        p_member_id: 'ba33bb4e-a612-4ee1-b0de-eaeca819349e',
        p_token_hash: crypto.randomBytes(32).toString('hex'),
        p_expires_at: wsExp
    });
    console.log('Same as WS Exp Error:', error ? error.message : 'SUCCESS');
    
    const afterWsExp = new Date(new Date(wsExp).getTime() + 1000).toISOString();
    const { error: error2 } = await supabase.rpc('admin_issue_operator_session', {
        p_workstation_token_hash: wsTokenHash,
        p_member_id: 'ba33bb4e-a612-4ee1-b0de-eaeca819349e',
        p_token_hash: crypto.randomBytes(32).toString('hex'),
        p_expires_at: afterWsExp
    });
    console.log('After WS Exp Error:', error2 ? error2.message : 'SUCCESS');
}
run();
