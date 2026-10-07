const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("-> Eliminando operaciones registradas de prueba...");
    const { error } = await supabase
        .from("operations")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
        console.error("Error eliminando operaciones:", error);
    } else {
        console.log("-> ¡Operaciones eliminadas exitosamente. Dominio limpio!");
    }
}

run();
