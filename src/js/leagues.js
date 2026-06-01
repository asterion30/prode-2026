// src/js/leagues.js
import { supabase } from "./supabase-config.js";

/**
 * Crea una nueva Liga Legendaria
 */
export async function createLeague(userId, name, description, prizes) {
    const { data, error } = await supabase
        .from('user_groups')
        .insert({
            name,
            description,
            prizes,
            owner_id: userId
        })
        .select()
        .single();

    if (error) throw error;

    // Al crearla, el dueño se une automáticamente como 'active'
    await supabase.from('group_members').insert({
        group_id: data.id,
        user_id: userId,
        status: 'active'
    });

    return data;
}

/**
 * Solicita unirse a una liga mediante código
 */
export async function joinLeagueByCode(userId, inviteCode) {
    // 1. Buscar la liga por código
    const { data: league, error: searchError } = await supabase
        .from('user_groups')
        .select('id')
        .ilike('invite_code', inviteCode)
        .single();

    if (searchError) throw new Error("Código de invitación no válido.");

    // 2. Insertar miembro directamente como activo
    const { error: joinError } = await supabase
        .from('group_members')
        .insert({
            group_id: league.id,
            user_id: userId,
            status: 'active'
        });

    if (joinError) throw new Error("Ya enviaste una solicitud a este grupo o ya eres miembro.");

    return league;
}

/**
 * Obtiene las ligas a las que pertenece el usuario
 */
export async function fetchUserLeagues(userId) {
    const { data, error } = await supabase
        .from('group_members')
        .select(`
            status,
            user_groups (
                id,
                name,
                description,
                prizes,
                invite_code,
                owner_id
            )
        `)
        .eq('user_id', userId);
    
    if (error) throw error;
    return data;
}

/**
 * Obtiene los detalles de una liga y sus miembros (ranking)
 */
export async function fetchLeagueDetails(leagueId) {
    // Obtenemos los miembros y hacemos join con la tabla public.users para traer sus puntajes
    const { data, error } = await supabase
        .from('group_members')
        .select(`
            user_id,
            status,
            users ( id, alias, nombre, apellido, avatar_url, score )
        `)
        .eq('group_id', leagueId);
        
    if (error) throw error;

    // Aplanamos y ordenamos por puntaje
    const members = data
        .filter(m => m.users) // Por si algún usuario fue borrado de public.users
        .map(m => ({
            ...m.users,
            status: m.status
        }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    return members;
}

/**
 * Elimina a un miembro de la liga (solo el creador debería llamar esto)
 */
export async function removeLeagueMember(leagueId, userIdToRemove) {
    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', leagueId)
        .eq('user_id', userIdToRemove);

    if (error) throw error;
}
