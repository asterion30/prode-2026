// js/app.js
import { initAuth, loginWithEmail, getCurrentUser } from "./auth.js";
import { subscribeToMatches, subscribeToUserPredictions, savePrediction } from "./matches.js";
import { supabase } from "./supabase-config.js";
import { subscribeToRanking } from "./ranking.js";

// =======================
// DOM ELEMENTS
// =======================
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email-input");

const matchesView = document.getElementById("matches-view");
const rankingView = document.getElementById("ranking-view");
const usersView = document.getElementById("users-view");
const matchesListEl = document.getElementById("matches-list");
const rankingListEl = document.getElementById("ranking-list");
const predictionsGridEl = document.getElementById("predictions-grid");
const stageTabsContainer = document.getElementById("stage-tabs");

const btnNavMatches = document.getElementById("nav-matches");
const btnNavRanking = document.getElementById("nav-ranking");
const btnNavUsers = document.getElementById("nav-users");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnExportCsvMobile = document.getElementById("btn-export-csv-mobile");
const loader = document.getElementById("global-loader");
const loginError = document.getElementById("login-error");
const userAliasDisplay = document.getElementById("user-alias-display");
const userPointsDisplay = document.getElementById("user-points-display");
const btnAdminTest = document.getElementById("btn-admin-test");
const btnAdminReset = document.getElementById("btn-admin-reset");
const btnAdminExport = document.getElementById("btn-admin-export");

const btnMobileGrid = document.getElementById("btn-mobile-grid");
const btnCloseSidebar = document.getElementById("btn-close-sidebar");
const sidebarPredictions = document.getElementById("sidebar-predictions");

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
        
        if (alias.toLowerCase() === 'testerbot' || alias.toLowerCase() === 'admin' || alias.toLowerCase() === 'rrhh' || alias.toLowerCase() === 'asterion30') {
            if (btnAdminTest) btnAdminTest.classList.remove('hidden');
            if (btnAdminReset) btnAdminReset.classList.remove('hidden');
            if (btnAdminExport) btnAdminExport.classList.remove('hidden');
            if (btnNavUsers) {
                btnNavUsers.classList.remove('hidden');
                btnNavUsers.classList.add('flex');
            }
        } else {
            if (btnAdminTest) btnAdminTest.classList.add('hidden');
            if (btnAdminReset) btnAdminReset.classList.add('hidden');
            if (btnAdminExport) btnAdminExport.classList.add('hidden');
        }
        
        // Cargar preferencia de avatar (persistente en este navegador)
        const savedAvatar = localStorage.getItem(`avatar_${user.uid || user.id}`);
        if (savedAvatar) {
            userAvatarImg.setAttribute("src", savedAvatar);
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
    const email = emailInput.value.trim();
    const alias = email.split('@')[0];
    if (!email) return;

    showLoader();
    loginError.classList.add("hidden");
    const loginSuccess = document.getElementById("login-success");
    if (loginSuccess) loginSuccess.classList.add("hidden");
    
    try {
        const res = await loginWithEmail(email, alias);
        if (res && res.needsConfirmation) {
            hideLoader();
            if (loginSuccess) {
                loginSuccess.textContent = "Hemos enviado un enlace a tu correo. Revisa tu bandeja de entrada o SPAM, haz clic en el enlace para entrar.";
                loginSuccess.classList.remove("hidden");
                loginForm.classList.add("hidden");
            }
        } else {
            // Fue exitoso y no necesita confirmación. 
            // Forzamos la recarga para que el observer inicialice todo perfectamente.
            window.location.reload();
        }
    } catch (err) {
        loginError.textContent = "Error: " + err.message;
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
    if (usersView) usersView.classList.add("hidden");
    
    btnNavMatches.classList.add("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
    btnNavMatches.classList.remove("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    
    btnNavRanking.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
    btnNavRanking.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    
    if (btnNavUsers) {
        btnNavUsers.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
        btnNavUsers.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    }
});

btnNavRanking.addEventListener("click", () => {
    rankingView.classList.remove("hidden");
    matchesView.classList.add("hidden");
    if (usersView) usersView.classList.add("hidden");
    
    btnNavRanking.classList.add("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
    btnNavRanking.classList.remove("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    
    btnNavMatches.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
    btnNavMatches.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    
    if (btnNavUsers) {
        btnNavUsers.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
        btnNavUsers.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
    }
});

if (btnNavUsers) {
    btnNavUsers.addEventListener("click", async () => {
        if (usersView) usersView.classList.remove("hidden");
        matchesView.classList.add("hidden");
        rankingView.classList.add("hidden");
        
        btnNavUsers.classList.add("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
        btnNavUsers.classList.remove("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
        
        btnNavMatches.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
        btnNavMatches.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
        
        btnNavRanking.classList.remove("text-brand-500", "bg-brand-500/10", "border-brand-500/20");
        btnNavRanking.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-800", "border-transparent");
        
        await loadUsersGrid();
    });
}

if (btnMobileGrid && sidebarPredictions && btnCloseSidebar) {
    btnMobileGrid.addEventListener("click", () => {
        sidebarPredictions.classList.remove("hidden");
        sidebarPredictions.style.display = "flex";
        setTimeout(() => {
            sidebarPredictions.classList.remove("translate-x-full");
        }, 10);
    });

    btnCloseSidebar.addEventListener("click", () => {
        sidebarPredictions.classList.add("translate-x-full");
        setTimeout(() => {
            sidebarPredictions.style.display = ""; 
            sidebarPredictions.classList.add("hidden");
        }, 300);
    });
}

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
            
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                    <!-- Local -->
                    <div class="flex flex-col items-center flex-[2]">
                        <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.homeTeam}</span>
                        ${renderFlag(match.homeFlag, match.homeTeam)}
                    </div>
                    
                    <!-- Center Input 1X2 & Goals -->
                    <div class="flex flex-col items-center gap-2 flex-[3] max-w-[140px]">
                        <div class="flex items-center justify-between bg-slate-900 rounded-lg p-1 border border-slate-700 w-full shadow-inner ${match.tbd ? 'opacity-50 pointer-events-none' : ''}">
                            <button id="btn-L-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'L' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>L</button>
                            <button id="btn-E-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'E' ? 'bg-slate-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all mx-1" ${isLocked ? 'disabled' : ''}>E</button>
                            <button id="btn-V-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'V' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>V</button>
                        </div>
                        
                        <!-- Goals Input -->
                        <div class="flex items-center justify-center gap-2 w-full ${match.tbd ? 'opacity-50 pointer-events-none' : ''}">
                            <input type="number" id="home-goals-${match.id}" class="w-10 h-7 text-center bg-slate-900 border border-slate-700 rounded text-slate-200 font-bold text-xs focus:ring-1 focus:ring-brand-500 outline-none" min="0" placeholder="-" value="${pred.homeGoals ?? ''}" ${isLocked ? 'disabled' : ''}>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Goles</span>
                            <input type="number" id="away-goals-${match.id}" class="w-10 h-7 text-center bg-slate-900 border border-slate-700 rounded text-slate-200 font-bold text-xs focus:ring-1 focus:ring-brand-500 outline-none" min="0" placeholder="-" value="${pred.awayGoals ?? ''}" ${isLocked ? 'disabled' : ''}>
                        </div>
                    </div>

                    <!-- Visita -->
                    <div class="flex flex-col items-center flex-[2]">
                        <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.awayTeam}</span>
                        ${renderFlag(match.awayFlag, match.awayTeam)}
                    </div>
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
                
                const hGInput = document.getElementById(`home-goals-${match.id}`);
                const aGInput = document.getElementById(`away-goals-${match.id}`);
                let hG = hGInput.value;
                let aG = aGInput.value;
                
                // reset colors
                ['L','E','V'].forEach(k => {
                    const b = document.getElementById(`btn-${k}-${match.id}`);
                    b.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all ${k === 'E' ? 'mx-1' : ''} text-slate-400 hover:bg-slate-700`;
                });
                
                // set active color if res is known
                if (res) {
                    const activeBtn = document.getElementById(`btn-${res}-${match.id}`);
                    activeBtn.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all shadow-md ${res === 'E' ? 'mx-1 bg-slate-500 text-white' : 'bg-brand-500 text-white'}`;
                }
                
                statusEl.textContent = "Guardando...";
                statusEl.classList.remove("opacity-0", "text-red-400", "text-brand-500");
                statusEl.classList.add("text-slate-400");
                
                try {
                    await savePrediction(match.id, res, hG, aG);
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
            
            const handleGoalChange = () => {
                const hG = document.getElementById(`home-goals-${match.id}`).value;
                const aG = document.getElementById(`away-goals-${match.id}`).value;
                
                if (hG !== '' && aG !== '') {
                    const h = parseInt(hG, 10);
                    const a = parseInt(aG, 10);
                    let detectedRes = 'E';
                    if (h > a) detectedRes = 'L';
                    else if (a > h) detectedRes = 'V';
                    handleBet(detectedRes);
                } else {
                    // find current res
                    const isL = document.getElementById(`btn-L-${match.id}`).classList.contains('bg-brand-500');
                    const isV = document.getElementById(`btn-V-${match.id}`).classList.contains('bg-brand-500');
                    const isE = document.getElementById(`btn-E-${match.id}`).classList.contains('bg-slate-500');
                    let currRes = '';
                    if (isL) currRes = 'L'; else if (isV) currRes = 'V'; else if (isE) currRes = 'E';
                    if (currRes) handleBet(currRes);
                }
            };

            document.getElementById(`btn-L-${match.id}`).addEventListener("click", () => handleBet('L'));
            document.getElementById(`btn-E-${match.id}`).addEventListener("click", () => handleBet('E'));
            document.getElementById(`btn-V-${match.id}`).addEventListener("click", () => handleBet('V'));
            
            document.getElementById(`home-goals-${match.id}`).addEventListener("input", handleGoalChange);
            document.getElementById(`away-goals-${match.id}`).addEventListener("input", handleGoalChange);
        }
    });
}

function renderRanking(ranking) {
    rankingListEl.innerHTML = "";
    const { user: currentUser } = getCurrentUser();
    
    // Find current user rank index
    const myRankIndex = currentUser ? ranking.findIndex(u => u.id === currentUser.id) : -1;
    
    // Determine which users to show
    const usersToShow = [];
    
    ranking.forEach((u, idx) => {
        if (idx < 5) {
            usersToShow.push({ user: u, index: idx });
        } else if (idx === myRankIndex) {
            // Also include me if I am not in top 5
            usersToShow.push({ user: u, index: idx });
        }
    });

    usersToShow.forEach(({ user, index }, i) => {
        // If there's a gap between top 5 and me, insert a visual separator
        if (i > 0 && index !== usersToShow[i-1].index + 1) {
            const separatorTr = document.createElement("tr");
            separatorTr.innerHTML = `<td colspan="3" class="px-4 py-2 text-center text-slate-500 text-xs tracking-widest bg-slate-800/20">••••••</td>`;
            rankingListEl.appendChild(separatorTr);
        }

        const isMedal = index < 3;
        let rankContent = `${index + 1}`;
        if (index === 0) rankContent = "🥇";
        else if (index === 1) rankContent = "🥈";
        else if (index === 2) rankContent = "🥉";
        
        const tr = document.createElement("tr");
        const isMe = currentUser && currentUser.id === user.id;
        
        tr.className = `border-slate-700/50 transition-colors ${isMe ? 'bg-brand-500/20 border-brand-500/50' : (index % 2 === 0 ? '' : 'bg-slate-800/20')}`;
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

        if (pred.homeGoals !== undefined && pred.awayGoals !== undefined && pred.homeGoals !== '' && pred.awayGoals !== '') {
            resText += ` (${pred.homeGoals}-${pred.awayGoals})`;
        }

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
// EXPORT LOGIC (Image)
// =======================
const handleExportRankingImage = async () => {
    if (!rankingView) return;
    
    // Check if the ranking is hidden, we need to show it temporarily
    const wasHidden = rankingView.classList.contains("hidden");
    
    if (wasHidden) {
        rankingView.classList.remove("hidden");
        matchesView.classList.add("hidden");
    }
    
    try {
        const btnOriginalText = btnExportCsv ? btnExportCsv.innerHTML : '';
        if (btnExportCsv) {
            btnExportCsv.innerHTML = '<i class="ph ph-spinner animate-spin"></i>';
            btnExportCsv.disabled = true;
        }
        
        // Wait for DOM layout
        await new Promise(r => setTimeout(r, 200));
        
        const canvas = await html2canvas(rankingView, {
            backgroundColor: '#0f172a', // brand-dark
            scale: 2 // High quality
        });
        
        const link = document.createElement("a");
        link.download = `Ranking_Prode_${userAliasDisplay.textContent}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        if (btnExportCsv) {
            btnExportCsv.innerHTML = btnOriginalText;
            btnExportCsv.disabled = false;
        }
    } catch (err) {
        console.error("Error al exportar imagen", err);
        alert("Hubo un error al crear la imagen del ranking.");
    } finally {
        if (wasHidden) {
            rankingView.classList.add("hidden");
            matchesView.classList.remove("hidden");
        }
    }
};

if (btnExportCsv) btnExportCsv.addEventListener("click", handleExportRankingImage);
if (btnExportCsvMobile) btnExportCsvMobile.addEventListener("click", handleExportRankingImage);

// =======================
// ADMIN EXPORT CSV LOGIC
// =======================
if (btnAdminExport) {
    btnAdminExport.addEventListener("click", async () => {
        try {
            // Re-fetch the full ranking to ensure all users are captured for HR
            const { data: users, error } = await supabase
                .from('users')
                .select('alias, score, created_at')
                .order('score', { ascending: false })
                .order('alias', { ascending: true });
                
            if (error) throw error;
            if (!users || users.length === 0) return alert("No hay usuarios.");

            let csvContent = "Posicion;Alias;Puntaje Total;Fecha Registro\r\n";
            users.forEach((u, i) => {
                const dateStr = new Date(u.created_at).toLocaleDateString();
                csvContent += `"${i + 1}";"${u.alias}";"${u.score || 0}";"${dateStr}"\r\n`;
            });

            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const dateSuffix = new Date().toISOString().split('T')[0];
            link.setAttribute("download", `Ranking_Global_RRHH_${dateSuffix}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error al exportar RRHH", err);
            alert("Error al exportar los datos de RRHH: " + err.message);
        }
    });
}

// =======================
// ADMIN TEST LOGIC
// =======================
if (btnAdminTest) {
    btnAdminTest.addEventListener("click", () => {
        if (!confirm("Esto evaluará todos tus pronósticos actuales como si los partidos hubiesen terminado con esos mismos resultados para sumar puntos y probar el ranking. ¿Continuar?")) return;
        
        let scoreUpdates = 0;
        const madePredictions = Object.keys(predictionsState).filter(id => predictionsState[id].result);
        
        madePredictions.forEach(matchId => {
             const pred = predictionsState[matchId];
             
             // En modo prueba, simulamos que el partido real terminó exactamente 
             // como predijo el primer jugador (o inventado). 
             // Vamos a sumarle los 3 puntos (1 por resultado, 2 extra por marcador exacto)
             // Asumiendo que sus propios goles fueron los reales.
             
             // Si el partido tuviera resultados reales (desde Firebase), la fórmula sería:
             // const offHG = match.realHomeGoals; ...
             // Pero aquí haremos que ganó *su* predicción.
             
             let pts = 0;
             const hG = pred.homeGoals;
             const aG = pred.awayGoals;
             
             if (hG !== '' && aG !== '' && hG !== undefined && aG !== undefined) {
                 pts = 3;
             } else if (pred.result) {
                 pts = 1;
             }
             
             scoreUpdates += pts;
        });
        
        const { user } = getCurrentUser();
        if(user) {
            showLoader();
            supabase.from('users').update({ score: scoreUpdates }).eq('id', user.id).then(({ error }) => {
                hideLoader();
                if (error) {
                    alert("Error guardando el puntaje en Supabase: " + error.message);
                } else {
                    alert(`¡Simulación completa!\nSe calcularon resultados basados en tus predicciones actuales.\nTu PUNTAJE TOTAL en la base de datos es ahora de ${scoreUpdates} puntos de prueba.\n\n(Actualiza la página si no cambia el número en pantalla automáticamente).`);
                    window.location.reload();
                }
            });
        } else {
            alert("No estás logueado.");
        }
    });
}

if (btnAdminReset) {
    btnAdminReset.addEventListener("click", () => {
        if (!confirm("¿Deseas reiniciar tus puntos de prueba a 0 en la base de datos?")) return;
        const { user } = getCurrentUser();
        if(user) {
            supabase.from('users').update({ score: 0 }).eq('id', user.id).then(() => {
                window.location.reload();
            });
        }
    });
}

const userAvatarImg = document.getElementById("user-avatar-img");
if (userAvatarImg) {
    userAvatarImg.addEventListener("click", () => {
        const { user } = getCurrentUser();
        const currentSrc = userAvatarImg.getAttribute("src");
        let newSrc = "";

        if (currentSrc.includes("avatar_female")) {
            newSrc = "./assets/avatar.webp";
        } else {
            // Se agrega versión v=2 para forzar recarga de imagen (fondo rosa)
            newSrc = "./assets/avatar_female_v2.png?v=2";
        }

        userAvatarImg.setAttribute("src", newSrc);
        
        // Guardar preferencia localmente vinculada a la cuenta de usuario
        if (user) {
            localStorage.setItem(`avatar_${user.uid || user.id}`, newSrc);
        }
    });
}

async function loadUsersGrid() {
    const listEl = document.getElementById("users-table-list");
    if (!listEl) return;
    
    showLoader();
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('alias, created_at')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        listEl.innerHTML = "";
        if (!users || users.length === 0) {
            listEl.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">No hay usuarios</td></tr>`;
            hideLoader();
            return;
        }
        
        users.forEach((u, i) => {
            const dateStr = new Date(u.created_at).toLocaleDateString();
            const tr = document.createElement("tr");
            tr.className = "border-slate-700/50 hover:bg-slate-800/30 transition-colors";
            tr.innerHTML = `
                <td class="px-4 py-3 text-center text-slate-500">${i + 1}</td>
                <td class="px-4 py-3 font-semibold text-slate-200">${u.alias}</td>
                <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">${dateStr}</td>
            `;
            listEl.appendChild(tr);
        });
        
        const btnExportUsers = document.getElementById("btn-export-users-csv");
        if (btnExportUsers) {
            btnExportUsers.onclick = () => {
                let csvContent = "Posicion;Alias;Fecha Registro\r\n";
                users.forEach((u, i) => {
                    const dateDesc = new Date(u.created_at).toLocaleDateString();
                    csvContent += `"${i + 1}";"${u.alias}";"${dateDesc}"\r\n`;
                });
                const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `UsuariosRegistrados_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
            };
        }
    } catch(e) {
        console.error("Error loading users grid", e);
    } finally {
        hideLoader();
    }
}
