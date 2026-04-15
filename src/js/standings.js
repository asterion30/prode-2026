// js/standings.js
// Calcula la tabla de posiciones de la Fase de Grupos a partir de los partidos

// Mapa de qué equipos pertenecen a cada grupo en la Copa del Mundo 2026
// Basado en el fixture cargado en la BD
export const GROUP_MAP = {
    'A': [
        { team: 'México',            flag: 'mx' },
        { team: 'Sudáfrica',         flag: 'za' },
        { team: 'República de Corea',flag: 'kr' },
        { team: 'República Checa',   flag: 'cz' },
    ],
    'B': [
        { team: 'Canadá',            flag: 'ca' },
        { team: 'Bosnia y Herzegovina', flag: 'ba' },
        { team: 'Catar',             flag: 'qa' },
        { team: 'Suiza',             flag: 'ch' },
    ],
    'C': [
        { team: 'Estados Unidos',    flag: 'us' },
        { team: 'Paraguay',          flag: 'py' },
        { team: 'Australia',         flag: 'au' },
        { team: 'Turquía',           flag: 'tr' },
    ],
    'D': [
        { team: 'Brasil',            flag: 'br' },
        { team: 'Marruecos',         flag: 'ma' },
        { team: 'Escocia',           flag: 'gb-sct' },
        { team: 'Haití',             flag: 'ht' },
    ],
    'E': [
        { team: 'Alemania',          flag: 'de' },
        { team: 'Países Bajos',      flag: 'nl' },
        { team: 'Costa de Marfil',   flag: 'ci' },
        { team: 'Ecuador',           flag: 'ec' },
        { team: 'Curazao',           flag: 'cw' },
        { team: 'Túnez',             flag: 'tn' },
        { team: 'Japón',             flag: 'jp' },
        { team: 'Suecia',            flag: 'se' },
    ],
    'F': [
        { team: 'España',            flag: 'es' },
        { team: 'Bélgica',           flag: 'be' },
        { team: 'Arabia Saudí',      flag: 'sa' },
        { team: 'Uruguay',           flag: 'uy' },
        { team: 'Cabo Verde',        flag: 'cv' },
        { team: 'Egipto',            flag: 'eg' },
        { team: 'RI de Irán',        flag: 'ir' },
        { team: 'Nueva Zelanda',     flag: 'nz' },
    ],
    'G': [
        { team: 'Francia',           flag: 'fr' },
        { team: 'Senegal',           flag: 'sn' },
        { team: 'Irak',              flag: 'iq' },
        { team: 'Noruega',           flag: 'no' },
    ],
    'H': [
        { team: 'Argentina',         flag: 'ar' },
        { team: 'Argelia',           flag: 'dz' },
        { team: 'Austria',           flag: 'at' },
        { team: 'Jordania',          flag: 'jo' },
    ],
    'I': [
        { team: 'Portugal',          flag: 'pt' },
        { team: 'Inglaterra',        flag: 'gb-eng' },
        { team: 'Ghana',             flag: 'gh' },
        { team: 'Panamá',            flag: 'pa' },
        { team: 'Croacia',           flag: 'hr' },
        { team: 'Colombia',          flag: 'co' },
        { team: 'Uzbekistán',        flag: 'uz' },
        { team: 'RD Congo',          flag: 'cd' },
    ],
};

// Los grupos A–D y G–H tienen 4 equipos, E–F tienen 8, I tiene 8
// (el mundial 2026 tiene 12 grupos: A–L con 4 equipos cada uno en la realidad,
// pero el fixture disponible los organiza así según los datos cargados)

/**
 * A partir de la lista de partidos (solo los de stage='groups' y status='finished'),
 * calcula la tabla de posiciones de cada grupo.
 *
 * Retorna un objeto { 'A': [...equipos ordenados], 'B': [...], ... }
 * Cada equipo tiene: { team, flag, pj, g, e, p, gf, gc, dg, pts }
 */
export function calculateStandings(matches) {
    // Inicializar stats por equipo
    const stats = {}; // { 'NombreEquipo': { team, flag, pj,g,e,p,gf,gc,dg,pts } }

    // Registrar todos los equipos de los grupos
    Object.values(GROUP_MAP).forEach(teams => {
        teams.forEach(({ team, flag }) => {
            if (!stats[team]) {
                stats[team] = { team, flag, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            }
        });
    });

    // Procesar partidos terminados de fase de grupos
    const groupMatches = matches.filter(m =>
        m.stage === 'groups' &&
        m.status === 'finished' &&
        m.homeGoals !== null && m.homeGoals !== undefined && m.homeGoals !== '' &&
        m.awayGoals !== null && m.awayGoals !== undefined && m.awayGoals !== ''
    );

    groupMatches.forEach(m => {
        const hg = parseInt(m.homeGoals, 10);
        const ag = parseInt(m.awayGoals, 10);
        if (isNaN(hg) || isNaN(ag)) return;

        const home = m.homeTeam;
        const away = m.awayTeam;

        // Inicializar si no están en el mapa (por si hay equipos con nombres distintos)
        if (!stats[home]) stats[home] = { team: home, flag: 'un', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        if (!stats[away]) stats[away] = { team: away, flag: 'un', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };

        // Actualizar stats del local
        stats[home].pj++;
        stats[home].gf += hg;
        stats[home].gc += ag;
        stats[home].dg = stats[home].gf - stats[home].gc;

        // Actualizar stats del visitante
        stats[away].pj++;
        stats[away].gf += ag;
        stats[away].gc += hg;
        stats[away].dg = stats[away].gf - stats[away].gc;

        if (hg > ag) {
            // Local gana
            stats[home].g++;  stats[home].pts += 3;
            stats[away].p++;
        } else if (ag > hg) {
            // Visitante gana
            stats[away].g++;  stats[away].pts += 3;
            stats[home].p++;
        } else {
            // Empate
            stats[home].e++;  stats[home].pts += 1;
            stats[away].e++;  stats[away].pts += 1;
        }
    });

    // Construir tabla por grupo y ordenar
    const result = {};
    Object.entries(GROUP_MAP).forEach(([groupName, teams]) => {
        const groupStats = teams.map(({ team, flag }) => {
            return stats[team] || { team, flag, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });

        // Ordenar: pts DESC, dg DESC, gf DESC, nombre ASC
        groupStats.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg  !== a.dg)  return b.dg  - a.dg;
            if (b.gf  !== a.gf)  return b.gf  - a.gf;
            return a.team.localeCompare(b.team);
        });

        result[groupName] = groupStats;
    });

    return result;
}
