export type ShiftApiStatus = "open" | "closed";
export type ShiftApiParticipantRole = "shift_responsible" | "operator";
export type ShiftApiParticipantStatus = "active" | "left";

export type ShiftApiShift = {
  id: string;
  folio: string;
  status: ShiftApiStatus;
  openedAt: string;
  responsibleMemberId: string;
};

export type ShiftApiParticipant = {
  memberId: string;
  role: ShiftApiParticipantRole;
  status: ShiftApiParticipantStatus;
  joinedAt: string;
  leftAt: string | null;
  username: string;
  displayName: string;
};

export type ShiftApiSnapshot = {
  shift: ShiftApiShift | null;
  participants: ShiftApiParticipant[];
};

export class ShiftApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ShiftApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ShiftApiError(
      "No se pudo conectar con el servicio de turnos.",
      503,
      "UNAVAILABLE",
    );
  }

  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
  } | null;
  if (!response.ok) {
    throw new ShiftApiError(
      typeof body?.error === "string"
        ? body.error
        : "No se pudo completar la operación del turno.",
      response.status,
      typeof body?.code === "string" ? body.code : null,
    );
  }
  return body as T;
}

export function getShiftSnapshot() {
  return request<ShiftApiSnapshot>("/api/shifts", { method: "GET" });
}

export function openPersistedShift() {
  return request<{ shift: ShiftApiShift }>("/api/shifts", {
    method: "POST",
    body: "{}",
  });
}

export function addPersistedShiftParticipant(memberId: string) {
  return request<{ participant: ShiftApiParticipant }>(
    "/api/shifts/participants",
    {
      method: "POST",
      body: JSON.stringify({ memberId }),
    },
  );
}

export function transferPersistedShiftResponsibility(
  memberId: string,
  receiverPin: string,
) {
  return request<{
    result: {
      shiftId: string;
      previousResponsibleMemberId: string;
      responsibleMemberId: string;
    };
  }>("/api/shifts/responsibility", {
    method: "POST",
    body: JSON.stringify({
      p_new_responsible_member_id: memberId,
      receiverPin,
    }),
  });
}

export function leavePersistedShift() {
  return request<{ participant: ShiftApiParticipant }>("/api/shifts/leave", {
    method: "POST",
    body: "{}",
  });
}
