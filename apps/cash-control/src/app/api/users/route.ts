import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";


export async function GET() {
  const { data, error } = await supabaseServer
    .from("business_members")
    .select(`
      id,
      user_id,
      username,
      role,
      status,
      created_at,
      last_login_at,
      internal_notes,
      profiles (
        first_name,
        last_name,
        display_name
      )
    `)
    .eq("business_id", "24f9fbd1-3234-4b4c-aca3-ad121cdb08ba")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const users = data.map((member) => {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;

    return {
      id: member.id,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      displayName:
        profile?.display_name ||
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
      username: member.username,
      systemRole: member.role,
      status: member.status,
      createdAt: member.created_at,
      lastLogin: member.last_login_at ?? null,
      temporaryPassword: "",
      internalNotes: member.internal_notes ?? "",
      authUserId: member.user_id,
      profileId: member.user_id,
      passwordRecoveryStatus: "not_configured" as const,
      sessionsReady: false,
    };
  });

  return NextResponse.json({
    ok: true,
    users,
  });
}




const BUSINESS_ID = "24f9fbd1-3234-4b4c-aca3-ad121cdb08ba";

export async function POST(request: Request) {
  let authUserId: string | null = null;
  let memberId: string | null = null;

  try {
    const body = await request.json();

    const firstName =
      typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName =
      typeof body.lastName === "string" ? body.lastName.trim() : "";
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const role = body.systemRole;
    const status = body.status;
    const internalNotes =
      typeof body.internalNotes === "string"
        ? body.internalNotes.trim()
        : "";

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "El nombre y los apellidos son obligatorios." },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return NextResponse.json(
        {
          ok: false,
          error: "El usuario debe tener entre 3 y 30 caracteres válidos.",
        },
        { status: 400 },
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "El PIN debe contener exactamente 4 dígitos." },
        { status: 400 },
      );
    }

    if (role !== "owner" && role !== "employee") {
      return NextResponse.json(
        { ok: false, error: "El rol seleccionado no es válido." },
        { status: 400 },
      );
    }

    if (status !== "active" && status !== "suspended") {
      return NextResponse.json(
        { ok: false, error: "El estado seleccionado no es válido." },
        { status: 400 },
      );
    }

    const { data: existingMember, error: lookupError } =
      await supabaseServer
        .from("business_members")
        .select("id")
        .eq("business_id", BUSINESS_ID)
        .ilike("username", username)
        .maybeSingle();

    if (lookupError) {
      throw new Error("No se pudo comprobar si el usuario ya existe.");
    }

    if (existingMember) {
      return NextResponse.json(
        { ok: false, error: "Ese nombre de usuario ya está registrado." },
        { status: 409 },
      );
    }

    // Esta contraseña es interna: el usuario entra mediante su PIN.
    const internalPassword = randomBytes(32).toString("base64url");
    const email = `${username}@cashcontrol.com`;

    const { data: authResult, error: authError } =
      await supabaseServer.auth.admin.createUser({
        email,
        password: internalPassword,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: `${firstName} ${lastName}`,
        },
      });

    if (authError || !authResult.user) {
      throw new Error(
        authError?.message ?? "No se pudo crear la cuenta de autenticación.",
      );
    }

    authUserId = authResult.user.id;

    const { data: provisionedMemberId, error: provisionError } =
      await supabaseServer.rpc("admin_provision_member", {
        p_business_id: BUSINESS_ID,
        p_user_id: authUserId,
        p_first_name: firstName,
        p_last_name: lastName,
        p_display_name: `${firstName} ${lastName}`,
        p_avatar: null,
        p_username: username,
        p_role: role,
        p_internal_notes: internalNotes,
        p_pin: pin,
      });

    if (provisionError || !provisionedMemberId) {
      throw new Error(
        provisionError?.message ?? "No se pudo registrar el usuario.",
      );
    }

    memberId = provisionedMemberId as string;

    if (status === "suspended") {
      const { error: statusError } = await supabaseServer
        .from("business_members")
        .update({ status: "suspended" })
        .eq("id", memberId)
        .eq("business_id", BUSINESS_ID);

      if (statusError) {
        throw new Error("El usuario se creó, pero no se pudo suspender.");
      }
    }

    return NextResponse.json(
      {
        ok: true,
        memberId,
        message: "Usuario registrado correctamente.",
      },
      { status: 201 },
    );
  } catch (error) {
    // Si falla el alta, intentamos limpiar la cuenta recién creada.
    if (memberId) {
      await supabaseServer
        .from("business_members")
        .delete()
        .eq("id", memberId)
        .eq("business_id", BUSINESS_ID);
    }

    if (authUserId) {
      await supabaseServer.auth.admin.deleteUser(authUserId);
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al crear el usuario.",
      },
      { status: 500 },
    );
  }
}
