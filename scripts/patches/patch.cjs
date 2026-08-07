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

const loginStart = '  const login = async () => {';
const loginEnd = '  };';
replaceBetween(loginStart, loginEnd, `  const login = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (error: any) {
      console.log("Login warning", error);
      throw error;
    }
  };`);

const loginEmailStart = '  const loginWithEmail = async (email: string, pass: string) => {';
const loginEmailEnd = '  };';
replaceBetween(loginEmailStart, '  const addChurchGroup =', `  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      if (data.user) {
        addSystemLog("USER_LOGIN", \`User logged in via Email/Password: \${data.user.email}\`, { authProvider: "password", email: data.user.email });
      }
    } catch (error: any) {
      try {
        fetch("/api/notify-slack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "FAILED_LOGIN_ATTEMPT",
            details: \`🛑 SECURITY ALERT: Failed login attempt for \${email}. Error: \${error.message || error.code}\`,
            performedBy: email || "Anonymous",
            timestamp: new Date().toISOString(),
            metadata: { email, errorCode: error.code || "unknown" },
            level: "abnormal"
          })
        }).catch(err => console.log("Slack Notify Failed:", err));
      } catch (e) {}
      throw error;
    }
  };

  const addChurchGroup =`);

const signupStart = '  const signupWithEmail = async (email: string, pass: string, name: string) => {';
replaceBetween(signupStart, '  const logout =', `  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      // Duplicate Detection
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      const isMock = typeof MOCK_USERS !== "undefined" ? MOCK_USERS.some((u: any) => u.email.toLowerCase() === email.toLowerCase()) : false;
      if (existingUser && !existingUser.tempPassword && !isMock) {
        throw new Error("A user with this email already exists. Please login instead.");
      }

      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            name: name,
            role: "CHURCH_GROUP" // default role
          }
        }
      });
      if (error) throw error;

      await addSystemLog("USER_PROVISIONED", \`User successfully registered and approved via Email: \${email}\`, { email });
    } catch (error: any) {
      console.log("Signup warning", error);
      if (error.message?.includes('already registered')) {
        throw new Error("This email is already registered. Please login instead.");
      }
      throw error;
    }
  };

  const logout =`);

const logoutStart = '  const logout = async (options?: { forceDirect?: boolean }) => {';
replaceBetween(logoutStart, '  const approveUser =', `  const logout = async (options?: { forceDirect?: boolean }) => {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const userEmail = user?.email;
      
      const isSessionInvalidOrExpired = options?.forceDirect || !user || !currentUser || currentUser.isSuspended || !currentUser.isActive || !currentUser.isApproved || currentUser.forceLogout;

      if (userEmail && user && !isSessionInvalidOrExpired) {
        try {
          await addSystemLog("USER_LOGOUT", \`👤 User logged out successfully: \${userEmail}\`, { email: userEmail });
        } catch (logErr) {
          console.log("Failed to log logout event", logErr);
        }
      }
      
      if (typeof window !== "undefined") {
        localStorage.removeItem("override_authorized_user_email");
      }
      await supabase.auth.signOut();
    }
  };

  const approveUser =`);

const updatePwdStart = '  const updateCurrentUserPassword = useCallback(async (newPassword: string) => {';
replaceBetween(updatePwdStart, '  const resetUserPassword =', `  const updateCurrentUserPassword = useCallback(async (newPassword: string) => {
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
      throw error;
    }
  }, [addSystemLog, triggerToast]);

  const resetUserPassword =`);

const resetPwdStart = '  const resetUserPassword = useCallback(async (email: string) => {';
replaceBetween(resetPwdStart, '  const deleteUser =', `  const resetUserPassword = useCallback(async (email: string) => {
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


const authStubsStart = 'const auth = { currentUser: null };';
const authStubsEnd = 'const sendPasswordResetEmail = async (a: any, e: string) => {};';
replaceBetween(authStubsStart, authStubsEnd, `// Supabase Auth usages replaced.
// auth stubs removed`);

// remove onAuthStateChanged usage inside useEffect
const effectStart = 'const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {';
const effectEnd = 'unsubscribeAuth();';
// Instead of replacing exactly, I will just uncomment the whole block and put my own useEffect
// Let's replace the whole UseEffect for auth sync
const authSyncStart = '  // Auth Sync\n  useEffect(() => {';
replaceBetween(authSyncStart, '  const addSystemLog =', `  // Auth Sync
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        const userEmail = session.user.email;
        // In a real app we'd fetch the user's profile from Supabase db.
        // For now, we update the currentUser with the session data.
        setCurrentUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || userEmail,
          email: userEmail,
          role: session.user.user_metadata?.role || "CHURCH_GROUP",
          isActive: true,
          isApproved: true,
          isSuspended: false
        } as any);
        setLoading(false);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addSystemLog =`);

fs.writeFileSync('src/contexts/RequisitionContext.tsx', content);

