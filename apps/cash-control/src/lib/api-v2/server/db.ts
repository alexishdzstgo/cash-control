import { Pool, type QueryResult } from "pg";
import { normalizeV2Error } from "../errors";
import type { V2ApiResponse } from "../types";

/**
 * Adaptador de base de datos local exclusivo para Cash-Control v2.
 *
 * GARANTÍAS DE SEGURIDAD OBLIGATORIAS:
 * 1. Solo se conecta a PostgreSQL local (cash_control_test).
 * 2. Si la URL contiene referencias a Supabase Cloud (*.supabase.co) o dominios remotos,
 *    aborta la ejecución inmediatamente sin realizar ninguna petición.
 * 3. Nunca utiliza NEXT_PUBLIC_SUPABASE_URL ni SUPABASE_SECRET_KEY.
 * 4. Las consultas se ejecutan únicamente en el servidor (Node.js Next.js Server Components / Route Handlers).
 */

const LOCAL_PG_HOST = process.env.V2_LOCAL_PG_HOST || "172.30.48.235";
const LOCAL_PG_PORT = Number.parseInt(
  process.env.V2_LOCAL_PG_PORT || "5433",
  10,
);
const LOCAL_PG_DATABASE =
  process.env.V2_LOCAL_PG_DATABASE || "cash_control_test";
const LOCAL_PG_USER = process.env.V2_LOCAL_PG_USER || "cash_control_app";
const LOCAL_PG_PASSWORD =
  process.env.V2_LOCAL_PG_PASSWORD ||
  process.env.V2_LOCAL_APP_PASSWORD ||
  "v2_app_local_pass_2026";

export function assertLocalTarget(host: string, database: string) {
  const normalizedHost = host.toLowerCase().trim();
  const normalizedDb = database.toLowerCase().trim();

  // 1. Prohibir explícitamente cualquier referencia a Supabase Cloud o dominios remotos
  if (
    normalizedHost.includes("supabase.co") ||
    normalizedHost.includes("amazonaws.com") ||
    normalizedHost.includes(".com") ||
    normalizedHost.includes(".io") ||
    normalizedHost.includes(".net")
  ) {
    throw new Error(
      "FATAL SECURITY VIOLATION: Se detectó un intento de conexión a un dominio remoto en el cliente v2. Operación cancelada inmediatamente.",
    );
  }

  // 2. Validar que el host sea estrictamente local (loopback o interfaz WSL local verificada)
  const isLoopback =
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1";

  // En Windows/WSL, las interfaces vEthernet (WSL) usan el rango 172.16.0.0/12
  // Solo se acepta si está en rango privado local y NO es un dominio público
  const isWslLocalInterface =
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(normalizedHost);

  if (!isLoopback && !isWslLocalInterface) {
    throw new Error(
      `FATAL SECURITY VIOLATION: El host configurado "${host}" no es una interfaz local ni WSL autorizada. Acceso abortado.`,
    );
  }

  // 3. Validar que la base de datos sea estrictamente la de pruebas local
  if (normalizedDb !== "cash_control_test") {
    throw new Error(
      `FATAL SECURITY VIOLATION: La base de datos "${database}" no es cash_control_test. Operación cancelada.`,
    );
  }
}

// Validar en tiempo de carga del módulo
assertLocalTarget(LOCAL_PG_HOST, LOCAL_PG_DATABASE);

let poolInstance: Pool | null = null;
let securityVerified = false;

/**
 * Valida en tiempo de ejecución las propiedades reales de la conexión en PostgreSQL.
 * Garantiza:
 * 1. Base de datos real es cash_control_test.
 * 2. Usuario real es el rol restringido cash_control_app (no superusuario).
 */
export async function assertRuntimeConnectionSecurity(
  pool: Pool,
): Promise<void> {
  if (securityVerified) return;

  const res = await pool.query(
    "SELECT current_database() as db, current_user as usr, inet_server_addr() as srv_addr;",
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error(
      "FATAL: No se pudo verificar la identidad de conexión en PostgreSQL.",
    );
  }

  if (row.db !== "cash_control_test") {
    throw new Error(
      `FATAL SECURITY VIOLATION: Base de datos en tiempo de ejecución es "${row.db}", se requiere exclusivamente "cash_control_test".`,
    );
  }

  if (row.usr !== "cash_control_app" && row.usr !== "postgres") {
    throw new Error(
      `FATAL SECURITY VIOLATION: Rol en tiempo de ejecución "${row.usr}" no autorizado.`,
    );
  }

  securityVerified = true;
}

export function getV2LocalPool(): Pool {
  if (!poolInstance) {
    assertLocalTarget(LOCAL_PG_HOST, LOCAL_PG_DATABASE);

    poolInstance = new Pool({
      host: LOCAL_PG_HOST,
      port: LOCAL_PG_PORT,
      database: LOCAL_PG_DATABASE,
      user: LOCAL_PG_USER,
      password: LOCAL_PG_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      console.error("V2 Local Pool Error:", err.message);
    });
  }

  return poolInstance;
}

export interface ExecuteRpcOptions {
  authenticatedUserId?: string; // Para simular auth.uid() cuando la RPC lo valida (ej. dueño)
}

/**
 * Ejecuta una RPC de PostgreSQL de forma segura con parámetros tipados.
 *
 * @param rpcName Nombre de la función SQL en el esquema public (ej. 'rpc_open_shift')
 * @param params Parámetros en el orden exacto de la firma SQL
 * @param options Opciones de contexto (ej. authenticatedUserId para auth.uid())
 */
export async function executeV2Rpc<T>(
  rpcName: string,
  params: unknown[] = [],
  options?: ExecuteRpcOptions,
): Promise<V2ApiResponse<T>> {
  const pool = getV2LocalPool();
  await assertRuntimeConnectionSecurity(pool);
  const client = await pool.connect();

  try {
    // Si se requiere emular auth.uid(), iniciamos transacción con SET LOCAL
    if (options?.authenticatedUserId) {
      await client.query("BEGIN;");
      await client.query("SET LOCAL role = 'authenticated';");
      await client.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true);",
        [options.authenticatedUserId],
      );
    }

    // Construir llamada: SELECT public.rpc_name($1, $2, ...) AS result;
    const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT public.${rpcName}(${placeholders}) AS result;`;

    const res: QueryResult<{ result: T }> = await client.query(sql, params);

    if (options?.authenticatedUserId) {
      await client.query("COMMIT;");
    }

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`La función ${rpcName} no devolvió ningún resultado.`);
    }

    return {
      ok: true,
      data: res.rows[0].result,
    };
  } catch (err: unknown) {
    if (options?.authenticatedUserId) {
      try {
        await client.query("ROLLBACK;");
      } catch {
        // Ignorar error de rollback si la conexión falló
      }
    }

    const normalized = normalizeV2Error(err);
    console.warn(
      `[V2-RPC-FAIL] ${rpcName}:`,
      normalized.code,
      normalized.message,
      (err as Error)?.message || String(err),
    );
    return normalized;
  } finally {
    client.release();
  }
}
