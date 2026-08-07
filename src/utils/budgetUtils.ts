import { Project, Requisition, RequisitionStatus } from "../types";

export const COMMITTED_REQUISITION_STATUSES = [
  RequisitionStatus.SUBMITTED,
  RequisitionStatus.APPROVED_L1,
  RequisitionStatus.ESCALATED,
  RequisitionStatus.APPROVED_L2,
  RequisitionStatus.DISBURSED
];

export interface ProjectUtilization {
  usedAmount: number;     // Committed + Spent
  spentAmount: number;    // Disbursed only
  remainingAmount: number; // Allocated - usedAmount
  percentage: number;     // (usedAmount / allocatedBudget) * 100
}

export function getProjectRequisitions(
  project: Project,
  requisitions: Requisition[]
): Requisition[] {
  return requisitions.filter(r => 
    r.projectId === project.id || 
    ((r.groupId === project.groupId || r.groupName === project.name || r.groupId === project.name || r.groupName === project.groupId) && 
     (r.fiscalYear === project.fiscalYear || (!r.fiscalYear && project.fiscalYear === 2026)))
  );
}

export function calculateProjectUtilization(
  project: Project, 
  requisitions: Requisition[]
): ProjectUtilization {
  const projectReqs = getProjectRequisitions(project, requisitions);
  
  const usedAmount = projectReqs
    .filter(r => COMMITTED_REQUISITION_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.amount, 0);

  const spentAmount = projectReqs
    .filter(r => r.status === RequisitionStatus.DISBURSED)
    .reduce((sum, r) => sum + r.amount, 0);

  const remainingAmount = Math.max(0, project.allocatedBudget - usedAmount);
  const percentage = project.allocatedBudget > 0 ? (usedAmount / project.allocatedBudget) * 100 : 0;

  return {
    usedAmount,
    spentAmount,
    remainingAmount,
    percentage
  };
}
