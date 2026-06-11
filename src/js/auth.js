// js/auth.js
import { supabase, isMock } from "./supabase-config.js";

let currentUser = null;
let currentAlias = null;
let currentAvatarUrl = null;

const MOCK_STORAGE_KEY = "prode_mock_user";

export function initAuth(onUserChange) {
    const urlParams = new URLSearchParams(window.location.search);
    const hasMockParam = urlParams.get('mock') === 'true';
    const stored = localStorage.getItem(MOCK_STORAGE_KEY);

    if (import.meta.env.DEV && (isMock || hasMockParam || stored)) {
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
                    // El perfil no existe aún — lo creamos con los datos del proveedor social
                    const meta = currentUser.user_metadata || {};
                    
                    // Extraer nombres inteligentemente de metadatos de Google
                    const nombre = meta.nombre || meta.given_name || meta.full_name?.split(' ')[0] || '';
                    const apellido = meta.apellido || meta.family_name || meta.full_name?.split(' ').slice(1).join(' ') || '';
                    const legajo = meta.legajo || '';
                    const alias = meta.alias || (nombre + ' ' + apellido).trim() || meta.full_name || currentUser.email?.split('@')[0] || 'Usuario';
                    const avatar_url = meta.avatar_url || meta.picture || null;

                    const { error: upsertErr } = await supabase.from('users').upsert({
                        id: currentUser.id,
                        alias,
                        email: currentUser.email, // Sincronizamos email
                        nombre,
                        apellido,
                        legajo,
                        score: 0,
                        is_banned: false,
                        avatar_url
                    });

                    if (upsertErr) {
                        console.error("Fallo al crear perfil. Forzando cierre de sesión.", upsertErr);
                        await supabase.auth.signOut();
                        onUserChange(null, null, 0);
                        return;
                    }

                    currentAlias = alias;
                    currentAvatarUrl = avatar_url;
                    score = 0;

                } else if (data && !error) {
                    currentAlias = data.alias || (data.nombre + ' ' + data.apellido).trim() || 'Usuario';
                    score = data.score || 0;
                    currentAvatarUrl = data.avatar_url || null;

                    // Si el perfil no tiene nombre o avatar, y los metadatos de Google sí los tienen, los actualizamos
                    const meta = currentUser.user_metadata || {};
                    const googleAvatar = meta.avatar_url || meta.picture;
                    const googleNombre = meta.given_name || meta.full_name?.split(' ')[0];
                    const googleApellido = meta.family_name || meta.full_name?.split(' ').slice(1).join(' ');

                    let shouldUpdate = false;
                    const updates = {};

                    if (!data.nombre && googleNombre) {
                        updates.nombre = googleNombre;
                        shouldUpdate = true;
                    }
                    if (!data.apellido && googleApellido) {
                        updates.apellido = googleApellido;
                        shouldUpdate = true;
                    }
                    if (!data.avatar_url && googleAvatar) {
                        updates.avatar_url = googleAvatar;
                        currentAvatarUrl = googleAvatar;
                        shouldUpdate = true;
                    }
                    if (!data.email && currentUser.email) {
                        updates.email = currentUser.email;
                        shouldUpdate = true;
                    }

                    if (shouldUpdate) {
                        await supabase.from('users').update(updates).eq('id', currentUser.id);
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
 * Inicia sesión con un proveedor social (Google, etc)
 */
export async function signInWithSocial(provider) {
    if (isMock) {
        alert("El login social no está disponible en Modo Mock.");
        return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) throw error;
}

/**
 * Inicia sesión en modo mock con un alias dado.
 */
export function loginMockUser(alias) {
    const mockUid = "mock_" + Math.random().toString(36).substr(2, 9);
    const finalAlias = (alias || '').trim() || "Usuario Invitado";
    const userData = { uid: mockUid, alias: finalAlias, score: 0 };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userData));
    setTimeout(() => location.reload(), 500);
}

/**
 * Envía un magic link al email dado.
 * Mantenido por compatibilidad técnica.
 */
export async function loginWithEmail(email, nombre, apellido, legajo) {
    if (isMock) {
        loginMockUser(nombre + ' ' + apellido);
        return { needsConfirmation: true };
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

/**
 * Cierra la sesión (Soporta Google Auth y Mock).
 */
export async function logOut() {
    if (isMock || localStorage.getItem(MOCK_STORAGE_KEY)) {
        localStorage.removeItem(MOCK_STORAGE_KEY);
    } else {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("Supabase signOut error, forcing local cleanup:", e);
        }
        // Limpieza forzada de tokens de Supabase por si falla la API
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
                localStorage.removeItem(key);
            }
        }
    }
    location.reload();
}
