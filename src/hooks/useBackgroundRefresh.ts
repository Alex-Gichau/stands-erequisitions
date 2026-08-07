import { useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";

export function useBackgroundRefresh(intervalMs: number = 60000) {
  const { systemSettings, currentUser, projects, ledgerBooks } = useRequisitions();

  useEffect(() => {
    if (!currentUser) return;

    const runValidation = async () => {
      // Just an example logic to optionally refetch or re-validate if needed in the background.
      // Supabase real-time listeners usually handle data freshness, but periodically
      // we can do a sanity check on user status/roles if we have custom claims endpoints,
      // or optionally force a re-calc or log a heartbeat.
      try {
        console.log(`[Validation Task] Checking active FY: ${systemSettings.currentFiscalYear}`);
        console.log(`[Validation Task] User Role active: ${currentUser.role}`);
      } catch (err) {
        console.warn("[Validation Task] Error checking background state: ", err);
      }
    };

    runValidation(); // initial immediate run
    const intervalId = setInterval(runValidation, intervalMs);

    return () => clearInterval(intervalId);
  }, [systemSettings.currentFiscalYear, currentUser, intervalMs]);
}
