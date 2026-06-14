// src/js/leagues.js
import { supabase } from "./supabase-config.js";

// Helper to check if it's a mock user ID
const isMockId = (id) => id && String(id).startsWith("mock_");

// Local storage keys for mock leagues
const MOCK_LEAGUES_KEY = "prode_mock_leagues";
const MOCK_MEMBERS_KEY = "prode_mock_league_members";

function getMockLeagues() {
    return JSON.parse(localStorage.getItem(MOCK_LEAGUES_KEY) || "[]");
}

function saveMockLeagues(leagues) {
    localStorage.setItem(MOCK_LEAGUES_KEY, JSON.stringify(leagues));
}

function getMockMembers() {
    return JSON.parse(localStorage.getItem(MOCK_MEMBERS_KEY) || "[]");
}

function saveMockMembers(members) {
    localStorage.setItem(MOCK_MEMBERS_KEY, JSON.stringify(members));
}

/**
 * Crea una nueva Liga Legendaria
 */
export async function createLeague(userId, name, description, prizes) {
    if (isMockId(userId)) {
        const mockLeagues = getMockLeagues();
        const newLeague = {
            id: "mock_league_" + Math.random().toString(36).substr(2, 9),
            name,
            description,
            prizes,
            invite_code: "MOCK" + Math.floor(1000 + Math.random() * 9000),
            owner_id: userId
        };
        mockLeagues.push(newLeague);
        saveMockLeagues(mockLeagues);

        const mockMembers = getMockMembers();
        mockMembers.push({
            group_id: newLeague.id,
            user_id: userId,
            status: 'active'
        });
        saveMockMembers(mockMembers);

        return newLeague;
    }

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
    if (isMockId(userId)) {
        const mockLeagues = getMockLeagues();
        const league = mockLeagues.find(l => String(l.invite_code).toLowerCase() === String(inviteCode).toLowerCase().trim());
        if (!league) throw new Error("Código de invitación no válido.");

        const mockMembers = getMockMembers();
        const alreadyMember = mockMembers.some(m => m.group_id === league.id && m.user_id === userId);
        if (alreadyMember) throw new Error("Ya enviaste una solicitud a este grupo o ya eres miembro.");

        mockMembers.push({
            group_id: league.id,
            user_id: userId,
            status: 'active'
        });
        saveMockMembers(mockMembers);

        return league;
    }

    const { data: league, error: searchError } = await supabase
        .from('user_groups')
        .select('id')
        .ilike('invite_code', inviteCode)
        .single();

    if (searchError) throw new Error("Código de invitación no válido.");

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
    if (isMockId(userId)) {
        const mockMembers = getMockMembers();
        const mockLeagues = getMockLeagues();

        const userMemberships = mockMembers.filter(m => m.user_id === userId);
        return userMemberships.map(m => {
            const league = mockLeagues.find(l => l.id === m.group_id);
            return {
                status: m.status,
                user_groups: league
            };
        }).filter(item => item.user_groups);
    }

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
    if (String(leagueId).startsWith("mock_league_")) {
        const mockMembers = getMockMembers();
        const leagueMembers = mockMembers.filter(m => m.group_id === leagueId);
        
        // Return members mapped with mock user profile data
        const mockUserStr = localStorage.getItem("prode_mock_user");
        const mockUser = mockUserStr ? JSON.parse(mockUserStr) : null;

        // Load mock standings
        const { MOCK_RANKING } = await import("./ranking.js");
        
        const allStandings = [...MOCK_RANKING];
        if (mockUser) {
            allStandings.push({ alias: mockUser.alias, score: mockUser.score || 0, id: mockUser.uid });
        }

        const members = leagueMembers.map(m => {
            let usr = allStandings.find(u => u.id === m.user_id || u.alias === m.user_id);
            if (!usr && mockUser && m.user_id === mockUser.uid) {
                usr = { alias: mockUser.alias, score: mockUser.score || 0, id: mockUser.uid };
            }
            if (!usr) {
                usr = { id: m.user_id, alias: "Usuario Prueba", score: 0 };
            }
            return {
                id: usr.id || usr.alias,
                alias: usr.alias,
                nombre: usr.nombre || usr.alias.split(' ')[0],
                apellido: usr.apellido || usr.alias.split(' ')[1] || '',
                avatar_url: usr.avatar_url || null,
                score: usr.score,
                status: m.status
            };
        }).sort((a, b) => (b.score || 0) - (a.score || 0));

        return members;
    }

    const { data: membersData, error: memError } = await supabase
        .from('group_members')
        .select('user_id, status')
        .eq('group_id', leagueId);
        
    if (memError) throw memError;
    if (!membersData || membersData.length === 0) return [];

    const userIds = membersData.map(m => m.user_id);

    const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, alias, nombre, apellido, avatar_url, score')
        .in('id', userIds);

    if (usersError) throw usersError;

    const members = membersData.map(m => {
        const u = usersData.find(usr => usr.id === m.user_id);
        return {
            ...u,
            status: m.status
        };
    }).filter(m => m.id)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    return members;
}

/**
 * Elimina a un miembro de la liga
 */
export async function removeLeagueMember(leagueId, userIdToRemove) {
    if (String(leagueId).startsWith("mock_league_")) {
        const mockMembers = getMockMembers();
        const filtered = mockMembers.filter(m => !(m.group_id === leagueId && m.user_id === userIdToRemove));
        saveMockMembers(filtered);
        return;
    }

    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', leagueId)
        .eq('user_id', userIdToRemove);

    if (error) throw error;
}
