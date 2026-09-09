import type { ActivityEvent, Participant, WorkstationData } from "./types";

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
