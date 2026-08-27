/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Web Worker for Offloading Heavy Computations
 * Handles multi-group ledger statistics, complex budget variance formulas,
 * asynchronous CSV export transformations, and intensive search filtering
 * off the main UI thread to prevent frame drops.
 */

export interface WorkerMessage<T = any> {
  id: string;
  type: "COMPUTE_LEDGER_STATS" | "PROCESS_EXPORT_CSV" | "ASYNC_SEARCH_FILTER" | "COMPUTE_AGGREGATIONS";
  payload: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  type: string;
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

// Ensure self is treated as a Web Worker context
const ctx: Worker = self as any;

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;
  const startTime = performance.now();

  try {
    let result: any;

    switch (type) {
      case "COMPUTE_LEDGER_STATS": {
        const { requisitions = [], projects = [], churchGroups = [], fiscalYear } = payload;
        
        let totalBudget = 0;
        let totalSpent = 0;
        let totalPending = 0;
        const groupStatsMap: Record<string, {
          groupId: string;
          groupName: string;
          totalAllocated: number;
          totalSpent: number;
          totalPending: number;
          requisitionCount: number;
          projectsCount: number;
        }> = {};

        // Initialize groups
        churchGroups.forEach((g: any) => {
          groupStatsMap[g.id] = {
            groupId: g.id,
            groupName: g.name,
            totalAllocated: 0,
            totalSpent: 0,
            totalPending: 0,
            requisitionCount: 0,
            projectsCount: 0,
          };
        });

        // Tally projects
        projects.forEach((p: any) => {
          const budget = Number(p.budget) || 0;
          totalBudget += budget;
          if (p.groupId && groupStatsMap[p.groupId]) {
            groupStatsMap[p.groupId].totalAllocated += budget;
            groupStatsMap[p.groupId].projectsCount += 1;
          }
        });

        // Tally requisitions
        requisitions.forEach((r: any) => {
          if (fiscalYear && r.fiscalYear && String(r.fiscalYear) !== String(fiscalYear)) {
            return;
          }
          const amt = Number(r.amount) || 0;
          const status = r.status;

          if (status === "DISBURSED") {
            totalSpent += amt;
            if (r.groupId && groupStatsMap[r.groupId]) {
              groupStatsMap[r.groupId].totalSpent += amt;
              groupStatsMap[r.groupId].requisitionCount += 1;
            }
          } else if (status !== "REJECTED" && status !== "CANCELLED" && status !== "DRAFT") {
            totalPending += amt;
            if (r.groupId && groupStatsMap[r.groupId]) {
              groupStatsMap[r.groupId].totalPending += amt;
              groupStatsMap[r.groupId].requisitionCount += 1;
            }
          }
        });

        const remainingBudget = totalBudget - totalSpent;
        const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        result = {
          totalBudget,
          totalSpent,
          totalPending,
          remainingBudget,
          utilizationRate: Math.round(utilizationRate * 10) / 10,
          groupStats: Object.values(groupStatsMap),
        };
        break;
      }

      case "PROCESS_EXPORT_CSV": {
        const { rows = [], columns = [] } = payload;
        
        // Build header line
        const headerLine = columns.map((col: { label: string; key: string }) => `"${String(col.label).replace(/"/g, '""')}"`).join(",");
        
        // Build data lines
        const dataLines = rows.map((row: any) => {
          return columns.map((col: { label: string; key: string }) => {
            const val = row[col.key];
            if (val === null || val === undefined) return '""';
            if (typeof val === "number") return String(val);
            if (typeof val === "boolean") return val ? '"YES"' : '"NO"';
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          }).join(",");
        });

        result = [headerLine, ...dataLines].join("\r\n");
        break;
      }

      case "ASYNC_SEARCH_FILTER": {
        const { items = [], query = "", fields = [] } = payload;
        const cleanQuery = String(query).toLowerCase().trim();

        if (!cleanQuery) {
          result = items;
        } else {
          result = items.filter((item: any) => {
            return fields.some((field: string) => {
              const val = item[field];
              if (val === null || val === undefined) return false;
              return String(val).toLowerCase().includes(cleanQuery);
            });
          });
        }
        break;
      }

      case "COMPUTE_AGGREGATIONS": {
        const { requisitions = [] } = payload;
        const monthlyTotals: Record<string, number> = {};
        const statusDistribution: Record<string, number> = {};

        requisitions.forEach((r: any) => {
          const dateStr = r.submittedAt || r.createdAt || r.updatedAt;
          if (dateStr) {
            const monthKey = dateStr.slice(0, 7); // YYYY-MM
            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (Number(r.amount) || 0);
          }
          const st = r.status || "UNKNOWN";
          statusDistribution[st] = (statusDistribution[st] || 0) + 1;
        });

        result = {
          monthlyTotals,
          statusDistribution,
        };
        break;
      }

      default:
        throw new Error(`Unhandled worker task type: ${type}`);
    }

    const executionTimeMs = performance.now() - startTime;
    const response: WorkerResponse = {
      id,
      type,
      success: true,
      data: result,
      executionTimeMs,
    };

    ctx.postMessage(response);
  } catch (err: any) {
    const executionTimeMs = performance.now() - startTime;
    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: err.message || String(err),
      executionTimeMs,
    };
    ctx.postMessage(response);
  }
};
