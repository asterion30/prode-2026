// js/auth.js
import { supabase, isMock } from "./supabase-config.js";

let currentUser = null;
let currentAlias = null;
let currentAvatarUrl = null;

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

                // Obtener perfil del usuario desde la tabla users
                let { data, error } = await supabase
                    .from('users')
                    .select('alias, nombre, apellido, legajo, score, avatar_url, is_banned')
                    .eq('id', currentUser.id)
                    .single();

                let score = 0;

                if (data && data.is_banned) {
                    console.warn("Usuario bloqueado intentando acceder.");
                    await supabase.auth.signOut();
                    alert("Tu cuenta ha sido inhabilitada. Si crees que es un error, contacta al administrador.");
                    onUserChange(null, null, 0);
                    return;
                }

                if (error && error.code === 'PGRST116') {
                    // El perfil no existe aún — lo creamos con los datos del registro
                    const meta = currentUser.user_metadata || {};
                    const nombre   = meta.nombre   || '';
                    const apellido = meta.apellido  || '';
                    const legajo   = meta.legajo    || '';
                    const alias    = (nombre + ' ' + apellido).trim() || currentUser.email?.split('@')[0] || 'Usuario';

                    const { error: upsertErr } = await supabase.from('users').upsert({
                        id: currentUser.id,
                        alias,
                        nombre,
                        apellido,
                        legajo,
                        score: 0,
                        is_banned: false
                    });

                    if (upsertErr) {
                        console.error("Fallo al crear perfil. Forzando cierre de sesión.", upsertErr);
                        await supabase.auth.signOut();
                        onUserChange(null, null, 0);
                        return;
                    }

                    currentAlias = alias;
                    score = 0;

                } else if (data && !error) {
                    currentAlias = data.alias || (data.nombre + ' ' + data.apellido).trim() || 'Usuario';
                    score = data.score || 0;
                    currentAvatarUrl = data.avatar_url || null;

                    // Si el perfil no tiene nombre (usuario antiguo), actualizamos desde metadata si está disponible
                    if (!data.nombre && currentUser.user_metadata?.nombre) {
                        const meta = currentUser.user_metadata;
                        const nombre   = meta.nombre   || '';
                        const apellido = meta.apellido  || '';
                        const legajo   = meta.legajo    || data.legajo || '';
                        const alias    = (nombre + ' ' + apellido).trim() || data.alias;

                        await supabase.from('users').update({ nombre, apellido, legajo, alias }).eq('id', currentUser.id);
                        currentAlias = alias;
                    }
                }

                onUserChange(currentUser, currentAlias, score, currentAvatarUrl);

            } else {
                currentUser = null;
                currentAlias = null;
                onUserChange(null, null, 0);
            }
        } catch (e) {
            console.error("Critical Auth Error:", e);
            onUserChange(null, null, 0);
        }
    };

    // Lectura inicial de sesión
    supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!error) handleSession(session);
    }).catch(err => console.error("getSession error:", err));

    // Escuchar cambios de estado de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
        handleSession(session);
    });
}

/**
 * Envía un magic link al email dado.
 * Guarda nombre, apellido y legajo en user_metadata para recuperarlos al confirmar.
 */
export async function loginWithEmail(email, nombre, apellido, legajo) {
    if (isMock) {
        const mockUid = "mock_" + Math.random().toString(36).substr(2, 9);
        const alias = (nombre + ' ' + apellido).trim() || email.split('@')[0];
        const userData = { uid: mockUid, alias, score: 0 };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userData));
        setTimeout(() => location.reload(), 500);
        return;
    }

    const nombreClean   = (nombre   || '').trim();
    const apellidoClean = (apellido || '').trim();
    const legajoClean   = (legajo   || '').trim();

    const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
            data: {
                nombre:   nombreClean,
                apellido: apellidoClean,
                legajo:   legajoClean
            }
        }
    });

    if (error) throw error;

    return { needsConfirmation: true };
}

export function getCurrentUser() {
    return { user: currentUser, alias: currentAlias, avatarUrl: currentAvatarUrl };
}

/**
 * Actualiza el avatar_url en la tabla users y en el estado local.
 */
export async function updateAvatarUrl(userId, url) {
    const { error } = await supabase
        .from('users')
        .update({ avatar_url: url })
        .eq('id', userId);
    if (!error) currentAvatarUrl = url;
    return error;
}
