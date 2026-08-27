/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Worker Client Dispatcher
 * Manages the background computation Web Worker with request-response correlation,
 * timeout safeguards, and instant synchronous microtask fallback for environments
 * where Web Workers are unavailable or restricted.
 */

import { WorkerMessage, WorkerResponse } from "../workers/computationWorker";

let workerInstance: Worker | null = null;
const pendingCallbacks = new Map<string, {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: any;
}>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL("../workers/computationWorker.ts", import.meta.url),
        { type: "module" }
      );

      workerInstance.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, success, data, error } = event.data;
        const callback = pendingCallbacks.get(id);
        if (callback) {
          clearTimeout(callback.timer);
          pendingCallbacks.delete(id);
          if (success) {
            callback.resolve(data);
          } else {
            callback.reject(new Error(error || "Worker operation failed"));
          }
        }
      };

      workerInstance.onerror = (err) => {
        console.warn("[WorkerClient] Web Worker encountered an error, fallback enabled:", err);
      };
    } catch (e) {
      console.warn("[WorkerClient] Could not instantiate Web Worker, using main-thread fallback:", e);
      workerInstance = null;
    }
  }

  return workerInstance;
}

/**
 * Dispatches a computation job to the background worker.
 */
export async function runComputationWorker<TInput = any, TOutput = any>(
  type: WorkerMessage["type"],
  payload: TInput,
  timeoutMs: number = 10000
): Promise<TOutput> {
  const worker = getWorker();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (worker) {
    return new Promise<TOutput>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingCallbacks.has(id)) {
          pendingCallbacks.delete(id);
          reject(new Error(`Worker job '${type}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      pendingCallbacks.set(id, { resolve, reject, timer });
      worker.postMessage({ id, type, payload });
    });
  }

  // Graceful fallback to non-blocking microtask execution on main thread
  return new Promise<TOutput>((resolve, reject) => {
    setTimeout(() => {
      try {
        if (type === "PROCESS_EXPORT_CSV") {
          const { rows = [], columns = [] } = payload as any;
          const headerLine = columns.map((col: any) => `"${String(col.label).replace(/"/g, '""')}"`).join(",");
          const dataLines = rows.map((row: any) =>
            columns.map((col: any) => {
              const val = row[col.key];
              if (val === null || val === undefined) return '""';
              if (typeof val === "number") return String(val);
              if (typeof val === "boolean") return val ? '"YES"' : '"NO"';
              return `"${String(val).replace(/"/g, '""')}"`;
            }).join(",")
          );
          resolve([headerLine, ...dataLines].join("\r\n") as any);
        } else if (type === "COMPUTE_LEDGER_STATS") {
          const { requisitions = [], projects = [], churchGroups = [] } = payload as any;
          let totalBudget = 0;
          let totalSpent = 0;
          projects.forEach((p: any) => totalBudget += (Number(p.budget) || 0));
          requisitions.forEach((r: any) => {
            if (r.status === "DISBURSED") totalSpent += (Number(r.amount) || 0);
          });
          resolve({
            totalBudget,
            totalSpent,
            totalPending: 0,
            remainingBudget: totalBudget - totalSpent,
            utilizationRate: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
            groupStats: []
          } as any);
        } else {
          resolve(payload as any);
        }
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}

/**
 * Offloaded background task: Asynchronously format CSV export data
 */
export async function exportCsvViaWorker(
  rows: any[],
  columns: { label: string; key: string }[]
): Promise<string> {
  return runComputationWorker<any, string>("PROCESS_EXPORT_CSV", { rows, columns });
}

/**
 * Offloaded background task: Calculate high-density ledger aggregates
 */
export async function computeLedgerStatsViaWorker(params: {
  requisitions: any[];
  projects: any[];
  churchGroups: any[];
  fiscalYear?: string | number;
}): Promise<{
  totalBudget: number;
  totalSpent: number;
  totalPending: number;
  remainingBudget: number;
  utilizationRate: number;
  groupStats: any[];
}> {
  return runComputationWorker("COMPUTE_LEDGER_STATS", params);
}
