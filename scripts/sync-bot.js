const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SYNC_SECRET = process.env.SYNC_SECRET;

const TEAM_TRANSLATIONS = {
    "méxico": ["mexico"],
    "sudáfrica": ["south africa"],
    "república de corea": ["korea republic", "south korea", "korea"],
    "república checa": ["czech republic", "czechia"],
    "canadá": ["canada"],
    "bosnia y herzegovina": ["bosnia", "bosnia & herzegovina", "bosnia-herzegovina"],
    "catar": ["qatar"],
    "suiza": ["switzerland"],
    "brasil": ["brazil"],
    "marruecos": ["morocco"],
    "haití": ["haiti"],
    "escocia": ["scotland"],
    "australia": ["australia"],
    "turquía": ["turkey"],
    "alemania": ["germany"],
    "curazao": ["curacao", "curaçao"],
    "países bajos": ["netherlands"],
    "japón": ["japan"],
    "costa de marfil": ["ivory coast"],
    "ecuador": ["ecuador"],
    "suecia": ["sweden"],
    "túnez": ["tunisia"],
    "españa": ["spain"],
    "cabo verde": ["cape verde"],
    "bélgica": ["belgium"],
    "egipto": ["egypt"],
    "arabia saudí": ["saudi arabia"],
    "uruguay": ["uruguay"],
    "ri de irán": ["iran", "ir iran"],
    "nueva zelanda": ["new zealand"],
    "francia": ["france"],
    "senegal": ["senegal"],
    "irak": ["iraq"],
    "noruega": ["norway"],
    "argentina": ["argentina"],
    "argelia": ["algeria"],
    "austria": ["austria"],
    "jordania": ["jordan"],
    "portugal": ["portugal"],
    "rd congo": ["dr congo", "congo dr", "congo"],
    "inglaterra": ["england"],
    "croacia": ["croatia"],
    "ghana": ["ghana"],
    "panamá": ["panama"],
    "uzbekistán": ["uzbekistan"],
    "colombia": ["colombia"],
    "estados unidos": ["usa", "united states"],
    "paraguay": ["paraguay"]
};

function normalizeText(text) {
    if (!text) return "";
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function matchTeam(apiName, dbName) {
    const apiClean = normalizeText(apiName);
    const dbClean = normalizeText(dbName);
    
    // 1. Coincidencia directa o limpia
    if (dbClean === apiClean || dbClean.includes(apiClean) || apiClean.includes(dbClean)) {
        return true;
    }
    
    // 2. Coincidencia a través del diccionario de traducciones
    const dbLower = dbName.toLowerCase().trim();
    const translations = TEAM_TRANSLATIONS[dbLower];
    if (translations) {
        return translations.some(t => {
            const cleanT = normalizeText(t);
            return apiClean === cleanT || apiClean.includes(cleanT) || cleanT.includes(apiClean);
        });
    }
    
    return false;
}

async function sync() {
    console.log("⚽ Iniciando Bot de Sincronización Prode 2026...");
    if (!API_SPORTS_KEY || !SUPABASE_URL || !SYNC_SECRET) {
        return console.error("❌ Error: Faltan credenciales (Secrets) en el entorno de GitHub Actions.");
    }
    
    // 1. Preguntarle a API-Football por los partidos de HOY (Mundial = League id 1)
    const today = new Date().toISOString().split('T')[0];
    console.log(`Buscando partidos del ${today}...`);
    
    // (Aviso: Si usamos season 2026 todavía podría no existir calendario, buscará lo disponible)
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=1&season=2026&date=${today}`, {
        headers: { 'x-apisports-key': API_SPORTS_KEY }
    });
    const data = await res.json();
    
    if (!data.response || data.response.length === 0) {
        return console.log(`Tranquilo: No hay encuentros oficiales del Mundial programados para hoy (${today}).`);
    }

    // 2. Filtramos sólo los partidos que ya TERMINARON ("FT", "PEN" o "AET")
    const finishedFixtures = data.response.filter(f => 
        ['FT', 'PEN', 'AET'].includes(f.fixture.status.short)
    );
    
    if (finishedFixtures.length === 0) {
        return console.log("⏳ Partidos en curso o por jugarse, aún no terminan.");
    }

    // 3. Traer los partidos de nuestra Base de Datos en Supabase que están "pending"
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?status=eq.pending`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const myPendingMatches = await supabaseRes.json();

    if (!myPendingMatches || myPendingMatches.length === 0) {
         return console.log("Nuestra base de datos no tiene partidos pendientes para actualizar.");
    }

    // 4. Emparejar los equipos de la API con los nombres que tenemos nosotros e inyectar Goles
    let updatesCount = 0;
    for (let f of finishedFixtures) {
        const homeNameAPI = f.teams.home.name;
        const awayNameAPI = f.teams.away.name;
        
        // Emparejamos usando la lógica de traducción y normalización para ambos equipos
        const matched = myPendingMatches.find(m => 
            (matchTeam(homeNameAPI, m.home_team) && matchTeam(awayNameAPI, m.away_team)) ||
            (matchTeam(homeNameAPI, m.away_team) && matchTeam(awayNameAPI, m.home_team))
        );
        
        if (matched) {
            let hGoals = f.goals.home.toString();
            let aGoals = f.goals.away.toString();
            
            // Si los equipos están invertidos en la API respecto a nuestra DB, invertimos los goles correspondientes
            if (matchTeam(homeNameAPI, matched.away_team)) {
                hGoals = f.goals.away.toString();
                aGoals = f.goals.home.toString();
            }
            
            console.log(`✅ ¡Encontrado! Evaluando oficialmente: ${matched.home_team} vs ${matched.away_team} -> ${hGoals}-${aGoals}`);
            
            // Enviamos el hack mágico de actualización mediante nuestra función secreta RPC
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_update_match`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    p_match_id: matched.id, 
                    p_home_goals: hGoals, 
                    p_away_goals: aGoals, 
                    p_secret: SYNC_SECRET 
                })
            });
            updatesCount++;
        } else {
            console.log(`⚠️ No se pudo emparejar el partido de la API: ${f.teams.home.name} vs ${f.teams.away.name}`);
        }
    }
    
    console.log(`🎉 Proceso Finalizado. Se actualizaron ${updatesCount} partidos en el servidor.`);
}

sync().catch(console.error);
