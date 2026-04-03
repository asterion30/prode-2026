// js/auth.js
import { supabase, isMock } from "./supabase-config.js";

let currentUser = null;
let currentAlias = null;

const MOCK_STORAGE_KEY = "prode_mock_user";

export function initAuth(onUserChange) {
    if (isMock) {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY);
        if (stored) {
            const user = JSON.parse(stored);
            currentUser = { id: user.uid };
            currentAlias = user.alias;
            onUserChange(currentUser, currentAlias, user.score);
        } else {
            onUserChange(null, null, 0);
        }
        return;
    }

    const handleSession = async (session) => {
        try {
            if (session && session.user) {
                currentUser = session.user;
                
                // Get user alias and score from DB
                let { data, error } = await supabase
                    .from('users')
                    .select('alias, score')
                    .eq('id', currentUser.id)
                    .single();
                    
                let score = 0;
                
                // Si la fila no existe (RLS bloqueó la creación durante el signup sin sesión), la creamos ahora
                if (error && error.code === 'PGRST116') {
                    const fallbackAlias = currentUser.user_metadata?.alias || currentUser.email?.split('@')[0] || "Usuario";
                    await supabase.from('users').upsert({
                        id: currentUser.id,
                        alias: fallbackAlias,
                        score: 0
                    });
                    currentAlias = fallbackAlias;
                    score = 0;
                } else if (data && !error) {
                    currentAlias = data.alias;
                    score = data.score || 0;
                }
                onUserChange(currentUser, currentAlias, score);
            } else {
                currentUser = null;
                currentAlias = null;
                onUserChange(null, null, 0);
            }
        } catch (e) {
            console.error("Critical Auth Error:", e);
            onUserChange(null, null, 0); // Falla suavemente a la pantalla de login
        }
    };

    // 1. Forzar una lectura manual rápida de la sesión en caso de que el listener no dispare
    supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!error) handleSession(session);
    }).catch(err => console.error("getSession error:", err));

    // 2. Escuchar cambios
    supabase.auth.onAuthStateChange(async (event, session) => {
        // En v2, INITIAL_SESSION a veces dispara después, handleSession es idempotente
        handleSession(session);
    });
}

// In Supabase we simulate email/legajo login as email/password.
export async function loginWithEmailLegajo(email, legajo, alias) {
    // Supabase requiere un mínimo de 6 caracteres para la contraseña.
    // Rellenamos el legajo con ceros a la izquierda si es necesario (ej: 1234 -> 001234)
    const secureLegajo = legajo.trim().padStart(6, '0');

    if (isMock) {
        const mockUid = "mock_" + Math.random().toString(36).substr(2, 9);
        // Store provided alias or a default one
        const finalAlias = alias ? alias.trim() : email.split('@')[0];
        const userData = { uid: mockUid, alias: finalAlias, score: 0 };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userData));
        setTimeout(() => location.reload(), 500);
        return;
    }

    // Try to sign in first
    let { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: secureLegajo
    });

    // If invalid login credentials, maybe the user doesn't exist. Attempt sign up
    if (error && error.message.includes("Invalid login credentials")) {
        const finalAlias = alias ? alias.trim() : email.split('@')[0];
        
        const signUpRes = await supabase.auth.signUp({
            email: email.trim(),
            password: secureLegajo,
            options: {
                data: {
                    alias: finalAlias
                }
            }
        });
        
        if (signUpRes.error) throw signUpRes.error;
        data = signUpRes.data;
        
        // Wait briefly for auth trigger or manual insert
        if (data.user) {
            if (!data.session) {
                return { needsConfirmation: true };
            }
        }
    } else if (error) {
        throw error;
    }
    
    return { needsConfirmation: false };
}

export function getCurrentUser() {
    return { user: currentUser, alias: currentAlias };
}
