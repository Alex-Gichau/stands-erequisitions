const fs = require('fs');
let content = fs.readFileSync('src/contexts/RequisitionContext.tsx', 'utf8');

// Replace auth.currentUser in addSystemLog
content = content.replace(
  /if \(!auth\.currentUser && !currentUser\) return;/,
  'if (!currentUser) return;'
);
content = content.replace(
  /const performedBy = currentUser \? \`\$\{currentUser\.name\} \(\$\{currentUser\.role\}\)\` : \(auth\.currentUser\?\.email \|\| "System"\);/,
  'const performedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : "System";'
);

// Replace auth.currentUser in Real-time Sync dependencies
content = content.replace(
  /if \(!auth\.currentUser \|\| !currentUserId \|\| !currentUserIsApproved \|\| currentUserIsSuspended\) \{/g,
  'if (!currentUser || !currentUserId || !currentUserIsApproved || currentUserIsSuspended) {'
);
content = content.replace(
  /\[auth\.currentUser, currentUserId, currentUserIsApproved, currentUserIsSuspended\]\);/g,
  '[currentUser, currentUserId, currentUserIsApproved, currentUserIsSuspended]);'
);

// Replace updateCurrentUserPassword
content = content.replace(
  /const updateCurrentUserPassword = useCallback\(async \(newPassword: string\) => \{[\s\S]*?\}, \[addSystemLog, triggerToast\]\);/m,
  `const updateCurrentUserPassword = useCallback(async (newPassword: string) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("No active authenticated session found.");
      }
      
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      await addSystemLog("PASSWORD_CHANGED", \`User \${session.user.email} updated their account password\`);
      triggerToast({
        type: 'SECURITY_UPDATE',
        severity: 'MEDIUM',
        message: 'Your account password has been updated successfully.',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message?.includes('requires-recent-login')) {
        throw new Error("For security, updating password requires a recent login. Please log out, log back in, and try again.");
      }
      throw error;
    }
  }, [addSystemLog, triggerToast]);`
);

// Replace adminResetUserPassword (in case patch2 failed)
content = content.replace(
  /const adminResetUserPassword = useCallback\(async \(email: string\) => \{[\s\S]*?\}, \[currentUser, addSystemLog\]\);/m,
  `const adminResetUserPassword = useCallback(async (email: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can reset user passwords.");
    }
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    await addSystemLog("PASSWORD_RESET_TRIGGERED", \`Admin triggered password reset email for user: \${email}\`, { email });
  }, [currentUser, addSystemLog]);`
);

// Remove remaining firebase auth references
content = content.replace(/const auth = \{ currentUser: null \};/g, '');
content = content.replace(/const getAuth = \(\.\.\.args: any\[\]\) => \(\{ currentUser: null, signOut: async \(\) => \{\} \}\);/g, '');
content = content.replace(/const updateProfile = async \(a: any, b: any\) => \{\};/g, '');

fs.writeFileSync('src/contexts/RequisitionContext.tsx', content);

