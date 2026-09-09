"use client";
import type { ShiftActivity, ShiftActivityType } from "@/types/shift";

const activityDotColors: Record<ShiftActivityType, string> = {
  shift_started: "bg-emerald-500",
  participant_joined: "bg-sky-500",
  participant_left: "bg-amber-500",
  responsibility_transferred: "bg-violet-500",
  operation_registered: "bg-slate-500",
  deposit_registered: "bg-emerald-500",
  withdrawal_registered: "bg-sky-500",
  pending_withdrawal_registered: "bg-amber-500",
  pending_withdrawal_delivered: "bg-emerald-500",
  funds_movement: "bg-slate-500",
  operation_corrected: "bg-blue-500",
  operation_clarified: "bg-amber-500",
  closing_started: "bg-amber-600",
  shift_closed: "bg-emerald-700",
};

export function ShiftActivityList({
  activities,
}: {
  activities: ShiftActivity[];
}) {
  return (
    <div className="mt-4 space-y-4">
      {activities.map((activity, index) => {
        const occurredAt = new Date(activity.occurredAt);
        const time = occurredAt.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const isLast = index === activities.length - 1;
        const dotColor = activityDotColors[activity.type] ?? "bg-slate-400";

        return (
          <div key={activity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
              {!isLast && (
                <div className="mt-1 h-full w-px flex-1 bg-slate-200" />
              )}
            </div>

            <div className="flex-1 pb-4">
              <p className="text-xs font-medium text-slate-500">
                {occurredAt.toLocaleDateString("es-MX")} · {time}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {activity.description}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {[activity.performedBy, activity.reference, activity.detail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
