import type { WorkstationData, ActivityEvent, RegisteredUser, Participant } from "./types";

export const mockRegisteredUsers: RegisteredUser[] = [
  { userId: "maria-lopez", userName: "María López", pin: "1234", systemRole: "owner" },
  { userId: "juan-perez", userName: "Juan Pérez", pin: "1234", systemRole: "employee" },
  { userId: "alexis-hernandez", userName: "Alexis Hernández", pin: "1234", systemRole: "employee" },
  { userId: "pedro-ramirez", userName: "Pedro Ramírez", pin: "1234", systemRole: "employee" },
  { userId: "carlos-martinez", userName: "Carlos Martínez", pin: "123456", systemRole: "owner" },
];

export const mockParticipants: Participant[] = [
  {
    id: "part-001",
    userId: "maria-lopez",
    userName: "María López",
    participationType: "responsible",
    status: "active",
    startedAt: "08:02",
  },
  {
    id: "part-002",
    userId: "juan-perez",
    userName: "Juan Pérez",
    participationType: "support",
    status: "active",
    startedAt: "10:15",
  },
];

export const mockWorkstation: WorkstationData = {
  id: "caja-principal",
  name: "Caja principal",
  status: "open",
  openedAt: "08:02",
  trustStatus: "reliable",
  responsibleUserId: "maria-lopez",
  participants: mockParticipants,
};

export const mockActivityEvents: ActivityEvent[] = [
  {
    time: "11:40",
    description: "Pedro inició participación como apoyo.",
  },
  {
    time: "10:15",
    description: "Juan inició participación.",
  },
  {
    time: "08:02",
    description: "María abrió la estación y aceptó la responsabilidad.",
  },
];