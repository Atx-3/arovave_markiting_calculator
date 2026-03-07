import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { loadFromSupabase, startAutoSave } from '../stores/templateStore';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const autoSaveUnsub = useRef<(() => void) | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            setLoading(false);

            // Sync data on initial load if user exists
            if (s?.user) {
                loadFromSupabase(s.user.id).then(() => {
                    autoSaveUnsub.current = startAutoSave(s.user.id);
                });
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, s) => {
                setSession(s);
                setUser(s?.user ?? null);
                setLoading(false);

                // On sign-in: load data + start auto-save
                if (s?.user) {
                    loadFromSupabase(s.user.id).then(() => {
                        // Clean up previous subscription
                        if (autoSaveUnsub.current) autoSaveUnsub.current();
                        autoSaveUnsub.current = startAutoSave(s.user.id);
                    });
                } else {
                    // On sign-out: stop auto-save
                    if (autoSaveUnsub.current) {
                        autoSaveUnsub.current();
                        autoSaveUnsub.current = null;
                    }
                }
            },
        );

        return () => {
            subscription.unsubscribe();
            if (autoSaveUnsub.current) autoSaveUnsub.current();
        };
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/admin',
            },
        });
        if (error) {
            console.error('Google sign-in error:', error.message);
            throw error;
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign-out error:', error.message);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
