import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
      lastLogin: "never" as const,
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