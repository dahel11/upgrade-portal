import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { StatusScreen } from "../components/StatusScreen";
import { fetchOfferingMappingForGrade, fetchRetentionFinance } from "../lib/data";
import { parseOfferingIds } from "../lib/format";
import type { OfferingMapping, RetentionFinance, Tenor } from "../types";
import type { AddSubjectContextValue, ScheduleChoice, TenorPreview } from "./addSubjectContext";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; finance: RetentionFinance; catalog: OfferingMapping[] };

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

    fetchRetentionFinance(userId)
      .then(async (finance) => {
        if (!finance) throw new Error("Data paket tidak ditemukan.");
        const catalog = await fetchOfferingMappingForGrade(finance.grade);
        if (cancelled) return;
        setState({ kind: "ready", finance, catalog });
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

  const { finance, catalog } = state;
  const currentIds = new Set(parseOfferingIds(finance.offering_ids));
  const currentOfferings = catalog.filter((o) => currentIds.has(o.id));
  const availableOfferings = catalog.filter((o) => !currentIds.has(o.id));

  const context: AddSubjectContextValue = {
    userId: userId!,
    finance,
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
