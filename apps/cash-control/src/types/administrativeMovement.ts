export type AdministrativeMovementType = "income" | "withdrawal";

export type AdministrativeResourceType = "cash" | "bank";

export type AdministrativeMovementStatus = "active" | "corrected";

export type AdministrativeMovement = {
  id: string;
  movementType: AdministrativeMovementType;
  resourceType: AdministrativeResourceType;
  resourceId: string;
  resourceName: string;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  explanation?: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  shiftId?: string;
  status: AdministrativeMovementStatus;
  isEdited: boolean;
  editedAt?: string;
  editedByUserId?: string;
  editedByUserName?: string;
  editReason?: string;
  previousAmountCents?: number;
  previousResourceId?: string;
  previousResourceName?: string;
  previousMovementType?: AdministrativeMovementType;
};

export type AdministrativeResource = {
  id: string;
  name: string;
  type: AdministrativeResourceType;
  availableCents: number;
  realBalanceCents: number;
  reservedCents: number;
};

export type AdministrativeMovementFilters = {
  search: string;
  movementType: "all" | AdministrativeMovementType;
  resourceId: "all" | string;
  userName: "all" | string;
  date: string;
};

export type AdministrativeMovementSummary = {
  incomeTodayCents: number;
  withdrawalTodayCents: number;
  netTodayCents: number;
  movementsToday: number;
};
