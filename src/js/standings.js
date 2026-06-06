// js/standings.js
// Calcula la tabla de posiciones de la Fase de Grupos a partir de los partidos

// Distribución exacta de los 12 grupos de la Copa del Mundo 2026
// Derivada cruzando las 3 jornadas del fixture (partidos simultáneos de jornada 3 = mismo grupo)
export const GROUP_MAP = {
    'A': [
        { team: 'México',             flag: 'mx' },
        { team: 'Sudáfrica',          flag: 'za' },
        { team: 'República de Corea', flag: 'kr' },
        { team: 'República Checa',    flag: 'cz' },
    ],
    'B': [
        { team: 'Canadá',             flag: 'ca' },
        { team: 'Bosnia y Herzegovina', flag: 'ba' },
        { team: 'Catar',              flag: 'qa' },
        { team: 'Suiza',              flag: 'ch' },
    ],
    'C': [
        { team: 'Brasil',             flag: 'br' },
        { team: 'Marruecos',          flag: 'ma' },
        { team: 'Escocia',            flag: 'gb-sct' },
        { team: 'Haití',              flag: 'ht' },
    ],
    'D': [
        { team: 'Estados Unidos',     flag: 'us' },
        { team: 'Paraguay',           flag: 'py' },
        { team: 'Australia',          flag: 'au' },
        { team: 'Turquía',            flag: 'tr' },
    ],
    'E': [
        { team: 'Alemania',           flag: 'de' },
        { team: 'Curazao',            flag: 'cw' },
        { team: 'Costa de Marfil',    flag: 'ci' },
        { team: 'Ecuador',            flag: 'ec' },
    ],
    'F': [
        { team: 'Países Bajos',       flag: 'nl' },
        { team: 'Japón',              flag: 'jp' },
        { team: 'Suecia',             flag: 'se' },
        { team: 'Túnez',              flag: 'tn' },
    ],
    'G': [
        { team: 'Bélgica',            flag: 'be' },
        { team: 'Egipto',             flag: 'eg' },
        { team: 'RI de Irán',         flag: 'ir' },
        { team: 'Nueva Zelanda',      flag: 'nz' },
    ],
    'H': [
        { team: 'España',             flag: 'es' },
        { team: 'Cabo Verde',         flag: 'cv' },
        { team: 'Arabia Saudí',       flag: 'sa' },
        { team: 'Uruguay',            flag: 'uy' },
    ],
    'I': [
        { team: 'Francia',            flag: 'fr' },
        { team: 'Senegal',            flag: 'sn' },
        { team: 'Irak',               flag: 'iq' },
        { team: 'Noruega',            flag: 'no' },
    ],
    'J': [
        { team: 'Argentina',          flag: 'ar' },
        { team: 'Argelia',            flag: 'dz' },
        { team: 'Austria',            flag: 'at' },
        { team: 'Jordania',           flag: 'jo' },
    ],
    'K': [
        { team: 'Portugal',           flag: 'pt' },
        { team: 'RD Congo',           flag: 'cd' },
        { team: 'Uzbekistán',         flag: 'uz' },
        { team: 'Colombia',           flag: 'co' },
    ],
    'L': [
        { team: 'Inglaterra',         flag: 'gb-eng' },
        { team: 'Croacia',            flag: 'hr' },
        { team: 'Ghana',              flag: 'gh' },
        { team: 'Panamá',             flag: 'pa' },
    ],
};

/**
 * A partir de la lista de partidos (solo los de stage='groups' y status='finished'),
 * calcula la tabla de posiciones de cada grupo.
 *
 * Retorna un objeto { 'A': [...equipos ordenados], 'B': [...], ... }
 * Cada equipo tiene: { team, flag, pj, g, e, p, gf, gc, dg, pts }
 */
export function calculateStandings(matches) {
    // Inicializar stats por equipo
    const stats = {};  // { 'NombreEquipo': { team, flag, pj,g,e,p,gf,gc,dg,pts } }

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

        // Inicializar si por algún motivo el equipo no estaba en el mapa
        if (!stats[home]) stats[home] = { team: home, flag: 'un', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        if (!stats[away]) stats[away] = { team: away, flag: 'un', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };

        // Local
        stats[home].pj++;
        stats[home].gf += hg;
        stats[home].gc += ag;

        // Visitante
        stats[away].pj++;
        stats[away].gf += ag;
        stats[away].gc += hg;

        if (hg > ag) {
            stats[home].g++;  stats[home].pts += 3;
            stats[away].p++;
        } else if (ag > hg) {
            stats[away].g++;  stats[away].pts += 3;
            stats[home].p++;
        } else {
            stats[home].e++;  stats[home].pts += 1;
            stats[away].e++;  stats[away].pts += 1;
        }

        // Recalcular DG
        stats[home].dg = stats[home].gf - stats[home].gc;
        stats[away].dg = stats[away].gf - stats[away].gc;
    });

    // Construir tabla por grupo y ordenar
    const result = {};
    Object.entries(GROUP_MAP).forEach(([groupName, teams]) => {
        const groupStats = teams.map(({ team, flag }) =>
            stats[team] || { team, flag, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }
        );

        // Ordenar: Pts DESC → DG DESC → GF DESC → nombre ASC
        groupStats.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg  !== a.dg)  return b.dg  - a.dg;
            if (b.gf  !== a.gf)  return b.gf  - a.gf;
            return a.team.localeCompare(b.team, 'es');
        });

        result[groupName] = groupStats;
    });

    return result;
}
