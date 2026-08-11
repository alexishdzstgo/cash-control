import type { Shift, ShiftParticipant } from "@/types/shift";

export const activeShift: Shift = {
  id: "shift-001",
  name: "Turno matutino",
  status: "active",
  responsibleUserId: "maria-lopez",
  startedAt: new Date(
    Date.now() - 7 * 60 * 60 * 1000 - 42 * 60 * 1000,
  ).toISOString(),
  currentDuration: "7 h 42 min",
  openingBalance: 5000,
  participants: [
    {
      id: "participant-001",
      userId: "maria-lopez",
      name: "María López",
      systemRole: "owner",
      shiftRole: "shift_responsible",
      joinedAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 - 42 * 60 * 1000,
      ).toISOString(),
      status: "active",
    },
    {
      id: "participant-002",
      userId: "juan-perez",
      name: "Juan Pérez",
      systemRole: "employee",
      shiftRole: "operator",
      joinedAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 - 39 * 60 * 1000,
      ).toISOString(),
      status: "active",
    },
    {
      id: "participant-003",
      userId: "alexis-hernandez",
      name: "Alexis Hernández",
      systemRole: "employee",
      shiftRole: "operator",
      joinedAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 + 15 * 60 * 1000,
      ).toISOString(),
      status: "active",
    },
  ],
  activity: [
    {
      id: "activity-001",
      type: "shift_started",
      description: "María López inició el turno con $5,000.00",
      occurredAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 - 42 * 60 * 1000,
      ).toISOString(),
      performedBy: "María López",
    },
    {
      id: "activity-002",
      type: "participant_joined",
      description: "Juan Pérez se incorporó como participante",
      occurredAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 - 39 * 60 * 1000,
      ).toISOString(),
      performedBy: "Juan Pérez",
    },
    {
      id: "activity-003",
      type: "participant_joined",
      description: "Alexis Hernández se incorporó como participante",
      occurredAt: new Date(
        Date.now() - 7 * 60 * 60 * 1000 + 15 * 60 * 1000,
      ).toISOString(),
      performedBy: "Alexis Hernández",
    },
    {
      id: "activity-004",
      type: "operation_registered",
      description: "María López registró el retiro RET-00120",
      occurredAt: new Date(
        Date.now() - 3 * 60 * 60 * 1000 - 20 * 60 * 1000,
      ).toISOString(),
      performedBy: "María López",
    },
    {
      id: "activity-005",
      type: "operation_registered",
      description: "Juan Pérez registró el retiro RET-00121",
      occurredAt: new Date(
        Date.now() - 2 * 60 * 60 * 1000 - 45 * 60 * 1000,
      ).toISOString(),
      performedBy: "Juan Pérez",
    },
    {
      id: "activity-006",
      type: "operation_registered",
      description: "María López registró un retiro del propietario",
      occurredAt: new Date(
        Date.now() - 1 * 60 * 60 * 1000 - 10 * 60 * 1000,
      ).toISOString(),
      performedBy: "María López",
    },
  ],
};

export const availableUsers: Omit<
  ShiftParticipant,
  "id" | "joinedAt" | "leftAt" | "status" | "shiftRole"
>[] = [
  {
    userId: "pedro-ramirez",
    name: "Pedro Ramírez",
    systemRole: "employee",
  },
];

export const closedShifts: Shift[] = [
  {
    id: "shift-002",
    name: "Turno vespertino",
    status: "closed",
    responsibleUserId: "user-002",
    startedAt: new Date(
      Date.now() - 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000 - 10 * 60 * 1000,
    ).toISOString(),
    endedAt: new Date(
      Date.now() - 24 * 60 * 60 * 1000 - 10 * 60 * 1000,
    ).toISOString(),
    currentDuration: "6 h 10 min",
    openingBalance: 5000,
    closingDifference: 0,
    closingResult: "balanced",
    participants: [
      {
        id: "participant-004",
        userId: "user-002",
        name: "Carlos Ruiz",
        systemRole: "employee",
        shiftRole: "shift_responsible",
        joinedAt: new Date(
          Date.now() -
            24 * 60 * 60 * 1000 -
            6 * 60 * 60 * 1000 -
            10 * 60 * 1000,
        ).toISOString(),
        status: "active",
      },
    ],
    activity: [],
  },
  {
    id: "shift-003",
    name: "Turno matutino",
    status: "closed_review_required",
    responsibleUserId: "user-001",
    startedAt: new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000 - 7 * 60 * 1000,
    ).toISOString(),
    endedAt: new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000 - 7 * 60 * 1000,
    ).toISOString(),
    currentDuration: "8 h 7 min",
    openingBalance: 5000,
    closingDifference: -150,
    closingResult: "shortage",
    participants: [
      {
        id: "participant-005",
        userId: "user-001",
        name: "Ana López",
        systemRole: "employee",
        shiftRole: "shift_responsible",
        joinedAt: new Date(
          Date.now() -
            7 * 24 * 60 * 60 * 1000 -
            8 * 60 * 60 * 1000 -
            7 * 60 * 1000,
        ).toISOString(),
        status: "active",
      },
    ],
    activity: [],
  },
  {
    id: "shift-004",
    name: "Turno especial",
    status: "closed",
    responsibleUserId: "user-004",
    startedAt: new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000,
    ).toISOString(),
    endedAt: new Date(
      Date.now() -
        8 * 24 * 60 * 60 * 1000 -
        3 * 60 * 60 * 1000 -
        30 * 60 * 1000,
    ).toISOString(),
    currentDuration: "6 h 30 min",
    openingBalance: 5000,
    closingDifference: 0,
    closingResult: "balanced",
    participants: [
      {
        id: "participant-006",
        userId: "user-004",
        name: "José Martínez",
        systemRole: "owner",
        shiftRole: "shift_responsible",
        joinedAt: new Date(
          Date.now() - 8 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
      },
    ],
    activity: [],
  },
];

export const mockShifts = {
  active: activeShift,
  closed: closedShifts,
  availableUsers,
};
