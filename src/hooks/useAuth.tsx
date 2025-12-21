import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AppRole = 'admin' | 'hr' | 'tl' | 'member';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  allowedDomains: string[];
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  canEditShifts: boolean;
  isHR: boolean;
  isTL: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(['leapswitch.com']);

  // Fetch allowed domains on mount using secure function
  useEffect(() => {
    const fetchAllowedDomains = async () => {
      try {
        const { data, error } = await supabase.rpc('get_allowed_google_domains');

        if (error) throw error;
        
        if (data && Array.isArray(data)) {
          setAllowedDomains(data);
        }
      } catch (error) {
        console.error('Error fetching allowed domains:', error);
        // Fall back to default
        setAllowedDomains(['leapswitch.com']);
      }
    };

    fetchAllowedDomains();
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          // Check if Google login is from allowed domain
          if (event === 'SIGNED_IN' && session.user.app_metadata?.provider === 'google') {
            const email = session.user.email;
            if (email) {
              const domain = email.split('@')[1];
              if (!allowedDomains.includes(domain)) {
                // Sign out if domain not allowed
                setTimeout(async () => {
                  await supabase.auth.signOut();
                  toast.error(`Only users from allowed domains (${allowedDomains.join(', ')}) can sign in with Google`);
                }, 0);
                return;
              }
            }
          }
          
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [allowedDomains]);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;
      
      const userRoles = (data || []).map(r => r.role as AppRole);
      setRoles(userRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles(['member']);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isEmailDomainAllowed = (email: string): boolean => {
    const domain = email.split('@')[1];
    return allowedDomains.includes(domain);
  };

  const signIn = async (email: string, password: string) => {
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') };
    }
    
    if (!isEmailDomainAllowed(email)) {
      return { error: new Error(`Only emails from allowed domains (${allowedDomains.join(', ')}) are permitted`) };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') };
    }
    
    if (!isEmailDomainAllowed(email)) {
      return { error: new Error(`Only emails from allowed domains (${allowedDomains.join(', ')}) are permitted`) };
    }

    if (password.length < 6) {
      return { error: new Error('Password must be at least 6 characters') };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Use the first allowed domain for Google's hd parameter
    // This hints to Google to show only accounts from this domain
    const primaryDomain = allowedDomains[0] || 'leapswitch.com';
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          hd: primaryDomain, // Restrict to primary domain (hint only)
        },
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signInWithOtp = async (email: string) => {
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') };
    }
    
    if (!isEmailDomainAllowed(email)) {
      return { error: new Error(`Only emails from allowed domains (${allowedDomains.join(', ')}) are permitted`) };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const resetPassword = async (email: string) => {
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    if (newPassword.length < 6) {
      return { error: new Error('Password must be at least 6 characters') };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
    }
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  const isAdmin = roles.includes('admin');
  const isHR = roles.includes('hr') || isAdmin;
  const isTL = roles.includes('tl');
  const canEditShifts = isHR || isTL;

  const value = {
    user,
    session,
    loading,
    roles,
    allowedDomains,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithOtp,
    verifyOtp,
    resetPassword,
    updatePassword,
    signOut,
    canEditShifts,
    isHR,
    isTL,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
