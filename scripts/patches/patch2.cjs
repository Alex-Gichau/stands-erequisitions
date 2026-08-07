const fs = require('fs');
let content = fs.readFileSync('src/contexts/RequisitionContext.tsx', 'utf8');

function replaceBetween(startStr, endStr, newContent) {
  const startIndex = content.indexOf(startStr);
  if (startIndex === -1) {
    console.log("Could not find start:", startStr);
    return;
  }
  const endIndex = content.indexOf(endStr, startIndex + startStr.length);
  if (endIndex === -1) {
    console.log("Could not find end:", endStr);
    return;
  }
  const actualEndIndex = endIndex + endStr.length;
  content = content.substring(0, startIndex) + newContent + content.substring(actualEndIndex);
}

const resetPwdStart = '  const adminResetUserPassword = useCallback(async (email: string) => {';
replaceBetween(resetPwdStart, '  const deleteUser =', `  const adminResetUserPassword = useCallback(async (email: string) => {
    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
      throw new Error("Unauthorized: Only Admins can reset user passwords.");
    }
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    await addSystemLog("PASSWORD_RESET_TRIGGERED", \`Admin triggered password reset email for user: \${email}\`, { email });
  }, [currentUser, addSystemLog]);
  
  const deleteUser =`);

// Also fix auth = { currentUser: null }; which is still there!
const authStubsStart = 'const auth = { currentUser: null };';
const authStubsEnd = 'const sendPasswordResetEmail = async (a: any, e: string) => {};';
replaceBetween(authStubsStart, authStubsEnd, `// Supabase Auth usages replaced.
// auth stubs removed`);

fs.writeFileSync('src/contexts/RequisitionContext.tsx', content);

