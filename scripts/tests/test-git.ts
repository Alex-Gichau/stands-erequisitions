import { execSync } from 'child_process';

try {
  const status = execSync('git status', { encoding: 'utf8' });
  console.log("GIT STATUS:\n", status);
  
  const diff = execSync('git diff src/contexts/RequisitionContext.tsx', { encoding: 'utf8' });
  console.log("GIT DIFF REQUISITIONCONTEXT:\n", diff.substring(0, 1000));
} catch (err: any) {
  console.error("Git error:", err.message);
}
