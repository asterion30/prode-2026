// js/app.js
import { initAuth, loginWithAlias, getCurrentUser } from "./auth.js";
import { subscribeToMatches, subscribeToUserPredictions, savePrediction } from "./matches.js";
import { subscribeToRanking } from "./ranking.js";

// =======================
// DOM ELEMENTS
// =======================
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginForm = document.getElementById("login-form");
const aliasInput = document.getElementById("alias-input");
const matchesView = document.getElementById("matches-view");
const rankingView = document.getElementById("ranking-view");
const matchesListEl = document.getElementById("matches-list");
const rankingListEl = document.getElementById("ranking-list");
const predictionsGridEl = document.getElementById("predictions-grid");
const stageTabsContainer = document.getElementById("stage-tabs");

const btnNavMatches = document.getElementById("nav-matches");
const btnNavRanking = document.getElementById("nav-ranking");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnSubmitGoogle = document.getElementById("btn-submit-google");
const loader = document.getElementById("global-loader");
const loginError = document.getElementById("login-error");
const userAliasDisplay = document.getElementById("user-alias-display");
const userPointsDisplay = document.getElementById("user-points-display");

// STATE
let matchesState = [];
let predictionsState = {};
let isAppInitialized = false;

const STAGES = [
    { id: 'groups', name: 'Fase de Grupos' },
    { id: 'round_32', name: '16vos' },
    { id: 'round_16', name: 'Octavos' },
    { id: 'quarter_finals', name: 'Cuartos' },
    { id: 'semi_finals', name: 'Semis' },
    { id: 'third_place', name: '3er Puesto' },
    { id: 'final', name: 'Final' }
];
let currentStage = 'groups';

// =======================
// INITIALIZATION
// =======================
function showLoader() { loader.classList.remove("hidden"); }
function hideLoader() { loader.classList.add("hidden"); }

showLoader();

initAuth((user, alias, score) => {
    if (user && alias) {
        // Logged In
        loginView.classList.add("hidden");
        mainView.classList.remove("hidden");
        userAliasDisplay.textContent = alias;
        userPointsDisplay.textContent = `${score} pts`;
        
        if (!isAppInitialized) {
            setupAppSubscriptions(user.uid);
            renderStageTabs();
            isAppInitialized = true;
        }
        hideLoader();
    } else {
        // Logged Out
        mainView.classList.add("hidden");
        loginView.classList.remove("hidden");
        hideLoader();
    }
});

// =======================
// LOGIN LOGIC
// =======================
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alias = aliasInput.value.trim();
    if (!alias) return;

    showLoader();
    loginError.classList.add("hidden");
    
    try {
        await loginWithAlias(alias);
        // initAuth observer will hide loader
    } catch (err) {
        loginError.textContent = "Error iniciando sesión: " + err.message;
        loginError.classList.remove("hidden");
        hideLoader();
    }
});

// =======================
// MAIN APP LOGIC
// =======================
function setupAppSubscriptions(uid) {
    // Suscribirse a partidos
    subscribeToMatches((matches) => {
        matchesState = matches;
        renderMatches();
        renderPredictionsGrid();
    });

    // Suscribirse a predicciones
    subscribeToUserPredictions(uid, (preds) => {
        predictionsState = preds;
        renderMatches(); // Re-render to show values
        renderPredictionsGrid();
    });

    // Suscribirse al Ranking
    subscribeToRanking((ranking) => {
        renderRanking(ranking);
    });
}

// NAVIGATION
btnNavMatches.addEventListener("click", () => {
    matchesView.classList.remove("hidden");
    rankingView.classList.add("hidden");
    
    btnNavMatches.classList.replace("text-slate-500", "text-brand-500");
    btnNavMatches.classList.remove("hover:text-slate-300");
    
    btnNavRanking.classList.replace("text-brand-500", "text-slate-500");
    btnNavRanking.classList.add("hover:text-slate-300");
});

btnNavRanking.addEventListener("click", () => {
    rankingView.classList.remove("hidden");
    matchesView.classList.add("hidden");
    
    btnNavRanking.classList.replace("text-slate-500", "text-brand-500");
    btnNavRanking.classList.remove("hover:text-slate-300");
    
    btnNavMatches.classList.replace("text-brand-500", "text-slate-500");
    btnNavMatches.classList.add("hover:text-slate-300");
});

// =======================
// RENDERERS
// =======================

function renderStageTabs() {
    if (!stageTabsContainer) return;
    stageTabsContainer.innerHTML = "";
    STAGES.forEach(stage => {
        const btn = document.createElement("button");
        const isActive = currentStage === stage.id;
        btn.className = `px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${isActive ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'}`;
        btn.textContent = stage.name;
        btn.onclick = () => {
            currentStage = stage.id;
            renderStageTabs();
            renderMatches();
        };
        stageTabsContainer.appendChild(btn);
    });
}

function renderMatches() {
    matchesListEl.innerHTML = "";
    
    // Configurar tiempo actual
    const now = new Date(); // Usará hora actual real
    
    const filteredMatches = matchesState.filter(m => m.stage === currentStage);
    
    if (filteredMatches.length === 0) {
        matchesListEl.innerHTML = `<div class="text-center text-slate-500 text-sm mt-10">No hay partidos cargados para esta fase.</div>`;
        return;
    }

    filteredMatches.forEach(match => {
        const matchDate = new Date(match.matchDate);
        // Validar si falta menos de 1 hora
        const diffMs = matchDate - now;
        const hoursLeft = diffMs / (1000 * 60 * 60);
        const isLocked = match.tbd || hoursLeft <= 1 || match.status === 'finished';
        
        const pred = predictionsState[match.id] || { result: '' };
        
        // Match Card HTML
        const card = document.createElement("div");
        card.className = "bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm fade-in relative overflow-hidden";
        if (isLocked) {
            card.classList.add("opacity-60");
            if(match.tbd) card.classList.add("grayscale-[0.5]");
        }
        
        // Date formatter
        const dateStr = matchDate.toLocaleDateString('es-AR', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const renderFlag = (flagName, teamName) => {
            if (flagName === 'un') {
                return `<div class="w-7 h-7 mt-1 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 shadow-inner"><i class="ph-bold ph-question text-slate-400"></i></div>`;
            }
            return `<img src="https://flagcdn.com/w40/${flagName}.png" alt="${teamName}" class="w-7 h-auto drop-shadow-md rounded-[2px] mt-1 object-cover border border-slate-700">`;
        };

        let statusBadge = '';
        if (match.tbd) {
            statusBadge = `<div class="absolute top-0 right-0 bg-slate-600/80 text-[10px] text-white font-bold px-2 py-1 rounded-bl-lg">POR DEFINIR</div>`;
        } else if (hoursLeft <= 1 || match.status === 'finished') {
            statusBadge = `<div class="absolute top-0 right-0 bg-red-500/80 text-[10px] text-white font-bold px-2 py-1 rounded-bl-lg">CERRADO</div>`;
        }

        card.innerHTML = `
            ${statusBadge}
            
            <div class="text-center text-xs text-slate-400 mb-4 font-medium">${dateStr}</div>
            
            <div class="flex items-center justify-between gap-2">
                <!-- Local -->
                <div class="flex flex-col items-center flex-[2]">
                    <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.homeTeam}</span>
                    ${renderFlag(match.homeFlag, match.homeTeam)}
                </div>
                
                <!-- Center Input 1X2 -->
                <div class="flex flex-col items-center gap-1 flex-[3] max-w-[140px]">
                    <div class="flex items-center justify-between bg-slate-900 rounded-lg p-1 border border-slate-700 w-full shadow-inner ${match.tbd ? 'opacity-50 pointer-events-none' : ''}">
                        <button id="btn-L-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'L' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>L</button>
                        <button id="btn-E-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'E' ? 'bg-slate-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all mx-1" ${isLocked ? 'disabled' : ''}>E</button>
                        <button id="btn-V-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'V' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>V</button>
                    </div>
                </div>

                <!-- Visita -->
                <div class="flex flex-col items-center flex-[2]">
                    <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.awayTeam}</span>
                    ${renderFlag(match.awayFlag, match.awayTeam)}
                </div>
            </div>
            
            <div class="mt-3 flex justify-center h-4">
                <span id="status-${match.id}" class="text-[10px] text-brand-500 font-medium opacity-0 transition-opacity">Guardado ✓</span>
            </div>
        `;
        
        matchesListEl.appendChild(card);
        
        // Bind Save Button Event
        if (!isLocked) {
            const handleBet = async (res) => {
                const statusEl = document.getElementById(`status-${match.id}`);
                // reset colors
                ['L','E','V'].forEach(k => {
                    const b = document.getElementById(`btn-${k}-${match.id}`);
                    b.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all ${k === 'E' ? 'mx-1' : ''} text-slate-400 hover:bg-slate-700`;
                });
                // set active color
                const activeBtn = document.getElementById(`btn-${res}-${match.id}`);
                activeBtn.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all shadow-md ${res === 'E' ? 'mx-1 bg-slate-500 text-white' : 'bg-brand-500 text-white'}`;
                
                statusEl.textContent = "Guardando...";
                statusEl.classList.remove("opacity-0", "text-red-400", "text-brand-500");
                statusEl.classList.add("text-slate-400");
                
                try {
                    await savePrediction(match.id, res);
                    statusEl.textContent = "¡Guardado ✓!";
                    statusEl.classList.remove("text-slate-400");
                    statusEl.classList.add("text-brand-500");
                    setTimeout(() => statusEl.classList.add("opacity-0"), 2000);
                } catch(error) {
                    statusEl.textContent = "Error al guardar";
                    statusEl.classList.remove("text-slate-400");
                    statusEl.classList.add("text-red-400");
                    console.error("No se pudo guardar", error);
                }
            };

            document.getElementById(`btn-L-${match.id}`).addEventListener("click", () => handleBet('L'));
            document.getElementById(`btn-E-${match.id}`).addEventListener("click", () => handleBet('E'));
            document.getElementById(`btn-V-${match.id}`).addEventListener("click", () => handleBet('V'));
        }
    });
}

function renderRanking(ranking) {
    rankingListEl.innerHTML = "";
    ranking.forEach((user, index) => {
        const isMedal = index < 3;
        let rankContent = `${index + 1}`;
        if (index === 0) rankContent = "🥇";
        else if (index === 1) rankContent = "🥈";
        else if (index === 2) rankContent = "🥉";
        
        const tr = document.createElement("tr");
        tr.className = `border-slate-700/50 hover:bg-slate-800/50 transition-colors ${index % 2 === 0 ? '' : 'bg-slate-800/20'}`;
        tr.innerHTML = `
            <td class="px-4 py-3 text-center ${isMedal ? 'text-lg' : 'text-slate-400 font-medium'}">
                ${rankContent}
            </td>
            <td class="px-4 py-3 font-semibold ${index === 0 ? 'text-brand-500' : 'text-slate-200'} flex items-center gap-2">
                ${user.alias}
            </td>
            <td class="px-4 py-3 text-right">
                <span class="bg-brand-900/50 text-brand-500 font-bold px-2 py-1 rounded">
                    ${user.score}
                </span>
            </td>
        `;
        rankingListEl.appendChild(tr);
    });
}

function renderPredictionsGrid() {
    if (!predictionsGridEl) return;
    predictionsGridEl.innerHTML = "";
    
    // Filtramos solo los pronósticos hechos
    const madePredictions = Object.keys(predictionsState).filter(id => predictionsState[id].result);
    
    if (madePredictions.length === 0) {
        predictionsGridEl.innerHTML = `<div class="text-center text-slate-500 text-sm mt-10">Aún no has hecho pronósticos.</div>`;
        return;
    }

    // Ordenamos por updatedAt descendente si existe
    const sortedIds = madePredictions.sort((a,b) => {
        const tA = predictionsState[a].updatedAt ? new Date(predictionsState[a].updatedAt).getTime() : 0;
        const tB = predictionsState[b].updatedAt ? new Date(predictionsState[b].updatedAt).getTime() : 0;
        return tB - tA;
    });

    sortedIds.forEach(id => {
        const pred = predictionsState[id];
        const match = matchesState.find(m => m.id === id);
        if (!match) return;

        let resText = "Empate";
        let resColor = "bg-slate-500 text-white";
        if (pred.result === 'L') { resText = `Gana ${match.homeTeam}`; resColor = "bg-brand-500 text-white"; }
        if (pred.result === 'V') { resText = `Gana ${match.awayTeam}`; resColor = "bg-brand-500 text-white"; }

        let dateStr = "Sin fecha";
        if (pred.updatedAt) {
            const upDate = new Date(pred.updatedAt);
            if (!isNaN(upDate.getTime())) {
                dateStr = upDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
        }

        const div = document.createElement("div");
        div.className = "bg-slate-800 rounded-lg p-3 border border-slate-700/50 flex flex-col gap-1 fade-in";
        div.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <span class="text-xs font-bold font-sans text-slate-300">
                    ${match.homeTeam} vs ${match.awayTeam}
                </span>
                <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm ${resColor}">
                    ${resText}
                </span>
            </div>
            <div class="text-[10px] text-slate-500 italic mt-1 flex items-center justify-between">
                <span>Modificado:</span>
                <span>${dateStr}</span>
            </div>
        `;
        predictionsGridEl.appendChild(div);
    });
}

// Prevent empty scrolling visual issues on mobile
document.addEventListener('touchmove', function(e) {
    if (e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

// =======================
// EXPORT LOGIC
// =======================
if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
        const madePredictions = Object.keys(predictionsState).filter(id => predictionsState[id].result);
        if (madePredictions.length === 0) {
            alert("No tienes pronósticos guardados para exportar.");
            return;
        }

        // Prepare CSV Content
        let csvContent = "Partido;Local;Visitante;Pronostico;Fecha Modificacion\r\n";
        
        const sortedIds = madePredictions.sort((a,b) => {
            const tA = predictionsState[a].updatedAt ? new Date(predictionsState[a].updatedAt).getTime() : 0;
            const tB = predictionsState[b].updatedAt ? new Date(predictionsState[b].updatedAt).getTime() : 0;
            return tB - tA;
        });

        sortedIds.forEach(id => {
            const pred = predictionsState[id];
            const match = matchesState.find(m => m.id === id);
            if (!match) return;

            let resText = "E";
            if (pred.result === 'L') resText = "L";
            if (pred.result === 'V') resText = "V";

            let dateStr = "";
            if (pred.updatedAt) {
                const upDate = new Date(pred.updatedAt);
                if (!isNaN(upDate.getTime())) {
                    dateStr = upDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            }
            
            // Clean up team names just in case they have commas
            const local = match.homeTeam.replace(/;/g, '');
            const away = match.awayTeam.replace(/;/g, '');
            const matchName = `${local} vs ${away}`;

            csvContent += `"${matchName}";"${local}";"${away}";"${resText}";"${dateStr}"\r\n`;
        });

        // Trigger Download
        // Add BOM so Excel opens UTF-8 correctly
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Prode2026_Pronosticos_${userAliasDisplay.textContent}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// =======================
// GOOGLE SHEETS SUBMIT LOGIC
// =======================
if (btnSubmitGoogle) {
    btnSubmitGoogle.addEventListener("click", async () => {
        const madePredictions = Object.keys(predictionsState).filter(id => predictionsState[id].result);
        if (madePredictions.length === 0) {
            alert("No tienes pronósticos guardados para enviar.");
            return;
        }

        const btnOriginalText = btnSubmitGoogle.innerHTML;
        btnSubmitGoogle.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Guardando...';
        btnSubmitGoogle.disabled = true;

        // Construir datos
        const dataToSend = {
            alias: userAliasDisplay.textContent,
            timestamp: new Date().toISOString(),
            predicciones: {}
        };

        madePredictions.forEach(id => {
            const pred = predictionsState[id];
            const match = matchesState.find(m => m.id === id);
            if(match) {
                const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
                
                let textoResultado = "Empate";
                if (pred.result === 'L') textoResultado = `Gana ${match.homeTeam}`;
                if (pred.result === 'V') textoResultado = `Gana ${match.awayTeam}`;
                
                dataToSend.predicciones[matchName] = textoResultado;
            }
        });

        // ==========================================
        // URL DEL SCRIPT DE GOOGLE
        // ==========================================
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwM66-04lRwkCpDeR7teHlPP8LCkegLB12TTV837zXemUxly3FEyyC0tuqLqSCc_E6y/exec";

        if (!SCRIPT_URL || SCRIPT_URL.includes("REPLACE_ME")) {
            alert("Falta configurar la URL de Google Sheets en el código.");
            btnSubmitGoogle.innerHTML = btnOriginalText;
            btnSubmitGoogle.disabled = false;
            return;
        }

        try {
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", // Evita problemas de seguridad CORS desde GitHub Pages
                headers: {
                    "Content-Type": "text/plain"
                },
                body: JSON.stringify(dataToSend)
            });
            
            alert("¡Tus pronósticos han sido enviados a la base central con éxito!");
        } catch (error) {
            console.error(error);
            alert("Hubo un error al enviar los datos. Intenta nuevamente.");
        } finally {
            btnSubmitGoogle.innerHTML = btnOriginalText;
            btnSubmitGoogle.disabled = false;
        }
    });
}
