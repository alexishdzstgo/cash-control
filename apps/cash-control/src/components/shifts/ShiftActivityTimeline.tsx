"use client";

import { useState } from "react";
import type { ShiftActivity } from "@/types/shift";
import { ShiftActivityList } from "./ShiftActivityList";
import { ShiftActivityModal } from "./ShiftActivityModal";

export function ShiftActivityTimeline({
  activities,
  folio,
}: {
  activities: ShiftActivity[];
  folio: string;
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="rounded-xl border border-brand-border bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        Actividad reciente del turno
      </h3>
      {activities.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No hay actividad registrada en este turno.
          </p>
        </div>
      ) : (
        <>
          <ShiftActivityList activities={activities.slice(0, 5)} />
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
            onClick={() => setShowAll(true)}
          >
            Ver toda la actividad
          </button>
        </>
      )}
      {showAll && (
        <ShiftActivityModal
          folio={folio}
          activities={activities}
          onClose={() => setShowAll(false)}
        />
      )}
    </div>
  );
}
