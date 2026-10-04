
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { hashToken } from "@/lib/security/tokens";

export async function PATCH(request: Request) {
    try {
        // 1. Validar que exista la sesión del operador.
        const cookieStore = await cookies();
        const operatorToken = cookieStore.get("cash_control_operator")?.value;

        if (!operatorToken) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Inicia sesión para editar usuarios.",
                },
                { status: 401 },
            );
        }

        // 2. Leer y validar el cuerpo de la solicitud.
        let body: Record<string, unknown>;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    ok: false,
                    error: "El cuerpo de la solicitud no es JSON válido.",
                },
                { status: 400 },
            );
        }

        const memberId =
            typeof body.memberId === "string" ? body.memberId.trim() : "";

        const firstName =
            typeof body.firstName === "string" ? body.firstName.trim() : "";

        const lastName =
            typeof body.lastName === "string" ? body.lastName.trim() : "";

        const username =
            typeof body.username === "string"
                ? body.username.trim().toLowerCase()
                : "";

        const systemRole = body.systemRole;
        const status = body.status;

        const internalNotes =
            typeof body.internalNotes === "string"
                ? body.internalNotes.trim()
                : "";

        if (
            !memberId ||
            !firstName ||
            !lastName ||
            !/^[a-z0-9._-]{3,30}$/.test(username) ||
            (systemRole !== "owner" && systemRole !== "employee") ||
            (status !== "active" && status !== "suspended")
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Revisa los datos del usuario e inténtalo de nuevo.",
                },
                { status: 400 },
            );
        }

        // 3. Ejecutar la función transaccional de PostgreSQL.
        // El token se envía como hash; nunca enviamos el token original.
        const { error } = await supabaseServer.rpc("admin_update_member", {
            p_operator_token_hash: hashToken(operatorToken),
            p_member_id: memberId,
            p_first_name: firstName,
            p_last_name: lastName,
            p_username: username,
            p_role: systemRole,
            p_status: status,
            p_internal_notes: internalNotes,
        });

        if (error) {
            // Nombre de usuario duplicado.
            if (error.code === "23505") {
                return NextResponse.json(
                    {
                        ok: false,
                        error: "Ese nombre de usuario ya está registrado.",
                    },
                    { status: 409 },
                );
            }

            // Sesión inválida o falta de permisos.
            if (error.code === "42501") {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            error.message ||
                            "No tienes permiso para editar usuarios.",
                    },
                    { status: 403 },
                );
            }

            // No se puede dejar el negocio sin dueño activo.
            if (error.code === "23514") {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            error.message ||
                            "El negocio debe conservar al menos un dueño activo.",
                    },
                    { status: 409 },
                );
            }

            // Validación de datos o usuario inexistente.
            if (error.code === "22023" || error.code === "P0002") {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            error.message ||
                            "Los datos enviados no son válidos.",
                    },
                    { status: 400 },
                );
            }

            console.error("Error updating business member:", error);

            return NextResponse.json(
                {
                    ok: false,
                    error: "No se pudo guardar la información del usuario.",
                },
                { status: 500 },
            );
        }

        // 4. Confirmar que PostgreSQL completó la actualización.
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Unexpected error updating business member:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "Ocurrió un error al actualizar el usuario.",
            },
            { status: 500 },
        );
    }
}