import { toPng } from 'html-to-image';

// Helper to prevent XSS
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

import { initAuth, loginWithEmail, getCurrentUser, updateAvatarUrl, signInWithSocial, loginMockUser, logOut } from "./auth.js";
import { subscribeToMatches, subscribeToUserPredictions, savePrediction } from "./matches.js";
import { supabase, isMock } from "./supabase-config.js";
import { subscribeToRanking } from "./ranking.js";
import { calculateStandings, GROUP_MAP } from "./standings.js";
import { createLeague, joinLeagueByCode, fetchUserLeagues, fetchLeagueDetails, removeLeagueMember } from "./leagues.js";

// =======================
// DOM ELEMENTS
// =======================
const userAvatarImg = document.getElementById("user-avatar-img");
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");

const matchesView = document.getElementById("matches-view");
const rankingView = document.getElementById("ranking-view");
const gruposView  = document.getElementById("grupos-view");
const usersView = document.getElementById("users-view");
const matchesListEl = document.getElementById("matches-list");
const rankingListEl = document.getElementById("ranking-list");
const predictionsGridEl = document.getElementById("predictions-grid");
const stageTabsContainer = document.getElementById("stage-tabs");

const btnNavMatches = document.getElementById("nav-matches");
const btnNavRanking = document.getElementById("nav-ranking");
const btnNavGrupos  = document.getElementById("nav-grupos");
const btnNavUsers = document.getElementById("nav-users");

// Leagues DOM Elements
const legendaryView = document.getElementById("legendary-view");
const leagueDetailsView = document.getElementById("league-details-view");
const btnNavLegendary = document.getElementById("nav-legendary");

const btnCreateLeague = document.getElementById("btn-create-league");
const btnJoinLeague = document.getElementById("btn-join-league");
const modalCreateLeague = document.getElementById("modal-create-league");
const modalJoinLeague = document.getElementById("modal-join-league");
const btnCancelCreateLeague = document.getElementById("btn-cancel-create-league");
const btnCancelJoinLeague = document.getElementById("btn-cancel-join-league");
const btnSaveLeague = document.getElementById("btn-save-league");
const btnConfirmJoin = document.getElementById("btn-confirm-join");

const leagueNameInput = document.getElementById("league-name-input");
const leagueDescInput = document.getElementById("league-desc-input");
const leaguePrizesInput = document.getElementById("league-prizes-input");
const joinCodeInput = document.getElementById("join-code-input");

const leaguesEmptyState = document.getElementById("leagues-empty-state");
const leaguesContainer = document.getElementById("leagues-container");
const btnBackToLeagues = document.getElementById("btn-back-to-leagues");
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
const checkShowInactive = document.getElementById("check-show-inactive");

// =======================
// THEME LOGIC
// =======================
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const themeToggleIcon = document.getElementById("theme-toggle-icon");


let loginMode = 'login'; // 'login' or 'register'

function initTheme() {
    const savedTheme = localStorage.getItem("prode_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        if (themeToggleIcon) {
            themeToggleIcon.classList.remove("ph-sun");
            themeToggleIcon.classList.add("ph-moon");
        }
    }
}

if (btnThemeToggle) {
    btnThemeToggle.addEventListener("click", () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem("prode_theme", isLight ? "light" : "dark");
        if (themeToggleIcon) {
            if (isLight) {
                themeToggleIcon.classList.remove("ph-sun");
                themeToggleIcon.classList.add("ph-moon");
            } else {
                themeToggleIcon.classList.remove("ph-moon");
                themeToggleIcon.classList.add("ph-sun");
            }
        }
    });
}

initTheme();



// STATE
let matchesState = [];
let predictionsState = {};
let isAppInitialized = false;
let currentStandingsGroup = 'A'; // grupo activo en la vista de posiciones
let usersCurrentPage = 0;
const USERS_PER_PAGE = 15;
let cachedUsers = []; // Para paginación local en memoria

// ADMIN STATE — se setea al iniciar la sesión
let IS_SUPER_ADMIN = false;  // solo asterion30
let IS_ADMIN = false;        // asterion30 + delegados

// El superadmin se identifica por el alias 'asterion30' en la BD (campo alias).
const SUPER_ADMIN_ALIAS = 'asterion30';
const SUPER_ADMIN_EMAIL = 'asterion30@gmail.com';  // email del superadmin

// Admins delegados con acceso permanente (por email).
// Se activan automaticamente cuando el usuario se registra con ese e-mail.
// El superadmin también puede delegar otros usuarios via el panel.
const DELEGATED_ADMIN_EMAILS = [
    'lcosta@vittal.com.ar',
    'scriado@vittal.com.ar'
];

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

function initCountdown() {
    const countdownTimer = document.getElementById("countdown-timer");
    const countdownText = document.getElementById("countdown-text");
    if (!countdownTimer || !countdownText) return;
    
    // Mundial de la FIFA 2026 arranca el 11 de Junio de 2026
    const worldCupStart = new Date("2026-06-11T16:00:00-05:00").getTime(); 
    
    const tick = () => {
        const now = new Date().getTime();
        const distance = worldCupStart - now;
        
        if (distance < 0) {
            countdownTimer.classList.add("hidden");
            countdownTimer.classList.remove("flex");
            return;
        }
        
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        
        countdownText.innerHTML = `${d}d ${h}h ${m}m ${s}s`;
        countdownTimer.classList.remove("hidden");
        countdownTimer.classList.add("flex");
        setTimeout(tick, 1000);
    };
    tick();
}

showLoader();
initCountdown();

initAuth((user, alias, score, avatarUrl) => {
    if (user && alias) {
        // Logged In
        loginView.classList.add("hidden");
        mainView.classList.remove("hidden");
        userAliasDisplay.textContent = alias || 'Usuario';
        userPointsDisplay.textContent = `${score} pts`;

        // ── Cálculo de permisos ──────────────────────────────────────────────
        // Superadmin: identificado por alias legacy 'asterion30' O por email (si está configurado)
        IS_SUPER_ADMIN = (
            alias.toLowerCase() === SUPER_ADMIN_ALIAS ||
            (SUPER_ADMIN_EMAIL !== '' && user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
        );

        // Admins delegados: hardcodeados permanentes + los que el superadmin promueve via localStorage
        const extraAdmins = JSON.parse(localStorage.getItem('extra_admins') || '[]')
            .map(a => a.toLowerCase().trim());

        const aliasLower = alias.toLowerCase();
        const emailLower = (user.email || '').toLowerCase();

        // Un usuario es admin delegado si:
        // - Su email está en la lista permanente, O
        // - Su alias o email fue promovido por el superadmin (localStorage)
        const isDelegatedAdmin =
            DELEGATED_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower) ||
            extraAdmins.includes(aliasLower) ||
            extraAdmins.includes(emailLower);

        IS_ADMIN = IS_SUPER_ADMIN || isDelegatedAdmin;
        // ────────────────────────────────────────────────────────────────────

        const urlParams = new URLSearchParams(window.location.search);
        const isDebugMode = urlParams.get('debug') === 'true';

        // Botones de debug: solo superadmin en modo debug
        if (IS_SUPER_ADMIN && isDebugMode) {
            if (btnAdminTest) btnAdminTest.classList.remove('hidden');
            if (btnAdminReset) btnAdminReset.classList.remove('hidden');
        } else {
            if (btnAdminTest) btnAdminTest.classList.add('hidden');
            if (btnAdminReset) btnAdminReset.classList.add('hidden');
        }

        // Export RRHH y pestaña Usuarios: admin o superadmin
        if (IS_ADMIN) {
            if (btnAdminExport) btnAdminExport.classList.remove('hidden');
            if (btnNavUsers) {
                btnNavUsers.classList.remove('hidden');
                btnNavUsers.classList.add('flex');
            }
        } else {
            if (btnAdminExport) btnAdminExport.classList.add('hidden');
            if (btnNavUsers) {
                btnNavUsers.classList.add('hidden');
                btnNavUsers.classList.remove('flex');
            }
        }

        // Cargar avatar: primero desde BD, luego fallback a localStorage
        const savedAvatar = localStorage.getItem(`avatar_${user.id}`);
        if (avatarUrl) {
            userAvatarImg.setAttribute('src', avatarUrl);
        } else if (savedAvatar) {
            userAvatarImg.setAttribute('src', savedAvatar);
        } else {
            userAvatarImg.setAttribute('src', '/assets/avatar.webp');
        }

        if (!isAppInitialized) {
            setupAppSubscriptions(user.uid || user.id);
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
// LOGIN LOGIC (Google & Mock)
// =======================
const btnGoogleLogin = document.getElementById("btn-google-login");
const mockLoginContainer = document.getElementById("mock-login-container");
const btnMockLogin = document.getElementById("btn-mock-login");
const mockAliasInput = document.getElementById("mock-alias-input");

// Mostrar contenedor de mock si isMock es true o si se pasa ?mock=true en la URL
const urlParams = new URLSearchParams(window.location.search);
const hasMockParam = urlParams.get('mock') === 'true';

if (mockLoginContainer && (isMock || hasMockParam)) {
    mockLoginContainer.classList.remove("hidden");
}

if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener("click", async () => {
        showLoader();
        loginError.classList.add("hidden");
        try {
            await signInWithSocial('google');
        } catch (err) {
            loginError.textContent = "Error de conexión con Google: " + err.message;
            loginError.classList.remove("hidden");
            hideLoader();
        }
    });
}

if (btnMockLogin) {
    btnMockLogin.addEventListener("click", () => {
        const alias = mockAliasInput ? mockAliasInput.value.trim() : '';
        if (!alias) {
            alert("Por favor ingresa un nombre para el usuario mock.");
            return;
        }
        showLoader();
        loginMockUser(alias);
    });
}

if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        showLoader();
        try {
            await logOut();
        } catch(err) {
            hideLoader();
            alert("Error al cerrar sesión: " + err.message);
        }
    });
}

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

// =======================
// NAVIGATION HELPERS
// =======================
const ALL_VIEWS = [matchesView, gruposView, legendaryView, leagueDetailsView, rankingView, usersView].filter(Boolean);
const ALL_NAV_BTNS = [btnNavMatches, btnNavGrupos, btnNavLegendary, btnNavRanking, btnNavUsers].filter(Boolean);

function setActiveNav(activeBtn, activeView) {
    ALL_VIEWS.forEach(v => v.classList.add('hidden'));
    ALL_NAV_BTNS.forEach(b => {
        b.classList.remove('text-brand-500', 'bg-brand-500/10', 'border-brand-500/20');
        b.classList.add('text-slate-400', 'border-transparent');
    });
    if (activeView) {
        activeView.classList.remove('hidden');
        // Asegurar que vuelve al tope al cambiar de vista (especialmente en móvil)
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Si el contenedor interno tiene scroll propio, resetearlo también
        const contentArea = document.getElementById("content-area");
        if (contentArea) contentArea.scrollTop = 0;
    }
    if (activeBtn) {
        activeBtn.classList.add('text-brand-500', 'bg-brand-500/10', 'border-brand-500/20');
        activeBtn.classList.remove('text-slate-400', 'border-transparent');
    }
}

btnNavMatches.addEventListener('click', () => setActiveNav(btnNavMatches, matchesView));

btnNavRanking.addEventListener('click', () => setActiveNav(btnNavRanking, rankingView));

if (btnNavGrupos) {
    btnNavGrupos.addEventListener('click', () => {
        setActiveNav(btnNavGrupos, gruposView);
        renderGroupsView();
    });
}

if (btnNavLegendary) {
    btnNavLegendary.addEventListener('click', () => {
        setActiveNav(btnNavLegendary, legendaryView);
        renderLegendaryView();
    });
}

if (btnBackToLeagues) {
    btnBackToLeagues.addEventListener('click', () => {
        setActiveNav(btnNavLegendary, legendaryView);
        renderLegendaryView();
    });
}

if (btnNavUsers) {
    btnNavUsers.addEventListener('click', async () => {
        setActiveNav(btnNavUsers, usersView);
        await loadUsersGrid();
    });
}

if (checkShowInactive) {
    checkShowInactive.addEventListener('change', () => {
        loadUsersGrid();
    });
}

const btnShowPrizes = document.getElementById("btn-show-prizes");
const prizesBanner  = document.getElementById("prizes-banner");

if (btnShowPrizes && prizesBanner) {
    btnShowPrizes.addEventListener('click', () => {
        prizesBanner.classList.toggle('hidden');
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
// GRUPOS / STANDINGS VIEW
// =======================
function renderGroupsView() {
    const selectorEl   = document.getElementById('group-selector');
    const containerEl  = document.getElementById('group-table-container');
    if (!selectorEl || !containerEl) return;

    const standings = calculateStandings(matchesState);
    const groupLetters = Object.keys(GROUP_MAP);

    // Renderizar botones de selección de grupo
    selectorEl.innerHTML = '';
    groupLetters.forEach(letter => {
        const btn = document.createElement('button');
        const isActive = letter === currentStandingsGroup;
        btn.textContent = `Grupo ${letter}`;
        btn.className = `px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            isActive
                ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
        }`;
        btn.onclick = () => {
            currentStandingsGroup = letter;
            renderGroupsView();
        };
        selectorEl.appendChild(btn);
    });

    // Renderizar tabla del grupo seleccionado
    const groupData = standings[currentStandingsGroup] || [];
    const anyPlayed = groupData.some(t => t.pj > 0);

    containerEl.innerHTML = `
        <div class="rounded-2xl overflow-hidden border border-slate-700/60 mt-3">
            <div class="bg-slate-800/80 px-4 py-2 flex items-center gap-3 border-b border-slate-700/60">
                <span class="text-xs font-bold text-brand-500 uppercase tracking-widest">Grupo ${currentStandingsGroup}</span>
                ${!anyPlayed ? '<span class="text-xs text-slate-500 italic">— Sin partidos jugados aún</span>' : ''}
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th class="px-3 py-2 text-left w-6">#</th>
                            <th class="px-3 py-2 text-left">Equipo</th>
                            <th class="px-2 py-2 text-center">PJ</th>
                            <th class="px-2 py-2 text-center">G</th>
                            <th class="px-2 py-2 text-center">E</th>
                            <th class="px-2 py-2 text-center">P</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">GF</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">GC</th>
                            <th class="px-2 py-2 text-center hidden sm:table-cell">DG</th>
                            <th class="px-2 py-2 text-center font-bold text-brand-400">Pts</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50">
                        ${groupData.map((team, idx) => {
                            const isQualifying = idx < 2;
                            const flagSrc = team.flag !== 'un'
                                ? `https://flagcdn.com/w40/${team.flag}.png`
                                : null;
                            const flagHtml = flagSrc
                                ? `<img src="${flagSrc}" alt="${escapeHTML(team.team)}" class="w-5 h-auto rounded-sm object-cover border border-slate-600" onerror="this.style.display='none'">`
                                : `<div class="w-5 h-3.5 bg-slate-700 rounded-sm border border-slate-600"></div>`;
                            return `
                                <tr class="hover:bg-slate-800/40 transition-colors ${isQualifying ? 'border-l-2 border-brand-500' : 'border-l-2 border-transparent'}">
                                    <td class="px-3 py-2.5 text-slate-400 text-xs">${idx + 1}</td>
                                    <td class="px-3 py-2.5">
                                        <div class="flex items-center gap-2">
                                            ${flagHtml}
                                            <span class="font-semibold text-slate-200 text-xs sm:text-sm leading-tight">${escapeHTML(team.team)}</span>
                                        </div>
                                    </td>
                                    <td class="px-2 py-2.5 text-center text-slate-300 text-xs">${team.pj}</td>
                                    <td class="px-2 py-2.5 text-center text-slate-300 text-xs">${team.g}</td>
                                    <td class="px-2 py-2.5 text-center text-slate-300 text-xs">${team.e}</td>
                                    <td class="px-2 py-2.5 text-center text-slate-300 text-xs">${team.p}</td>
                                    <td class="px-2 py-2.5 text-center text-slate-400 text-xs hidden sm:table-cell">${team.gf}</td>
                                    <td class="px-2 py-2.5 text-center text-slate-400 text-xs hidden sm:table-cell">${team.gc}</td>
                                    <td class="px-2 py-2.5 text-center text-xs hidden sm:table-cell ${team.dg > 0 ? 'text-brand-400' : team.dg < 0 ? 'text-red-400' : 'text-slate-400'}">${team.dg > 0 ? '+' : ''}${team.dg}</td>
                                    <td class="px-2 py-2.5 text-center">
                                        <span class="font-bold text-sm ${isQualifying && team.pj > 0 ? 'text-brand-400' : 'text-slate-200'}">${team.pts}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="bg-slate-800/30 px-4 py-2 flex items-center gap-2 border-t border-slate-700/60">
                <div class="w-0.5 h-3 bg-brand-500 rounded"></div>
                <span class="text-xs text-slate-500">Clasifican los 2 primeros de cada grupo</span>
            </div>
        </div>
    `;
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

    let matchesToRender = [...filteredMatches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    let lastDayLabel = null;
    let currentDayContainer = null;
    window.prodeOpenSections = window.prodeOpenSections || new Set();

    matchesToRender.forEach(match => {
        const matchDate = new Date(match.matchDate);
        const dayLabel = match.tbd ? "Partidos por Definir" : matchDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        const dayLabelFormatted = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
        
        if (dayLabel !== lastDayLabel) {
            const sectionWrap = document.createElement("div");
            sectionWrap.className = "w-full mt-2";
            
            const isSectionOpen = window.prodeOpenSections.has(dayLabel);
            
            const separator = document.createElement("button");
            separator.className = "w-full bg-slate-900/80 hover:bg-slate-800 transition-colors text-brand-500 font-bold py-3 px-4 rounded-xl border-l-4 border-brand-500 mb-3 text-[13px] uppercase tracking-widest shadow-sm flex justify-between items-center cursor-pointer focus:outline-none";
            separator.innerHTML = `
                <div class="flex items-center gap-3">
                    <i class="ph-bold ${match.tbd ? 'ph-question' : 'ph-calendar-blank'} text-lg"></i>
                    <span>${dayLabelFormatted}</span>
                </div>
                <i class="ph-bold ph-caret-down text-lg transition-transform transform ${isSectionOpen ? 'rotate-180' : ''}"></i>
            `;
            
            const container = document.createElement("div");
            container.className = `space-y-4 mb-4 mt-2 ${isSectionOpen ? '' : 'hidden'}`;
            currentDayContainer = container;
            
            separator.addEventListener("click", () => {
                const isHidden = container.classList.contains("hidden");
                if (isHidden) {
                    container.classList.remove("hidden");
                    separator.querySelector('.ph-caret-down').classList.add('rotate-180');
                    window.prodeOpenSections.add(dayLabel);
                } else {
                    container.classList.add("hidden");
                    separator.querySelector('.ph-caret-down').classList.remove('rotate-180');
                    window.prodeOpenSections.delete(dayLabel);
                }
            });

            sectionWrap.appendChild(separator);
            sectionWrap.appendChild(container);
            matchesListEl.appendChild(sectionWrap);
            
            lastDayLabel = dayLabel;
        }

        // Configurar tiempo actual y bloqueo
        const now = new Date();
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
        
        const dateStr = matchDate.toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
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
            <div class="text-center text-[10px] text-slate-400 mb-4 font-bold uppercase tracking-widest">${match.tbd ? 'TBD' : dateStr}</div>
            
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex flex-col items-center flex-[2]">
                        <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.homeTeam}</span>
                        ${renderFlag(match.homeFlag, match.homeTeam)}
                    </div>
                    
                    <div class="flex flex-col items-center gap-2 flex-[3] max-w-[140px]">
                        <div class="flex items-center justify-between bg-slate-900 rounded-lg p-1 border border-slate-700 w-full shadow-inner ${match.tbd ? 'opacity-50 pointer-events-none' : ''}">
                            <button id="btn-L-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'L' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>L</button>
                            <button id="btn-E-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'E' ? 'bg-slate-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all mx-1" ${isLocked ? 'disabled' : ''}>E</button>
                            <button id="btn-V-${match.id}" class="prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm ${pred.result === 'V' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700'} transition-all" ${isLocked ? 'disabled' : ''}>V</button>
                        </div>
                        
                        <div class="flex items-center justify-center gap-2 w-full ${match.tbd ? 'opacity-50 pointer-events-none' : ''}">
                            <input type="number" id="home-goals-${match.id}" class="w-10 h-7 text-center bg-slate-900 border border-slate-700 rounded text-slate-200 font-bold text-xs focus:ring-1 focus:ring-brand-500 outline-none" min="0" max="25" placeholder="-" value="${pred.homeGoals ?? ''}" ${isLocked ? 'disabled' : ''}>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Goles</span>
                            <input type="number" id="away-goals-${match.id}" class="w-10 h-7 text-center bg-slate-900 border border-slate-700 rounded text-slate-200 font-bold text-xs focus:ring-1 focus:ring-brand-500 outline-none" min="0" max="25" placeholder="-" value="${pred.awayGoals ?? ''}" ${isLocked ? 'disabled' : ''}>
                        </div>
                    </div>

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
        
        currentDayContainer.appendChild(card);
        
        if (!isLocked) {
            const handleBet = async (res) => {
                const hGInput = document.getElementById(`home-goals-${match.id}`);
                const aGInput = document.getElementById(`away-goals-${match.id}`);
                let hG = hGInput.value;
                let aG = aGInput.value;
                
                if (hG !== '' && parseInt(hG, 10) > 25) { hG = '25'; hGInput.value = '25'; }
                if (aG !== '' && parseInt(aG, 10) > 25) { aG = '25'; aGInput.value = '25'; }
                
                if (hG !== '' && aG !== '') {
                    const h = parseInt(hG, 10);
                    const a = parseInt(aG, 10);
                    let impliedRes = 'E';
                    if (h > a) impliedRes = 'L';
                    else if (a > h) impliedRes = 'V';
                    if (impliedRes !== res) res = impliedRes;
                }
                
                const statusEl = document.getElementById(`status-${match.id}`);
                ['L','E','V'].forEach(k => {
                    const b = document.getElementById(`btn-${k}-${match.id}`);
                    b.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all ${k === 'E' ? 'mx-1' : ''} text-slate-400 hover:bg-slate-700`;
                });
                
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
            
            const enforceMax = (e) => { if(e.target.value && parseInt(e.target.value, 10) > 25) e.target.value = '25'; };
            document.getElementById(`home-goals-${match.id}`).addEventListener("input", enforceMax);
            document.getElementById(`away-goals-${match.id}`).addEventListener("input", enforceMax);
            document.getElementById(`home-goals-${match.id}`).addEventListener("input", handleGoalChange);
            document.getElementById(`away-goals-${match.id}`).addEventListener("input", handleGoalChange);
        }
    });
}

function renderRanking(ranking) {
    rankingListEl.innerHTML = "";
    const { user: currentUser } = getCurrentUser();

    const myRankIndex = currentUser ? ranking.findIndex(u => u.id === currentUser.id) : -1;

    const usersToShow = [];
    ranking.forEach((u, idx) => {
        if (idx < 5) {
            usersToShow.push({ user: u, index: idx });
        } else if (idx === myRankIndex) {
            usersToShow.push({ user: u, index: idx });
        }
    });

    usersToShow.forEach(({ user, index }, i) => {
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

        // Usar displayName (nombre apellido) si está disponible, sino alias
        const displayName = user.displayName || user.alias || 'Usuario';

        const tr = document.createElement("tr");
        const isMe = currentUser && currentUser.id === user.id;

        tr.className = `border-slate-700 transition-colors ${isMe ? 'row-me' : (index % 2 === 0 ? '' : 'row-alt')}`;
        tr.innerHTML = `
            <td class="px-4 py-3 text-center ${isMedal ? 'text-lg' : 'text-slate-400 font-medium'}">
                ${rankContent}
            </td>
            <td class="px-4 py-3 font-semibold ${index === 0 ? 'text-brand-500' : 'text-slate-200'} flex items-center gap-2">
                ${escapeHTML(displayName)}
            </td>
            <td class="px-4 py-3 text-right">
                <span class="bg-brand-900 text-brand-500 font-bold px-2 py-1 rounded">
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

    // Mapeamos para incluir datos del partido para agrupar por fecha
    const list = madePredictions.map(id => {
        return {
            id,
            pred: predictionsState[id],
            match: matchesState.find(m => m.id === id)
        };
    }).filter(item => item.match);

    // Ordenamos por fecha del partido
    list.sort((a, b) => new Date(a.match.matchDate) - new Date(b.match.matchDate));

    let lastDayLabel = null;
    let currentDayContainer = null;
    window.prodeOpenGridSections = window.prodeOpenGridSections || new Set();

    list.forEach(item => {
        const { match, pred } = item;
        const matchDate = new Date(match.matchDate);
        const dayLabel = match.tbd ? "Por Definir" : matchDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
        const dayLabelFormatted = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

        if (dayLabel !== lastDayLabel) {
            const sectionWrap = document.createElement("div");
            sectionWrap.className = "w-full mb-2";
            
            const isOpen = window.prodeOpenGridSections.has(dayLabel);
            
            const separator = document.createElement("button");
            separator.className = "w-full bg-slate-800/80 hover:bg-slate-700 transition-colors text-[10px] text-slate-400 font-bold py-2 px-3 rounded-lg border-l-2 border-brand-500/50 flex justify-between items-center cursor-pointer focus:outline-none uppercase tracking-widest";
            separator.innerHTML = `
                <span>${dayLabelFormatted}</span>
                <i class="ph-bold ph-caret-down transition-transform transform ${isOpen ? 'rotate-180' : ''}"></i>
            `;
            
            const container = document.createElement("div");
            container.className = `space-y-3 mt-2 ${isOpen ? '' : 'hidden'}`;
            currentDayContainer = container;
            
            separator.addEventListener("click", () => {
                const isHidden = container.classList.contains("hidden");
                if (isHidden) {
                    container.classList.remove("hidden");
                    separator.querySelector('.ph-caret-down').classList.add('rotate-180');
                    window.prodeOpenGridSections.add(dayLabel);
                } else {
                    container.classList.add("hidden");
                    separator.querySelector('.ph-caret-down').classList.remove('rotate-180');
                    window.prodeOpenGridSections.delete(dayLabel);
                }
            });

            sectionWrap.appendChild(separator);
            sectionWrap.appendChild(container);
            predictionsGridEl.appendChild(sectionWrap);
            
            lastDayLabel = dayLabel;
        }

        let resText = "Empate";
        let resColor = "bg-slate-500 text-white";
        if (pred.result === 'L') { resText = `Gana ${match.homeTeam}`; resColor = "bg-brand-500 text-white"; }
        if (pred.result === 'V') { resText = `Gana ${match.awayTeam}`; resColor = "bg-brand-500 text-white"; }

        if (pred.homeGoals !== undefined && pred.awayGoals !== undefined && pred.homeGoals !== '' && pred.awayGoals !== '') {
            resText += ` (${pred.homeGoals}-${pred.awayGoals})`;
        }

        let dateUpdateStr = "Sin fecha";
        if (pred.updatedAt) {
            const upDate = new Date(pred.updatedAt);
            if (!isNaN(upDate.getTime())) {
                dateUpdateStr = upDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            }
        }

        const div = document.createElement("div");
        div.className = "bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 flex flex-col gap-1 fade-in";
        div.innerHTML = `
            <div class="flex justify-between items-start gap-2 w-full">
                <span class="text-[11px] font-bold font-sans text-slate-300 leading-tight">
                    ${escapeHTML(match.homeTeam)} vs ${escapeHTML(match.awayTeam)}
                </span>
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${resColor}">
                    ${resText}
                </span>
            </div>
            <div class="text-[9px] text-slate-500 italic mt-1 flex items-center justify-between">
                <span>Modificado:</span>
                <span>${dateUpdateStr}</span>
            </div>
        `;
        currentDayContainer.appendChild(div);
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
            btnExportCsv.innerHTML = '<span class="spin-loader"></span>';
            btnExportCsv.disabled = true;
        }
        
        // Wait for DOM layout
        await new Promise(r => setTimeout(r, 200));
        
        // Mute SecurityError logs from html-to-image trying to read Cross-Origin cssRules (Phosphor icons)
        const originalConsoleError = console.error;
        console.error = (...args) => {
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error inlining remote css file')) return;
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error while reading CSS rules')) return;
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error loading remote stylesheet')) return;
            originalConsoleError(...args);
        };

        const dataUrl = await toPng(rankingView, {
            backgroundColor: '#0f172a', // brand-dark
            pixelRatio: 2 // High quality
        });
        
        console.error = originalConsoleError;
        
        const link = document.createElement("a");
        link.download = `Ranking_Prode_${userAliasDisplay.textContent}.png`;
        link.href = dataUrl;
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
            const { data: users, error } = await supabase
                .from('users')
                .select('nombre, apellido, legajo, alias, score, created_at')
                .order('score', { ascending: false })
                .order('apellido', { ascending: true });

            if (error) throw error;
            if (!users || users.length === 0) return alert("No hay usuarios.");

            // Excluir al superadmin del export (es un usuario oculto de debug)
            const filteredUsers = users.filter(u => (u.alias || '').toLowerCase() !== SUPER_ADMIN_ALIAS);
            if (filteredUsers.length === 0) return alert("No hay usuarios registrados.");

            let csvContent = "Posicion;Nombre;Apellido;Legajo;Puntaje Total;Fecha Registro\r\n";
            filteredUsers.forEach((u, i) => {
                const dateStr  = new Date(u.created_at).toLocaleDateString('es-AR');
                const nombre   = u.nombre   || u.alias || '';
                const apellido = u.apellido || '';
                const legajo   = u.legajo   || '';
                csvContent += `"${i + 1}";"${nombre}";"${apellido}";"${legajo}";"${u.score || 0}";"${dateStr}"\r\n`;
            });

            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const dateSuffix = new Date().toISOString().split('T')[0];
            link.setAttribute("download", `Ranking_RRHH_${dateSuffix}.csv`);
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

// =======================
// AVATAR UPLOAD
// =======================

// Input de archivo oculto
const avatarFileInput = document.createElement('input');
avatarFileInput.type = 'file';
avatarFileInput.accept = 'image/jpeg,image/png,image/webp';
avatarFileInput.style.display = 'none';
document.body.appendChild(avatarFileInput);

/**
 * Comprime una imagen a WebP usando Canvas.
 * Reduce primero a 300×300px, luego ajusta calidad hasta que pese ≤ 140KB.
 */
async function compressToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const SIZE = 300;
                const canvas = document.createElement('canvas');
                canvas.width  = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext('2d');

                // Recorte centrado (crop cuadrado)
                const side = Math.min(img.width, img.height);
                const sx = (img.width  - side) / 2;
                const sy = (img.height - side) / 2;
                ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

                // Reducir calidad hasta ≤ 140 KB
                let quality = 0.85;
                let blob;
                const tryCompress = () => {
                    canvas.toBlob((b) => {
                        if (!b) { reject(new Error('Canvas toBlob falló')); return; }
                        if (b.size <= 143360 || quality <= 0.3) {
                            resolve(b);
                        } else {
                            quality -= 0.1;
                            tryCompress();
                        }
                    }, 'image/webp', quality);
                };
                tryCompress();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

if (userAvatarImg) {
    // Click en avatar → abrir selector de archivo
    userAvatarImg.style.cursor = 'pointer';
    userAvatarImg.title = 'Hacer clic para cambiar tu foto de perfil';

    userAvatarImg.addEventListener('click', () => {
        const { user } = getCurrentUser();
        if (!user) return;
        avatarFileInput.click();
    });

    avatarFileInput.addEventListener('change', async () => {
        const file = avatarFileInput.files[0];
        if (!file) return;
        avatarFileInput.value = ''; // reset para poder elegir el mismo archivo de nuevo

        const { user } = getCurrentUser();
        if (!user) return;

        // Mostrar anillo de carga sobre el avatar
        const avatarWrapper = userAvatarImg.parentElement;
        userAvatarImg.style.opacity = '0.4';
        avatarWrapper.style.outline = '2px solid #22c55e';

        try {
            // 1. Comprimir imagen
            const blob = await compressToWebP(file);
            const filePath = `${user.id}.webp`;

            // 2. Subir a Supabase Storage (upsert)
            const { error: uploadErr } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (uploadErr) throw uploadErr;

            // 3. Obtener URL pública
            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Añadir cache-buster para forzar recarga
            const publicUrl = urlData.publicUrl + '?t=' + Date.now();

            // 4. Actualizar tabla users
            const err = await updateAvatarUrl(user.id, publicUrl);
            if (err) throw err;

            // 5. Mostrar imagen nueva
            userAvatarImg.setAttribute('src', publicUrl);

            // Guardar también en localStorage como caché local
            localStorage.setItem(`avatar_${user.id}`, publicUrl);

        } catch(err) {
            console.error('Error al subir avatar:', err);
            alert('No se pudo subir la imagen. Asegurate de que sea JPG, PNG o WebP y pese menos de 150 KB.');
        } finally {
            userAvatarImg.style.opacity = '1';
            avatarWrapper.style.outline = '';
        }
    });
}

// =======================
// ADMIN PROMOTE LOGIC
// =======================
const logoCup = document.getElementById("logo-cup");
if (logoCup) {
    logoCup.addEventListener("click", () => {
        // Solo el superadmin puede delegar
        if (!IS_SUPER_ADMIN) return;

        const targetToPromote = prompt("Ingrese el ALIAS o CORREO ELECTRÓNICO del usuario deseado:");
        if (!targetToPromote) return;

        let extraAdmins = JSON.parse(localStorage.getItem('extra_admins') || '[]');
        // Limpiamos los sucios preexistentes (viejos) para que el toggle logre igualar el String:
        extraAdmins = extraAdmins.map(u => u.trim());
        const targetLower = targetToPromote.toLowerCase().trim();
        
        if (!extraAdmins.includes(targetLower)) {
            extraAdmins.push(targetLower);
            localStorage.setItem('extra_admins', JSON.stringify(extraAdmins));
            alert(`¡Ascendido! ${targetToPromote} ahora posee permisos de administrador.`);
        } else {
            // Toggle off (Degradar a común)
            extraAdmins = extraAdmins.filter(u => u !== targetLower);
            localStorage.setItem('extra_admins', JSON.stringify(extraAdmins));
            alert(`¡Degradado! ${targetToPromote} ha vuelto a ser un usuario común.`);
        }
        location.reload();
    });
}

// =============================================
// MODAL EDITAR USUARIO (Admin)
// =============================================
const modalEditUser  = document.getElementById("modal-edit-user");
const editUserId     = document.getElementById("edit-user-id");
const editNombre     = document.getElementById("edit-nombre");
const editApellido   = document.getElementById("edit-apellido");
const editLegajo     = document.getElementById("edit-legajo");
const editUserError  = document.getElementById("edit-user-error");
const btnEditCancel  = document.getElementById("btn-edit-cancel");
const btnEditSave    = document.getElementById("btn-edit-save");

function openEditModal(user) {
    if (!modalEditUser) return;
    editUserId.value    = user.id;
    editNombre.value    = user.nombre   || '';
    editApellido.value  = user.apellido || '';
    editLegajo.value    = user.legajo   || '';
    editUserError.classList.add('hidden');
    modalEditUser.classList.remove('hidden');
    modalEditUser.classList.add('flex');
}

if (btnEditCancel) {
    btnEditCancel.addEventListener('click', () => {
        modalEditUser.classList.add('hidden');
        modalEditUser.classList.remove('flex');
    });
}

if (btnEditSave) {
    btnEditSave.addEventListener('click', async () => {
        const uid      = editUserId.value;
        const nombre   = editNombre.value.trim();
        const apellido = editApellido.value.trim();
        const legajo   = editLegajo.value.trim();

        if (!nombre || !apellido || !legajo) {
            editUserError.textContent = "Todos los campos son obligatorios.";
            editUserError.classList.remove('hidden');
            return;
        }

        const alias = `${nombre} ${apellido}`;
        btnEditSave.disabled = true;

        const { error } = await supabase
            .from('users')
            .update({ nombre, apellido, legajo, alias })
            .eq('id', uid);

        btnEditSave.disabled = false;

        if (error) {
            editUserError.textContent = 'Error: ' + (error.message.includes('unique') ? 'Ese legajo ya está en uso.' : error.message);
            editUserError.classList.remove('hidden');
            return;
        }

        modalEditUser.classList.add('hidden');
        modalEditUser.classList.remove('flex');
        await loadUsersGrid();
    });
}

async function loadUsersGrid() {
    const listEl = document.getElementById("users-table-list");
    if (!listEl) return;

    showLoader();
    try {
        const { data: rawUsers, error } = await supabase
            .from('users')
            .select('id, nombre, apellido, legajo, alias, email, score, created_at, is_banned')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let users = rawUsers.filter(u => (u.alias || '').toLowerCase() !== 'asterion30');

        // Filtrado por inactivos
        const showInactive = checkShowInactive ? checkShowInactive.checked : false;
        if (!showInactive) {
            users = users.filter(u => u.is_banned !== true);
        }

        if (!users || users.length === 0) {
            listEl.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-slate-500">No hay usuarios para mostrar</td></tr>`;
            document.getElementById("users-pagination-info").textContent = "Sin usuarios";
            document.getElementById("btn-users-prev").disabled = true;
            document.getElementById("btn-users-next").disabled = true;
            hideLoader();
            return;
        }

        cachedUsers = users; // Guardar para exportación y controles
        renderUsersTablePage();
    } catch(e) {
        console.error("Error loading users grid", e);
    } finally {
        hideLoader();
    }
}

function renderUsersTablePage() {
    const listEl = document.getElementById("users-table-list");
    if (!listEl) return;

    const start = usersCurrentPage * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const pageUsers = cachedUsers.slice(start, end);

    listEl.innerHTML = "";
    pageUsers.forEach((u, i) => {
        const absoluteIndex = start + i + 1;
        const dateStr    = new Date(u.created_at).toLocaleDateString('es-AR');
        const nombre     = escapeHTML(u.nombre   || u.alias || '—');
        const apellido   = escapeHTML(u.apellido || '—');
        const legajo     = escapeHTML(u.legajo   || '—');
        const isBanned   = u.is_banned === true;

        const tr = document.createElement("tr");
        tr.className = `border-slate-700/50 hover:bg-slate-800/30 transition-colors ${isBanned ? 'opacity-50 grayscale' : ''}`;
        tr.innerHTML = `
            <td class="px-3 py-3 text-center text-slate-500 text-sm">${absoluteIndex}</td>
            <td class="px-3 py-3 font-semibold ${isBanned ? 'text-red-400' : 'text-slate-200'} text-sm">
                ${nombre} ${isBanned ? '<span class="text-[10px] bg-red-900/40 px-1 rounded ml-1">BLOQUEADO</span>' : ''}
            </td>
            <td class="px-3 py-3 font-semibold text-slate-200 text-sm">${apellido}</td>
            <td class="px-3 py-3 text-slate-400 text-sm font-mono">${legajo}</td>
            <td class="px-3 py-3 text-center text-xs hidden md:table-cell">
                ${u.email ? `<a href="mailto:${u.email}" class="text-brand-500 hover:text-brand-400 transition-colors" title="Enviar correo a ${u.email}"><i class="ph-bold ph-envelope-simple text-lg"></i></a>` : '—'}
            </td>
            <td class="px-3 py-3 text-slate-400 text-xs hidden sm:table-cell">${dateStr}</td>
            <td class="px-3 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button data-uid="${u.id}" class="btn-edit-user bg-slate-700 hover:bg-brand-600 text-white text-xs font-bold py-1 px-2 rounded-lg transition-all flex items-center gap-1" title="Editar">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                    ${IS_ADMIN ? `
                    <button data-uid="${u.id}" data-name="${nombre} ${apellido}" data-alias="${escapeHTML(u.alias || '')}" data-banned="${isBanned}" class="btn-delete-user ${isBanned ? 'bg-green-900/60 hover:bg-green-600 text-green-300' : 'bg-red-900/60 hover:bg-red-600 text-red-300'} hover:text-white text-xs font-bold py-1 px-2 rounded-lg transition-all flex items-center gap-1" title="${isBanned ? 'Reactivar' : 'Bloquear (Lista Negra)'}">
                        <i class="ph-bold ${isBanned ? 'ph-user-plus' : 'ph-user-minus'}"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        listEl.appendChild(tr);
    });

    // Event listeners para botones generados dinámicamente
    listEl.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.dataset.uid;
            const user = cachedUsers.find(u => u.id === uid);
            if (user) openEditModal(user);
        });
    });

    listEl.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid      = btn.dataset.uid;
            const name     = btn.dataset.name;
            const targetAlias = (btn.dataset.alias || '').toLowerCase();
            const wasBanned   = btn.dataset.banned === 'true';

            if (targetAlias === SUPER_ADMIN_ALIAS) {
                alert('No es posible bloquear al superadministrador.');
                return;
            }

            const confirmMsg  = wasBanned 
                ? `¿Deseas reactivar el acceso para ${name}?`
                : `¿Bloquear a ${name}?\n\nAl bloquearlo:\n1. Se cierra su sesión inmediatamente.\n2. NO podrá volver a entrar aunque recargue la página.\n3. Sus datos actuales se mantienen pero quedan inactivos.`;

            if (!confirm(confirmMsg)) return;

            showLoader();
            const { error } = await supabase
                .from('users')
                .update({ is_banned: !wasBanned })
                .eq('id', uid);

            if (error) {
                hideLoader();
                alert('Error en la operación: ' + error.message);
                return;
            }
            await loadUsersGrid();
        });
    });

    // Actualizar controles de paginación
    const total = cachedUsers.length;
    const lastPos = Math.min(end, total);
    document.getElementById("users-pagination-info").textContent = `Mostrando ${start + 1}-${lastPos} de ${total}`;
    
    document.getElementById("btn-users-prev").disabled = usersCurrentPage === 0;
    document.getElementById("btn-users-next").disabled = end >= total;
}

// Configuración de botones previos/siguientes una sola vez
const btnPrev = document.getElementById("btn-users-prev");
const btnNext = document.getElementById("btn-users-next");
if (btnPrev && btnNext) {
    btnPrev.onclick = () => { if (usersCurrentPage > 0) { usersCurrentPage--; renderUsersTablePage(); } };
    btnNext.onclick = () => { if ((usersCurrentPage + 1) * USERS_PER_PAGE < cachedUsers.length) { usersCurrentPage++; renderUsersTablePage(); } };
}

// Exportar CSV (se configura fuera para no duplicar listeners)
const btnExportUsers = document.getElementById("btn-export-users-csv");
if (btnExportUsers) {
    btnExportUsers.onclick = () => {
        const showInactive = document.getElementById("check-show-inactive")?.checked || false;
        let usersToExport = cachedUsers;
        
        if (!showInactive) {
            usersToExport = cachedUsers.filter(u => u.is_banned !== true);
        }

        let csvContent = "Posicion;Nombre;Apellido;Legajo;Email;Puntaje;Estado;Fecha Registro\r\n";
        usersToExport.forEach((u, i) => {
            const dateDesc = new Date(u.created_at).toLocaleDateString('es-AR');
            const estado   = u.is_banned ? 'BLOQUEADO' : 'ACTIVO';
            csvContent += `"${i+1}";"${u.nombre||''}";"${u.apellido||''}";"${u.legajo||''}";"${u.email||''}";"${u.score||0}";"${estado}";"${dateDesc}"\r\n`;
        });
        const bom  = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Usuarios_${showInactive ? 'Todos' : 'Activos'}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };
}

// =======================
// LEGENDARY LEAGUES WORKFLOWS
// =======================

// Eventos de Modales de Liga
if (btnCreateLeague && modalCreateLeague) {
    btnCreateLeague.addEventListener("click", () => {
        modalCreateLeague.classList.remove("hidden");
        modalCreateLeague.classList.add("flex");
        if (leagueNameInput) leagueNameInput.value = "";
        if (leagueDescInput) leagueDescInput.value = "";
        if (leaguePrizesInput) leaguePrizesInput.value = "";
    });
}

if (btnCancelCreateLeague && modalCreateLeague) {
    btnCancelCreateLeague.addEventListener("click", () => {
        modalCreateLeague.classList.add("hidden");
        modalCreateLeague.classList.remove("flex");
    });
}

if (btnJoinLeague && modalJoinLeague) {
    btnJoinLeague.addEventListener("click", () => {
        modalJoinLeague.classList.remove("hidden");
        modalJoinLeague.classList.add("flex");
        if (joinCodeInput) joinCodeInput.value = "";
    });
}

if (btnCancelJoinLeague && modalJoinLeague) {
    btnCancelJoinLeague.addEventListener("click", () => {
        modalJoinLeague.classList.add("hidden");
        modalJoinLeague.classList.remove("flex");
    });
}

if (btnSaveLeague) {
    btnSaveLeague.addEventListener("click", async () => {
        const name = leagueNameInput?.value.trim();
        const desc = leagueDescInput?.value.trim() || "";
        const prizes = leaguePrizesInput?.value.trim() || "";

        if (!name) {
            alert("Por favor ingresa un nombre para la liga.");
            return;
        }

        const { user } = getCurrentUser();
        if (!user) return;

        showLoader();
        try {
            await createLeague(user.id, name, desc, prizes);
            modalCreateLeague.classList.add("hidden");
            modalCreateLeague.classList.remove("flex");
            await renderLegendaryView();
        } catch (err) {
            alert("Error al crear la liga: " + err.message);
        } finally {
            hideLoader();
        }
    });
}

if (btnConfirmJoin) {
    btnConfirmJoin.addEventListener("click", async () => {
        const code = joinCodeInput?.value.trim();

        if (!code) {
            alert("Por favor ingresa un código de invitación.");
            return;
        }

        const { user } = getCurrentUser();
        if (!user) return;

        showLoader();
        try {
            await joinLeagueByCode(user.id, code);
            modalJoinLeague.classList.add("hidden");
            modalJoinLeague.classList.remove("flex");
            await renderLegendaryView();
            alert("¡Te has unido con éxito a la liga!");
        } catch (err) {
            alert("Error al unirte a la liga: " + err.message);
        } finally {
            hideLoader();
        }
    });
}

async function renderLegendaryView() {
    const { user } = getCurrentUser();
    if (!user) return;

    if (!leaguesContainer || !leaguesEmptyState) return;

    showLoader();
    try {
        const leaguesData = await fetchUserLeagues(user.id);
        if (!leaguesData || leaguesData.length === 0) {
            leaguesEmptyState.classList.remove("hidden");
            leaguesContainer.classList.add("hidden");
            return;
        }

        leaguesEmptyState.classList.add("hidden");
        leaguesContainer.classList.remove("hidden");
        leaguesContainer.innerHTML = "";

        leaguesData.forEach(item => {
            const league = item.user_groups;
            if (!league) return;

            const isOwner = league.owner_id === user.id;
            const card = document.createElement("div");
            card.className = "bg-slate-800/80 border border-slate-700/60 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between space-y-4 hover:border-brand-500/30 transition-all duration-300";
            
            card.innerHTML = `
                <div class="space-y-2">
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="text-lg font-black text-white uppercase tracking-tight line-clamp-1">${escapeHTML(league.name)}</h3>
                        ${isOwner 
                            ? `<span class="text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Creador</span>` 
                            : `<span class="text-[9px] bg-slate-700/40 text-slate-400 border border-slate-600/30 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Miembro</span>`
                        }
                    </div>
                    ${league.description 
                        ? `<p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${escapeHTML(league.description)}</p>` 
                        : `<p class="text-xs text-slate-500 italic">Sin descripción.</p>`
                    }
                    ${league.prizes 
                        ? `<div class="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl flex items-start gap-1.5 mt-2">
                            <i class="ph-bold ph-gift text-amber-400 text-xs mt-0.5"></i>
                            <p class="text-[10px] text-amber-400/90 font-medium line-clamp-1">${escapeHTML(league.prizes)}</p>
                           </div>`
                        : ''
                    }
                </div>
                <div class="flex gap-2 items-center justify-between pt-2 border-t border-slate-700/40">
                    <div class="text-left">
                        <span class="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Código</span>
                        <span class="text-xs font-mono font-bold text-brand-400">${escapeHTML(league.invite_code)}</span>
                    </div>
                    <button class="btn-view-league px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-1">
                        Ver Detalles <i class="ph-bold ph-caret-right"></i>
                    </button>
                </div>
            `;

            const btn = card.querySelector(".btn-view-league");
            btn.onclick = () => {
                setActiveNav(btnNavLegendary, leagueDetailsView);
                renderLeagueDetailsView(league);
            };

            leaguesContainer.appendChild(card);
        });

    } catch (err) {
        alert("Error al cargar tus ligas: " + err.message);
    } finally {
        hideLoader();
    }
}

async function renderLeagueDetailsView(league) {
    const { user } = getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById("league-details-name");
    const descEl = document.getElementById("league-details-desc");
    const codeEl = document.getElementById("league-details-code");
    const prizesContainer = document.getElementById("league-details-prizes-container");
    const prizesEl = document.getElementById("league-details-prizes");
    const membersCountEl = document.getElementById("league-members-count");
    const rankingBody = document.getElementById("league-ranking-body");
    const colEliminarMiembro = document.getElementById("col-eliminar-miembro");

    if (!nameEl || !rankingBody) return;

    nameEl.textContent = league.name;
    descEl.textContent = league.description || "Sin descripción.";
    codeEl.textContent = league.invite_code;

    const btnShareLeague = document.getElementById("btn-share-league");
    if (btnShareLeague) {
        btnShareLeague.classList.remove("hidden");
        btnShareLeague.onclick = async () => {
            const shareText = `¡Únete a mi Liga Legendaria "${league.name}" en Prode Mundial 2026!\n\nCódigo de Invitación: ${league.invite_code}\n\nIngresa aquí: ${window.location.origin}`;
            
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Invitación a Liga Legendaria',
                        text: shareText
                    });
                } catch (err) {
                    console.log("Compartir cancelado o no soportado.", err);
                }
            } else {
                // Fallback a cliente de correo nativo si Web Share no está disponible
                window.location.href = `mailto:?subject=${encodeURIComponent("Invitación a Liga Legendaria")}&body=${encodeURIComponent(shareText)}`;
            }
        };
    }

    if (league.prizes) {
        prizesEl.textContent = league.prizes;
        prizesContainer.classList.remove("hidden");
    } else {
        prizesContainer.classList.add("hidden");
    }

    const isOwner = league.owner_id === user.id;
    if (isOwner) {
        colEliminarMiembro.classList.remove("hidden");
    } else {
        colEliminarMiembro.classList.add("hidden");
    }

    showLoader();
    try {
        const members = await fetchLeagueDetails(league.id);
        membersCountEl.textContent = `${members.length} miembro(s)`;
        rankingBody.innerHTML = "";

        members.forEach((member, index) => {
            const isMedal = index < 3;
            let rankContent = `${index + 1}`;
            if (index === 0) rankContent = "🥇";
            else if (index === 1) rankContent = "🥈";
            else if (index === 2) rankContent = "🥉";

            const displayName = member.alias || (member.nombre + ' ' + member.apellido).trim() || "Usuario";
            const isMe = member.id === user.id;

            const tr = document.createElement("tr");
            tr.className = `border-slate-800 transition-colors ${isMe ? 'bg-brand-500/10 text-white font-bold' : (index % 2 === 0 ? '' : 'bg-slate-800/20')}`;

            let actionHtml = "";
            if (isOwner) {
                if (member.id === league.owner_id) {
                    actionHtml = `<td class="px-4 py-3 text-center text-[10px] text-slate-500 italic font-semibold">Creador</td>`;
                } else {
                    actionHtml = `
                        <td class="px-4 py-3 text-center">
                            <button class="btn-expel-member px-2 py-1 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-lg text-[10px] font-bold transition-all" data-id="${member.id}" data-alias="${escapeHTML(displayName)}">
                                Expulsar
                            </button>
                        </td>
                    `;
                }
            }

            const flagHtml = member.avatar_url
                ? `<img src="${escapeHTML(member.avatar_url)}" alt="Avatar" class="w-6 h-6 rounded-full object-cover border border-slate-700">`
                : `<div class="w-6 h-6 bg-slate-700 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 font-bold">${displayName.substring(0,2).toUpperCase()}</div>`;

            tr.innerHTML = `
                <td class="px-4 py-3 text-center font-bold ${isMedal ? 'text-lg' : 'text-slate-400'}">${rankContent}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                        ${flagHtml}
                        <span class="text-xs sm:text-sm line-clamp-1">${escapeHTML(displayName)} ${isMe ? ' (Vos)' : ''}</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-right font-black text-slate-200">${member.score || 0} pts</td>
                ${isOwner ? actionHtml : ''}
            `;

            if (isOwner && member.id !== league.owner_id) {
                const btnExpel = tr.querySelector(".btn-expel-member");
                btnExpel.onclick = async () => {
                    const confirmText = `¿Estás seguro de que querés expulsar a ${displayName} de esta liga?`;
                    if (confirm(confirmText)) {
                        showLoader();
                        try {
                            await removeLeagueMember(league.id, member.id);
                            await renderLeagueDetailsView(league);
                        } catch (err) {
                            alert("Error al expulsar al miembro: " + err.message);
                        } finally {
                            hideLoader();
                        }
                    }
                };
            }

            rankingBody.appendChild(tr);
        });

    } catch (err) {
        alert("Error al cargar los miembros: " + err.message);
    } finally {
        hideLoader();
    }
}
