import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { StatusScreen } from "../components/StatusScreen";
import { computeAvailableOfferings, resolveCurrentPackageSource, summarizePackageSource } from "../lib/data";
import type { CurrentPackageSummary } from "../lib/data";
import type { OfferingMapping, Tenor } from "../types";
import type { AddSubjectContextValue, ScheduleChoice, TenorPreview } from "./addSubjectContext";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; summary: CurrentPackageSummary; currentOfferings: OfferingMapping[]; availableOfferings: OfferingMapping[] };

export function AddSubjectFlowLayout() {
  const { userId } = useParams<{ userId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [scheduleChoices, setScheduleChoices] = useState<Record<string, ScheduleChoice>>({});
  const [tenorPreview, setTenorPreview] = useState<TenorPreview | null>(null);
  const [chosenTenor, setChosenTenor] = useState<Tenor | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    resolveCurrentPackageSource(userId)
      .then(async (source) => {
        const summary = summarizePackageSource(source);
        if (!summary) throw new Error("Data paket tidak ditemukan.");
        const { currentOfferings, availableOfferings } = await computeAvailableOfferings(summary);
        if (cancelled) return;
        setState({ kind: "ready", summary, currentOfferings, availableOfferings });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ kind: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.kind === "loading") return <StatusScreen title="Memuat..." message="Mohon tunggu sebentar." />;
  if (state.kind === "error") return <StatusScreen title="Terjadi kesalahan" message={state.message} />;

  const { summary, currentOfferings, availableOfferings } = state;

  const context: AddSubjectContextValue = {
    userId: userId!,
    userName: summary.userName,
    grade: summary.grade,
    sourceKind: summary.sourceKind,
    currentOfferings,
    availableOfferings,
    selectedOfferingIds,
    setSelectedOfferingIds,
    scheduleChoices,
    setScheduleChoices,
    tenorPreview,
    setTenorPreview,
    chosenTenor,
    setChosenTenor,
  };

  return <Outlet context={context} />;
}
