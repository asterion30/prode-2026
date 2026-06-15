import './load-fonts.js';

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

// Parse and preserve invite query parameter on load
const initialParams = new URLSearchParams(window.location.search);
const inviteCodeParam = initialParams.get('invite');
if (inviteCodeParam) {
    localStorage.setItem('pending_invite_code', inviteCodeParam.trim());
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
}

// =======================
// LEAGUE PAGINATION STATE
// =======================
let currentLeaguePage = 0;
let currentLeagueMembers = [];
let currentLeagueOwnerId = null;
let currentLeagueId = null;
let rankingState = [];
let jackpotWinningPoints = 0;
let luckyPrizeShared = false;
let fixtureViewMode = "grid";
try {
    fixtureViewMode = localStorage.getItem("fixture_view_mode") || "grid";
} catch (e) {
    console.warn("Storage access not allowed or threw an error:", e);
}


// =======================
// DOM ELEMENTS
// =======================
const userAvatarImg = document.getElementById("user-avatar-img");
if (userAvatarImg) {
    userAvatarImg.addEventListener("error", () => {
        userAvatarImg.src = '/assets/avatar.webp';
    });
}
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const appContainer = document.getElementById("app-container");

const matchesView = document.getElementById("matches-view");
const rankingView = document.getElementById("ranking-view");
const gruposView  = document.getElementById("grupos-view");
const usersView = document.getElementById("users-view");
const matchesListEl = document.getElementById("matches-list");
const rankingListEl = document.getElementById("ranking-list");
const predictionsGridEl = document.getElementById("predictions-grid");
const stageTabsContainer = document.getElementById("stage-tabs");
const btnToggleFixtureView = document.getElementById("btn-toggle-fixture-view");
const fixtureViewText = document.getElementById("fixture-view-text");

const btnNavMatches = document.getElementById("nav-matches");
const btnNavRanking = document.getElementById("nav-ranking");
const btnNavGrupos  = document.getElementById("nav-grupos");
const btnNavUsers = document.getElementById("nav-users");
const btnToggleGroups = document.getElementById("btn-toggle-groups");
const groupsCollapseContainer = document.getElementById("groups-collapse-container");
const iconToggleGroups = document.getElementById("icon-toggle-groups");

// Leagues DOM Elements
const legendaryView = document.getElementById("legendary-view");
const leagueDetailsView = document.getElementById("league-details-view");
const btnNavLegendary = document.getElementById("nav-legendary");

const especialesView = document.getElementById("especiales-view");
const btnNavEspeciales = document.getElementById("nav-especiales");

const btnToggleRankingGeneral = document.getElementById("btn-toggle-ranking-general");
const legendaryRankingContainer = document.getElementById("legendary-ranking-container");
const premiosMatchSelect = document.getElementById("premios-match-select");

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
const btnLogout = document.getElementById("btn-logout");


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
        if (appContainer) appContainer.classList.add("md:h-[800px]");
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

        IS_ADMIN = IS_SUPER_ADMIN; // Solo asterion30 / asterion30@gmail.com está autorizado a cambiar
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

        // Show/hide admin chicana upload panel
        const adminChicanaPanel = document.getElementById("admin-chicana-upload-panel");
        if (adminChicanaPanel) {
            if (IS_SUPER_ADMIN) {
                adminChicanaPanel.classList.remove("hidden");
            } else {
                adminChicanaPanel.classList.add("hidden");
            }
        }

        // Cargar avatar: primero desde BD, luego fallback a localStorage
        const savedAvatar = localStorage.getItem(`avatar_${user.id}`);
        const cleanedAvatarUrl = (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') ? avatarUrl.trim() : null;
        const cleanedSavedAvatar = (savedAvatar && savedAvatar !== 'null' && savedAvatar !== 'undefined') ? savedAvatar.trim() : null;

        if (cleanedAvatarUrl) {
            userAvatarImg.setAttribute('src', cleanedAvatarUrl);
        } else if (cleanedSavedAvatar) {
            userAvatarImg.setAttribute('src', cleanedSavedAvatar);
        } else {
            userAvatarImg.setAttribute('src', '/assets/avatar.webp');
        }

        if (!isAppInitialized) {
            setupAppSubscriptions(user.uid || user.id);
            renderStageTabs();
            initEspecialesView();
            isAppInitialized = true;
            
            // Process pending invite code if any
            handlePendingInvite(user.uid || user.id);
        }

        hideLoader();
    } else {
        // Logged Out
        mainView.classList.add("hidden");
        loginView.classList.remove("hidden");
        if (appContainer) appContainer.classList.remove("md:h-[800px]");
        const adminChicanaPanel = document.getElementById("admin-chicana-upload-panel");
        if (adminChicanaPanel) adminChicanaPanel.classList.add("hidden");
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
        initPremios();
        if (IS_ADMIN) {
            renderAdminMatches();
            populateAdminMatchesSelect();
        }
    });

    // Suscribirse a predicciones
    subscribeToUserPredictions(uid, (preds) => {
        predictionsState = preds;
        renderMatches(); // Re-render to show values
        renderPredictionsGrid();
    });

    // Suscribirse al Ranking
    subscribeToRanking((ranking) => {
        rankingState = ranking;
        renderRanking(ranking);
        if (typeof updateJackpotAvailability === 'function') {
            updateJackpotAvailability();
        }
    });
}

// =======================
// NAVIGATION HELPERS
// =======================
const ALL_VIEWS = [matchesView, gruposView, legendaryView, leagueDetailsView, rankingView, usersView, especialesView].filter(Boolean);
const ALL_NAV_BTNS = [btnNavMatches, btnNavGrupos, btnNavLegendary, btnNavRanking, btnNavUsers, btnNavEspeciales].filter(Boolean);

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
        
        // Reset custom chicana carousel scroll snap position when entering the ranking view
        if (activeView === rankingView) {
            setTimeout(resetChicanaCarouselPosition, 50);
        }
    }
    if (activeBtn) {
        activeBtn.classList.add('text-brand-500', 'bg-brand-500/10', 'border-brand-500/20');
        activeBtn.classList.remove('text-slate-400', 'border-transparent');
    }
}

btnNavMatches.addEventListener('click', () => setActiveNav(btnNavMatches, matchesView));

if (btnToggleFixtureView) {
    const fixtureViewIconEl = document.getElementById("fixture-view-icon") || btnToggleFixtureView.querySelector('i:last-child');
    if (fixtureViewIconEl) {
        fixtureViewIconEl.className = fixtureViewMode === 'carousel' ? "ph-bold ph-list text-sm" : "ph-bold ph-slideshow text-sm";
    }
    
    btnToggleFixtureView.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("btnToggleFixtureView clicked. Current mode before toggle:", fixtureViewMode);
        fixtureViewMode = fixtureViewMode === 'carousel' ? 'grid' : 'carousel';
        console.log("New mode set to:", fixtureViewMode);
        
        try {
            localStorage.setItem("fixture_view_mode", fixtureViewMode);
        } catch (err) {
            console.error("Failed to write to localStorage in sandboxed env:", err);
        }
        
        if (fixtureViewIconEl) {
            fixtureViewIconEl.className = fixtureViewMode === 'carousel' ? "ph-bold ph-list text-sm" : "ph-bold ph-slideshow text-sm";
        }
        
        renderMatches();
    });
}

btnNavRanking.addEventListener('click', () => setActiveNav(btnNavRanking, rankingView));

if (btnNavGrupos) {
    btnNavGrupos.addEventListener('click', () => {
        setActiveNav(btnNavGrupos, gruposView);
        // Reset groups view to collapsed by default so the scoring rules are seen first
        if (groupsCollapseContainer && iconToggleGroups) {
            groupsCollapseContainer.classList.add("hidden");
            iconToggleGroups.classList.remove("rotate-90");
        }
        renderGroupsView();
    });
}

// Handler for expanding and collapsing the positions tables
if (btnToggleGroups && groupsCollapseContainer && iconToggleGroups) {
    btnToggleGroups.addEventListener("click", () => {
        const isHidden = groupsCollapseContainer.classList.contains("hidden");
        if (isHidden) {
            groupsCollapseContainer.classList.remove("hidden");
            iconToggleGroups.classList.add("rotate-90");
        } else {
            groupsCollapseContainer.classList.add("hidden");
            iconToggleGroups.classList.remove("rotate-90");
        }
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
    btnNavUsers.addEventListener('click', () => {
        setActiveNav(btnNavUsers, usersView);
        initAdminView();
    });
}

if (btnNavEspeciales) {
    btnNavEspeciales.addEventListener('click', () => {
        setActiveNav(btnNavEspeciales, especialesView);
        initEspecialesView();
    });
}

if (checkShowInactive) {
    checkShowInactive.addEventListener('change', () => {
        loadUsersGrid();
    });
}

const btnToggleStream = document.getElementById("btn-toggle-stream");
const streamWrapper = document.getElementById("stream-wrapper");
const streamIcon = document.getElementById("stream-icon");
const btnSearchShorts = document.getElementById("btn-search-shorts");
const btnRandomShorts = document.getElementById("btn-random-shorts");
const shortsQueryInput = document.getElementById("shorts-query-input");
const shortsPlayer = document.getElementById("shorts-player");

const FALLBACK_SHORTS = [
    "lR1DSAyoIDI",
    "uht-tdFSLNU",
    "nFGxeA1K5tE",
    "Vj8rlVWk0fg",
    "t_plIcP4vGM",
    "d0cxj-RBQMQ",
    "bKsOToFbZDc",
    "GNXqaC-8vBc"
];

// Curated default search queries representing different Argentinian streamers and World Cup topics
const SHORTS_QUERIES = [
    "Tim Payne seleccion argentina",
    "Davoo Xeneize argentina goles",
    "La Cobra futbol argentino",
    "Los Displicentes seleccion argentina",
    "streamers futbol argentino",
    "mejores goles seleccion argentina",
    "Lionel Messi argentina shorts",
    "Scaloneta argentina shorts",
    "reacciones streamers futbol argentino"
];

let activeShortsPlaylist = [...FALLBACK_SHORTS];
// Pick a random default query on initial page load
let currentSearchQuery = SHORTS_QUERIES[Math.floor(Math.random() * SHORTS_QUERIES.length)];

/** Detect mobile/tablet to adjust autoplay behaviour */
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

async function fetchShorts(query) {
    try {
        const response = await fetch(`/api/shorts?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Search failed");
        const json = await response.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            return json.data;
        }
    } catch (err) {
        console.warn("Failed to fetch shorts from API, using fallback list:", err);
    }
    return FALLBACK_SHORTS;
}

async function updateShortsPlayer() {
    if (!shortsPlayer) return;
    const isVisible = !streamWrapper.classList.contains("hidden");
    if (!isVisible) return;

    // Show loading state
    shortsPlayer.src = "";

    // Mobile tap overlay: show it, then wire a one-time handler to dismiss it on tap
    const tapOverlay = document.getElementById("shorts-tap-overlay");
    if (tapOverlay) {
        if (isMobileDevice) {
            tapOverlay.classList.remove("hidden");
            // One-time listener: hide overlay on first tap so the iframe becomes interactive
            tapOverlay.addEventListener("click", () => {
                tapOverlay.classList.add("hidden");
            }, { once: true });
        } else {
            tapOverlay.classList.add("hidden");
        }
    }

    const playlist = await fetchShorts(currentSearchQuery);
    // Shuffle the playlist to provide variety even if the API result is cached
    activeShortsPlaylist = [...playlist].sort(() => Math.random() - 0.5);

    if (activeShortsPlaylist.length > 0) {
        const firstId = activeShortsPlaylist[0];
        const restIds = activeShortsPlaylist.slice(1).join(",");

        if (isMobileDevice) {
            // Mobile: no autoplay (browsers block it in iframes). User taps to play.
            shortsPlayer.src = `https://www.youtube-nocookie.com/embed/${firstId}?playlist=${restIds}&loop=1&autoplay=0&controls=1&modestbranding=1&rel=0&playsinline=1`;
        } else {
            // Desktop: autoplay muted
            shortsPlayer.src = `https://www.youtube-nocookie.com/embed/${firstId}?playlist=${restIds}&loop=1&autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1`;
        }
    }
}

if (btnToggleStream && streamWrapper && streamIcon) {
    btnToggleStream.addEventListener("click", async () => {
        const isHidden = streamWrapper.classList.contains("hidden");
        if (isHidden) {
            streamWrapper.classList.remove("hidden");
            streamIcon.classList.replace("ph-caret-down", "ph-caret-up");
            await updateShortsPlayer();
        } else {
            streamWrapper.classList.add("hidden");
            streamIcon.classList.replace("ph-caret-up", "ph-caret-down");
            if (shortsPlayer) shortsPlayer.src = "";
            // Reset overlay for next open
            const tapOverlay = document.getElementById("shorts-tap-overlay");
            if (tapOverlay && isMobileDevice) tapOverlay.classList.remove("hidden");
        }
    });
}

if (btnSearchShorts && shortsQueryInput && shortsPlayer) {
    btnSearchShorts.addEventListener("click", async () => {
        const query = shortsQueryInput.value.trim();
        if (query) {
            currentSearchQuery = query;
            await updateShortsPlayer();
        }
    });

    if (btnRandomShorts) {
        btnRandomShorts.addEventListener("click", async () => {
            // Pick a random query different from the current one to ensure a topic shift
            let newQuery = currentSearchQuery;
            if (SHORTS_QUERIES.length > 1) {
                while (newQuery === currentSearchQuery) {
                    newQuery = SHORTS_QUERIES[Math.floor(Math.random() * SHORTS_QUERIES.length)];
                }
            } else if (SHORTS_QUERIES.length > 0) {
                newQuery = SHORTS_QUERIES[0];
            }
            currentSearchQuery = newQuery;
            shortsQueryInput.value = ""; // Clear input to indicate random playlist search is active
            await updateShortsPlayer();
        });
    }

    shortsQueryInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            btnSearchShorts.click();
        }
    });

    const shortsSearchContainer = document.getElementById("shorts-search-container");
    if (shortsSearchContainer) {
        shortsSearchContainer.addEventListener("click", (e) => e.stopPropagation());
    }
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
                                ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${team.flag}.svg`
                                : null;
                            const flagHtml = flagSrc
                                ? `<img src="${flagSrc}" alt="${escapeHTML(team.team)}" class="w-5 h-auto rounded-sm object-cover border border-slate-600" loading="lazy">`
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

    containerEl.querySelectorAll("img").forEach(img => {
        img.addEventListener("error", () => {
            img.style.display = "none";
        });
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

function createMatchCardElement(match, isCarousel) {
    const matchDate = new Date(match.matchDate);
    const now = new Date();
    const diffMs = matchDate - now;
    const hoursLeft = diffMs / (1000 * 60 * 60);
    const isLocked = match.tbd || hoursLeft <= 1 || match.status === 'finished';
    const pred = predictionsState[match.id] || { result: '' };

    const card = document.createElement("div");
    card.className = isCarousel
        ? "bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl fade-in relative overflow-hidden shrink-0 snap-center w-full h-[295px] flex flex-col justify-between"
        : "bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm fade-in relative overflow-hidden";
    
    if (isLocked) {
        card.classList.add("opacity-60");
        if (match.tbd) card.classList.add("grayscale-[0.5]");
    }
    
    const timeStr = matchDate.toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const fullDateStr = matchDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const formattedDate = match.tbd ? 'TBD' : (isCarousel ? fullDateStr : timeStr);
    
    const renderFlag = (flagName, teamName) => {
        if (flagName === 'un') {
            return `<div class="w-7 h-7 mt-1 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 shadow-inner"><i class="ph-bold ph-question text-slate-400"></i></div>`;
        }
        return `<img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${flagName}.svg" alt="${teamName}" class="w-7 h-auto drop-shadow-md rounded-[2px] mt-1 object-cover border border-slate-700" loading="lazy">`;
    };

    let statusBadge = '';
    if (match.tbd) {
        statusBadge = `<div class="absolute top-0 right-0 bg-slate-600/80 text-[10px] text-white font-bold px-2 py-1 rounded-bl-lg">POR DEFINIR</div>`;
    } else if (hoursLeft <= 1 || match.status === 'finished') {
        statusBadge = `<div class="absolute top-0 right-0 bg-red-500/80 text-[10px] text-white font-bold px-2 py-1 rounded-bl-lg">CERRADO</div>`;
    }

    let finalScoreHtml = '';
    if (match.homeGoals !== null && match.homeGoals !== undefined && match.homeGoals !== '') {
        finalScoreHtml = `
            <div class="mt-2.5 mb-1 flex flex-col items-center justify-center bg-brand-500/10 border border-brand-500/20 rounded-xl py-1.5 px-3">
                <span class="text-[9px] text-brand-400 font-bold uppercase tracking-widest mb-0.5">Resultado Final</span>
                <span class="text-sm font-black text-white">${match.homeGoals} - ${match.awayGoals}</span>
            </div>
        `;
    }

    card.innerHTML = `
        ${statusBadge}
        <div class="text-center text-[10px] text-slate-400 mb-4 font-bold uppercase tracking-widest">${formattedDate}</div>
        
        <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
                <div class="flex flex-col items-center flex-[2] min-w-[70px] shrink-0">
                    <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.homeTeam}</span>
                    ${renderFlag(match.homeFlag, match.homeTeam)}
                </div>
                
                <div class="flex flex-col items-center gap-2 flex-[3] max-w-[140px] min-w-[110px] shrink-0">
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

                <div class="flex flex-col items-center flex-[2] min-w-[70px] shrink-0">
                    <span class="text-xs font-bold font-sans text-center leading-tight mb-2 max-w-full overflow-hidden text-ellipsis text-slate-200">${match.awayTeam}</span>
                    ${renderFlag(match.awayFlag, match.awayTeam)}
                </div>
            </div>
        </div>
        
        ${finalScoreHtml}
        
        <div class="mt-3 flex flex-col items-center justify-center gap-1">
            <span id="status-${match.id}" class="text-[10px] text-brand-500 font-medium opacity-0 transition-opacity h-4">Guardado ✓</span>
            <span class="text-[9px] text-slate-500 italic text-center leading-tight">Los resultados pueden modificarse hasta una hora antes del partido</span>
            ${pred.result ? `
                <button id="btn-share-match-${match.id}" class="mt-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-brand-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
                    <i class="ph-bold ph-share-network text-sm"></i> Compartir Pronóstico
                </button>
            ` : ''}
        </div>
    `;

    if (!isLocked) {
        const handleBet = async (res) => {
            const currentNow = new Date();
            const currentDiffMs = matchDate - currentNow;
            const currentHoursLeft = currentDiffMs / (1000 * 60 * 60);
            if (match.status === 'finished' || currentHoursLeft <= 1) {
                alert("Este partido ya está cerrado para nuevos pronósticos (cierra 1 hora antes de iniciar). Se recargará la página.");
                location.reload();
                return;
            }

            const hGInput = card.querySelector(`#home-goals-${match.id}`);
            const aGInput = card.querySelector(`#away-goals-${match.id}`);
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
            
            const statusEl = card.querySelector(`#status-${match.id}`);
            ['L','E','V'].forEach(k => {
                const b = card.querySelector(`#btn-${k}-${match.id}`);
                b.className = `prode-btn flex-1 py-1.5 px-1 rounded font-bold text-sm transition-all ${k === 'E' ? 'mx-1' : ''} text-slate-400 hover:bg-slate-700`;
            });
            
            if (res) {
                const activeBtn = card.querySelector(`#btn-${res}-${match.id}`);
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
                setTimeout(() => { if (statusEl) statusEl.classList.add("opacity-0"); }, 2000);
            } catch(error) {
                statusEl.textContent = "Error al guardar";
                statusEl.classList.remove("text-slate-400");
                statusEl.classList.add("text-red-400");
            }
        };
        
        const handleGoalChange = () => {
            const hG = card.querySelector(`#home-goals-${match.id}`).value;
            const aG = card.querySelector(`#away-goals-${match.id}`).value;
            if (hG !== '' && aG !== '') {
                const h = parseInt(hG, 10);
                const a = parseInt(aG, 10);
                let detectedRes = 'E';
                if (h > a) detectedRes = 'L';
                else if (a > h) detectedRes = 'V';
                handleBet(detectedRes);
            } else {
                const isL = card.querySelector(`#btn-L-${match.id}`).classList.contains('bg-brand-500');
                const isV = card.querySelector(`#btn-V-${match.id}`).classList.contains('bg-brand-500');
                const isE = card.querySelector(`#btn-E-${match.id}`).classList.contains('bg-slate-500');
                let currRes = '';
                if (isL) currRes = 'L'; else if (isV) currRes = 'V'; else if (isE) currRes = 'E';
                if (currRes) handleBet(currRes);
            }
        };

        card.querySelector(`#btn-L-${match.id}`).addEventListener("click", () => handleBet('L'));
        card.querySelector(`#btn-E-${match.id}`).addEventListener("click", () => handleBet('E'));
        card.querySelector(`#btn-V-${match.id}`).addEventListener("click", () => handleBet('V'));
        
        const enforceMax = (e) => { if(e.target.value && parseInt(e.target.value, 10) > 25) e.target.value = '25'; };
        const homeInput = card.querySelector(`#home-goals-${match.id}`);
        const awayInput = card.querySelector(`#away-goals-${match.id}`);
        homeInput.addEventListener("input", enforceMax);
        awayInput.addEventListener("input", enforceMax);
        homeInput.addEventListener("input", handleGoalChange);
        awayInput.addEventListener("input", handleGoalChange);
    }

    const shareBtn = card.querySelector(`#btn-share-match-${match.id}`);
    if (shareBtn) {
        shareBtn.addEventListener("click", () => {
            const currentUserObj = getCurrentUser();
            const userAlias = currentUserObj.alias || 'Usuario';
            sharePredictionImage(match, pred, userAlias);
        });
    }

    return card;
}

function renderMatchesGrid(matchesToRender) {
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

        const card = createMatchCardElement(match, false);
        currentDayContainer.appendChild(card);
    });
}

function renderMatchesCarousel(matchesToRender) {
    const wrapper = document.createElement("div");
    wrapper.className = "relative group w-full max-w-md mx-auto py-8";

    const carousel = document.createElement("div");
    carousel.id = "matches-carousel";
    carousel.className = "flex flex-col gap-4 overflow-y-auto snap-y snap-mandatory pb-4 scroll-smooth hide-scrollbar w-full h-[295px]";

    matchesToRender.forEach(match => {
        const card = createMatchCardElement(match, true);
        carousel.appendChild(card);
    });

    // Create Top and Bottom floating overlay buttons
    const btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.id = "btn-prev-match-carousel";
    btnPrev.className = "absolute top-1 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-slate-950/85 hover:bg-brand-500 text-white hover:text-slate-950 flex items-center justify-center transition-all border border-slate-700 shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";
    btnPrev.innerHTML = `<i class="ph-bold ph-caret-up text-base"></i>`;

    const btnNext = document.createElement("button");
    btnNext.type = "button";
    btnNext.id = "btn-next-match-carousel";
    btnNext.className = "absolute bottom-1 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-slate-950/85 hover:bg-brand-500 text-white hover:text-slate-950 flex items-center justify-center transition-all border border-slate-700 shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";
    btnNext.innerHTML = `<i class="ph-bold ph-caret-down text-base"></i>`;

    wrapper.appendChild(btnPrev);
    wrapper.appendChild(carousel);
    wrapper.appendChild(btnNext);
    matchesListEl.appendChild(wrapper);

    const getCardHeight = () => {
        if (carousel.firstElementChild) {
            return carousel.firstElementChild.offsetHeight + 16;
        }
        return 295 + 16;
    };

    const updateNavButtons = () => {
        const scrollTop = carousel.scrollTop;
        const cardHeight = getCardHeight();
        const currentIndex = Math.min(
            Math.max(0, Math.round(scrollTop / cardHeight)),
            matchesToRender.length - 1
        );
        
        btnPrev.disabled = currentIndex === 0;
        btnNext.disabled = currentIndex === matchesToRender.length - 1;
    };

    carousel.addEventListener('scroll', updateNavButtons);

    btnPrev.onclick = () => {
        const cardHeight = getCardHeight();
        carousel.scrollBy({ top: -cardHeight, behavior: 'smooth' });
    };

    btnNext.onclick = () => {
        const cardHeight = getCardHeight();
        carousel.scrollBy({ top: cardHeight, behavior: 'smooth' });
    };

    // Calculate closest match
    let closestIndex = 0;
    let minDiff = Infinity;
    const nowMs = Date.now();
    matchesToRender.forEach((m, idx) => {
        if (m.tbd) return;
        const mTime = new Date(m.matchDate).getTime();
        const diff = mTime - nowMs;
        if (m.status !== 'finished') {
            const absDiff = Math.abs(diff);
            if (absDiff < minDiff) {
                minDiff = absDiff;
                closestIndex = idx;
            }
        }
    });

    setTimeout(() => {
        const closestCard = carousel.children[closestIndex];
        if (closestCard) {
            closestCard.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        }
        updateNavButtons();
    }, 100);
}

function renderMatches() {
    matchesListEl.innerHTML = "";
    
    const filteredMatches = matchesState.filter(m => m.stage === currentStage);
    
    if (filteredMatches.length === 0) {
        matchesListEl.innerHTML = `<div class="text-center text-slate-500 text-sm mt-10">No hay partidos cargados para esta fase.</div>`;
        return;
    }

    let matchesToRender = [...filteredMatches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    if (fixtureViewMode === 'carousel') {
        renderMatchesCarousel(matchesToRender);
    } else {
        renderMatchesGrid(matchesToRender);
    }
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

        let badgesHtml = "";
        if (user.score === 0) {
            badgesHtml += `<span class="text-[12px] ml-1 cursor-help" title="🥶 El Mufa (0 Puntos)">🥶</span>`;
        } else if (index === 0 && user.score > 0) {
            badgesHtml += `<span class="text-[12px] ml-1 cursor-help" title="🔮 El Nostradamus (Líder Absoluto)">🔮</span>`;
        }

        let chicanaBtn = "";
        if (myRankIndex !== -1 && index === myRankIndex - 1 && user.score > 0) {
            const msg = encodeURIComponent(`¡Ojo por el retrovisor ${displayName}! Te estoy pisando los talones en el Ranking General del Prode Mundial 2026 🚗💨😈`);
            chicanaBtn = `<a href="https://api.whatsapp.com/send?text=${msg}" target="_blank" class="ml-2 inline-flex items-center justify-center bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white transition-all px-1.5 py-0.5 rounded text-[9px] uppercase font-bold" title="Chicanear por WhatsApp"><i class="ph-bold ph-whatsapp-logo mr-1 text-sm"></i> Chicana</a>`;
        }

        const tr = document.createElement("tr");
        const isMe = currentUser && currentUser.id === user.id;

        tr.className = `border-slate-700 transition-colors ${isMe ? 'row-me' : (index % 2 === 0 ? '' : 'row-alt')}`;
        tr.innerHTML = `
            <td class="px-4 py-3 text-center ${isMedal ? 'text-lg' : 'text-slate-400 font-medium'}">
                ${rankContent}
            </td>
            <td class="px-4 py-3 font-semibold flex items-center flex-wrap gap-1 ${index === 0 ? 'text-brand-500' : 'text-slate-200'}">
                ${escapeHTML(displayName)}
                ${badgesHtml}
                ${chicanaBtn}
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
const dataURLtoBlob = (dataurl) => {
    try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting dataUrl to Blob", e);
        return null;
    }
};

const handleExportRankingImage = async () => {
    if (!legendaryRankingContainer) return;
    
    // Check if the ranking is hidden, we need to show it temporarily
    const wasHidden = legendaryRankingContainer.classList.contains("hidden");
    
    if (wasHidden) {
        legendaryRankingContainer.classList.remove("hidden");
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

        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(legendaryRankingContainer, {
            backgroundColor: '#0f172a', // brand-dark
            pixelRatio: 2 // High quality
        });
        
        console.error = originalConsoleError;
        
        const aliasText = userAliasDisplay ? userAliasDisplay.textContent.trim().replace(/\s+/g, '_') : 'Prode';
        const fileName = `Ranking_Prode_${aliasText}.png`;
        
        // Convert base64 dataUrl to File using synchronous Blob helper
        const blob = dataURLtoBlob(dataUrl);
        if (!blob) throw new Error("Could not parse image blob");
        const file = new File([blob], fileName, { type: 'image/png' });
        
        let shared = false;
        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Ranking Prode General',
                        text: '¡Mirá cómo viene el ranking general del Prode Mundial 2026: https://sapate.net.ar/!'
                    });
                    shared = true;
                }
            } catch (shareErr) {
                console.log("Compartir cancelado o fallido:", shareErr);
                // If they cancelled, count as shared to avoid forcing a download
                if (shareErr.name === 'AbortError') {
                    shared = true;
                }
            }
        }
        
        if (!shared) {
            // Fallback: download
            const link = document.createElement("a");
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        }
        
        if (btnExportCsv) {
            btnExportCsv.innerHTML = btnOriginalText;
            btnExportCsv.disabled = false;
        }
    } catch (err) {
        console.error("Error al exportar imagen", err);
        alert("Hubo un error al crear la imagen del ranking.");
    } finally {
        if (wasHidden) {
            legendaryRankingContainer.classList.add("hidden");
        }
    }
};

const handleExportLeagueRankingImage = async () => {
    const btnExportLeagueImage = document.getElementById("btn-export-league-image");
    const leagueRankingCard = document.getElementById("league-ranking-card");
    const leagueDetailsName = document.getElementById("league-details-name");
    const paginationControls = document.getElementById("league-pagination-controls");
    const btnOriginalText = btnExportLeagueImage ? btnExportLeagueImage.innerHTML : '';
    
    if (!leagueRankingCard) return;
    
    try {
        if (btnExportLeagueImage) {
            btnExportLeagueImage.innerHTML = '<span class="spin-loader"></span>';
            btnExportLeagueImage.disabled = true;
        }
        
        // Hide pagination and export buttons during image generation
        if (paginationControls) paginationControls.style.setProperty("display", "none", "important");
        if (btnExportLeagueImage) btnExportLeagueImage.style.setProperty("display", "none", "important");

        // Wait for DOM layout
        await new Promise(r => setTimeout(r, 200));
        
        // Mute SecurityError logs
        const originalConsoleError = console.error;
        console.error = (...args) => {
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error inlining remote css file')) return;
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error while reading CSS rules')) return;
            if (args[0] && typeof args[0] === 'string' && args[0].includes('Error loading remote stylesheet')) return;
            originalConsoleError(...args);
        };

        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(leagueRankingCard, {
            backgroundColor: '#0f172a',
            pixelRatio: 2,
            cacheBust: true,
            // Skip cross-origin avatar images to avoid tainted canvas SecurityErrors
            filter: (node) => !(node.tagName === 'IMG' && node.classList && node.classList.contains('avatar-img'))
        });
        
        console.error = originalConsoleError;

        const leagueNameText = leagueDetailsName ? leagueDetailsName.textContent.trim().replace(/\s+/g, '_') : 'Legendaria';
        const fileName = `Ranking_Liga_${leagueNameText}.png`;
        
        // Convert base64 dataUrl to File using synchronous Blob helper
        const blob = dataURLtoBlob(dataUrl);
        if (!blob) throw new Error("Could not parse image blob");
        const file = new File([blob], fileName, { type: 'image/png' });
        
        let shared = false;
        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Ranking Liga Legendaria',
                        text: '¡Mirá cómo va nuestra Liga Legendaria en el Prode Mundial 2026: https://sapate.net.ar/!'
                    });
                    shared = true;
                }
            } catch (shareErr) {
                console.log("Compartir cancelado o fallido:", shareErr);
                if (shareErr.name === 'AbortError') {
                    shared = true;
                }
            }
        }
        
        if (!shared) {
            const link = document.createElement("a");
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        }
    } catch (err) {
        console.error("Error al exportar imagen de la liga", err);
        alert("Hubo un error al crear la imagen del ranking.");
    } finally {
        // Always restore button and pagination visibility
        if (paginationControls) paginationControls.style.removeProperty("display");
        if (btnExportLeagueImage) {
            btnExportLeagueImage.style.removeProperty("display");
            btnExportLeagueImage.innerHTML = btnOriginalText;
            btnExportLeagueImage.disabled = false;
        }
    }
};

if (btnExportCsv) btnExportCsv.addEventListener("click", handleExportRankingImage);
if (btnExportCsvMobile) btnExportCsvMobile.addEventListener("click", handleExportRankingImage);

// Toggle Ranking General inside Legendary View
if (btnToggleRankingGeneral && legendaryRankingContainer) {
    btnToggleRankingGeneral.addEventListener("click", () => {
        const isHidden = legendaryRankingContainer.classList.toggle("hidden");
        if (isHidden) {
            btnToggleRankingGeneral.classList.remove("bg-brand-500/10", "text-brand-500", "border-brand-500/20");
            btnToggleRankingGeneral.classList.add("bg-slate-800", "text-slate-300", "border-slate-700");
        } else {
            btnToggleRankingGeneral.classList.add("bg-brand-500/10", "text-brand-500", "border-brand-500/20");
            btnToggleRankingGeneral.classList.remove("bg-slate-800", "text-slate-300", "border-slate-700");
        }
    });
}

// Premios Card Sharing
const handleShareText = (text) => {
    if (navigator.share) {
        navigator.share({
            title: "Desafío Prode Mundial 2026",
            text: text,
            url: window.location.origin
        }).catch(err => console.log("Error sharing:", err));
    } else {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + window.location.origin)}`;
        window.open(whatsappUrl, "_blank");
    }
};

const handleSharePremioCard = async (imagePath, fileName, text, successAlert = "Se descargó la imagen del premio y se copió la chicana al portapapeles. ¡Ya puedes compartirla!") => {
    try {
        const response = await fetch(imagePath);
        if (!response.ok) throw new Error("Image fetch failed");
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'image/webp' });
        
        let shared = false;
        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: "Desafío Prode Mundial 2026",
                        text: text
                    });
                    shared = true;
                }
            } catch (shareErr) {
                console.log("Compartir imagen falló o fue cancelado:", shareErr);
                if (shareErr.name === 'AbortError') {
                    shared = true;
                }
            }
        }
        
        if (!shared) {
            // Fallback: download the image and copy text
            const link = document.createElement("a");
            link.download = fileName;
            link.href = URL.createObjectURL(blob);
            link.click();
            
            // Wait a bit, then prompt user to copy text
            setTimeout(() => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                    alert(successAlert);
                } else {
                    alert(`Se descargó la imagen. Texto: "${text}"`);
                }
            }, 500);
        }
    } catch (err) {
        console.error("Error al compartir el premio con imagen:", err);
        // Fallback: text only
        handleShareText(text);
    }
};

// Dynamic Premios Cards Definition
const premiosCards = [
  {
    id: "barrilete",
    title: "Barrilete Cósmico",
    description: "\"¿De qué planeta viniste? Vas re arriba en el prode\"",
    badge: "Chicana de Líder",
    icon: "ph-rocket-launch",
    image: "/Premios/Barrilete.webp",
    bgColor: "from-sky-500/10",
    borderColor: "border-sky-500/20",
    hoverBorderColor: "hover:border-sky-500/40",
    btnColor: "bg-sky-500 hover:bg-sky-600 text-slate-950",
    text: "¡Barrilete cósmico! ¿De qué planeta viniste? Vas re arriba en el Prode Mundial 2026: https://sapate.net.ar/! 🚀🏆⚽"
  },
  {
    id: "geminichicana",
    title: "Predicción de IA",
    description: "\"Según Gemini, no tienes chances en el Prode\"",
    badge: "Chicana de IA",
    icon: "ph-cpu",
    image: "/Premios/Gemini.webp",
    bgColor: "from-indigo-500/10",
    borderColor: "border-indigo-500/20",
    hoverBorderColor: "hover:border-indigo-500/40",
    btnColor: "bg-indigo-500 hover:bg-indigo-600 text-white",
    text: "Según la Inteligencia Artificial de Gemini, no tenés chances de ganar el Prode Mundial 2026: https://sapate.net.ar/! 🤖🔮🤣"
  },
  {
    id: "lluvia",
    title: "Lluvia de Goles",
    description: "\"Que lluevan goles, porque tu prode hace agua\"",
    badge: "Chicana del Clima",
    icon: "ph-cloud-rain",
    image: "/Premios/Lluvia.webp",
    bgColor: "from-teal-500/10",
    borderColor: "border-teal-500/20",
    hoverBorderColor: "hover:border-teal-500/40",
    btnColor: "bg-teal-500 hover:bg-teal-600 text-slate-950",
    text: "¡Que lluevan goles! Porque tus predicciones del Prode Mundial 2026 hacen agua por todos lados: https://sapate.net.ar/! 🌧️⚽️🤣"
  },
  {
    id: "birra",
    title: "Te pago una birra",
    description: "\"Te pago una birra porque vas ganando\"",
    badge: "Premio Líder",
    icon: "ph-beer-bottle",
    image: "/Premios/Birra.webp",
    bgColor: "from-amber-500/10",
    borderColor: "border-amber-500/20",
    hoverBorderColor: "hover:border-amber-500/40",
    btnColor: "bg-amber-500 hover:bg-amber-600 text-slate-950",
    text: "¡Te pago una birra si vas ganando en el Prode Mundial 2026! Ojito: https://sapate.net.ar/! 🍺🏆"
  },
  {
    id: "hambre",
    title: "Te veo con hambre",
    description: "\"Te pago un panchito o una hamburguesa porque te veo con hambre\"",
    badge: "Chicana de Tabla",
    icon: "ph-hamburger",
    image: "/Premios/Hambre.webp",
    bgColor: "from-orange-500/10",
    borderColor: "border-orange-500/20",
    hoverBorderColor: "hover:border-orange-500/40",
    btnColor: "bg-orange-500 hover:bg-orange-600 text-slate-950",
    text: "¡Te pago un panchito o una hamburguesa porque te veo con hambre en la tabla del Prode Mundial 2026: https://sapate.net.ar/! 🌭🍔🤣"
  },
  {
    id: "medebes",
    title: "Pagame un asado",
    description: "\"Pagame un asado si yo gano\"",
    badge: "Desafío de Campeón",
    icon: "ph-fire-simple",
    image: "/Premios/MeDebes.webp",
    bgColor: "from-red-500/10",
    borderColor: "border-red-500/20",
    hoverBorderColor: "hover:border-red-500/40",
    btnColor: "bg-red-500 hover:bg-red-600 text-white",
    text: "¡Pagame un asado si gano el Prode Mundial 2026: https://sapate.net.ar/! 🥩🔥🍷"
  },
  {
    id: "tepago",
    title: "Un resultado, un asado",
    description: "\"Te pago un asado si le pegas a un resultado\"",
    badge: "Desafío de Partido",
    icon: "ph-soccer-ball",
    image: "/Premios/TePago.webp",
    bgColor: "from-purple-500/10",
    borderColor: "border-purple-500/20",
    hoverBorderColor: "hover:border-purple-500/40",
    btnColor: "bg-purple-500 hover:bg-purple-600 text-white",
    hasMatchSelect: true
  },
  {
    id: "empate",
    title: "El pacto del empate",
    description: "\"Ofrecé una gaseosa si hay empate\"",
    badge: "Desafío de Tablas",
    icon: "ph-drop",
    image: "/Premios/Empate.webp",
    bgColor: "from-blue-500/10",
    borderColor: "border-blue-500/20",
    hoverBorderColor: "hover:border-blue-500/40",
    btnColor: "bg-blue-500 hover:bg-blue-600 text-white",
    text: "¡Ofrecé una gaseosa si hay empate en el Prode Mundial 2026! 🥤🤝 https://sapate.net.ar/"
  },
  {
    id: "penales",
    title: "Si sobrevivo, papitas",
    description: "\"Si sobrevivo quiero unas papitas\"",
    badge: "¡¡PENALES!!",
    icon: "ph-cookie",
    image: "/Premios/Penales.webp",
    bgColor: "from-rose-500/10",
    borderColor: "border-rose-500/20",
    hoverBorderColor: "hover:border-rose-500/40",
    btnColor: "bg-rose-500 hover:bg-rose-600 text-white",
    text: "¡Si sobrevivo a los penales en el Prode Mundial 2026, quiero unas papitas! 🥔🍟 https://sapate.net.ar/"
  },
  {
    id: "remontada",
    title: "A darlo vuelta!",
    description: "\"Si en 90 o 120 no se puede tal vez penales quieren\"",
    badge: "Remontada",
    icon: "ph-hourglass",
    image: "/Premios/Remontada.webp",
    bgColor: "from-emerald-500/10",
    borderColor: "border-emerald-500/20",
    hoverBorderColor: "hover:border-emerald-500/40",
    btnColor: "bg-emerald-500 hover:bg-emerald-600 text-slate-950",
    text: "¡A darlo vuelta! Si en 90 o 120 no se puede, tal vez penales quieren en el Prode Mundial 2026: https://sapate.net.ar/! ⏳⚽️🔥"
  },
  {
    id: "recordatorio",
    title: "Recordatorio",
    description: "\"hacele acordar que empieza el partido\"",
    badge: "Despertate",
    icon: "ph-alarm",
    image: "/Premios/Despertate.webp",
    bgColor: "from-yellow-500/10",
    borderColor: "border-yellow-500/20",
    hoverBorderColor: "hover:border-yellow-500/40",
    btnColor: "bg-yellow-500 hover:bg-yellow-600 text-slate-950",
    text: "¡Che, despertate que ya empieza el partido del Mundial! ⏰⚽️ https://sapate.net.ar/"
  },
  {
    id: "alfajorcito",
    title: "Alfajorcito",
    description: "\"Un alfajor si hay un gol de Ultimo Minuto\"",
    badge: "Último Minuto",
    icon: "ph-cookie",
    image: "/Premios/GolDeUltimominuto.webp",
    bgColor: "from-pink-500/10",
    borderColor: "border-pink-500/20",
    hoverBorderColor: "hover:border-pink-500/40",
    btnColor: "bg-pink-500 hover:bg-pink-600 text-white",
    text: "¡Apostamos un alfajorcito a que hay un gol de último minuto en el Prode Mundial 2026! 🍫⚽️🔥 https://sapate.net.ar/"
  },
  {
    id: "alentando",
    title: "Alentando",
    description: "\"Alienta a tu equipo favorito\"",
    badge: "Hinchada",
    icon: "ph-megaphone",
    image: "/Premios/HayQueCantar.webp",
    bgColor: "from-cyan-500/10",
    borderColor: "border-cyan-500/20",
    hoverBorderColor: "hover:border-cyan-500/40",
    btnColor: "bg-cyan-500 hover:bg-cyan-600 text-slate-950",
    hasTeamSelect: true
  },
  {
    id: "remanija",
    title: "Re manija",
    description: "\"El que abandona no tiene premio\"",
    badge: "Sin Abandonar",
    icon: "ph-lightning",
    image: "/Premios/HayqueSaltar.webp",
    bgColor: "from-violet-500/10",
    borderColor: "border-violet-500/20",
    hoverBorderColor: "hover:border-violet-500/40",
    btnColor: "bg-violet-500 hover:bg-violet-600 text-white",
    text: "¡Estoy re manija con el Mundial! El que abandona no tiene premio, ¡a saltar! 🤪⚽️ https://sapate.net.ar/"
  },
  {
    id: "sonmalos",
    title: "Son malos!",
    description: "\"Selecciona al peor equipo\"",
    badge: "Chicana de Perros",
    icon: "ph-thumbs-down",
    image: "/Premios/Perros.webp",
    bgColor: "from-stone-500/10",
    borderColor: "border-stone-500/20",
    hoverBorderColor: "hover:border-stone-500/40",
    btnColor: "bg-stone-500 hover:bg-stone-600 text-white",
    hasCountrySelect: true
  },
  {
    id: "acalmarnos",
    title: "A calmarnos",
    description: "\"Mandale esta imagen para calamarlo en el entre tiempo\"",
    badge: "Entretiempo",
    icon: "ph-mask-happy",
    image: "/Premios/MedioTiempo.webp",
    bgColor: "from-teal-500/10",
    borderColor: "border-teal-500/20",
    hoverBorderColor: "hover:border-teal-500/40",
    btnColor: "bg-teal-500 hover:bg-teal-600 text-slate-950",
    text: "¡A calmarnos un poco en este entretiempo! Tomate un respiro: https://sapate.net.ar/ 🧘‍♂️⚽️"
  },
  {
    id: "laprevia",
    title: "La Previa",
    description: "\"Ya arranca pero primero hay morfar\"",
    badge: "Antes del Partido",
    icon: "ph-cooking-pot",
    image: "/Premios/Previa.webp",
    bgColor: "from-amber-600/10",
    borderColor: "border-amber-600/20",
    hoverBorderColor: "hover:border-amber-600/40",
    btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
    text: "¡Se armó la previa del partido! Primero hay que morfar algo rico: https://sapate.net.ar/ 🍔🍕🍻"
  },
  {
    id: "penalazo",
    title: "Penalazo",
    description: "\"Unas empanadas si hay un penal\"",
    badge: "Desafío de VAR",
    icon: "ph-television",
    image: "/Premios/Var.webp",
    bgColor: "from-rose-600/10",
    borderColor: "border-rose-600/20",
    hoverBorderColor: "hover:border-rose-600/40",
    btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
    hasMatchSelect: true
  },
  {
    id: "alargue",
    title: "Alargue",
    description: "\"Un Fernecito si hay alargue\"",
    badge: "Tiempo Extra",
    icon: "ph-timer",
    image: "/Premios/HayAlargue.webp",
    bgColor: "from-indigo-500/10",
    borderColor: "border-indigo-500/20",
    hoverBorderColor: "hover:border-indigo-500/40",
    btnColor: "bg-indigo-500 hover:bg-indigo-600 text-white",
    hasMatchSelect: true
  }
];

let shuffledPremiosCards = [];
let loadedPremiosCount = 0;
const BATCH_SIZE = 3;
let premiosObserverInstance = null;

function getUniqueTeams() {
    const teams = new Set();
    if (Array.isArray(matchesState)) {
        matchesState.forEach(m => {
            if (m.homeTeam) teams.add(m.homeTeam);
            if (m.awayTeam) teams.add(m.awayTeam);
        });
    }
    return Array.from(teams)
        .filter(t => {
            const lower = t.toLowerCase();
            return !lower.includes("grupo") &&
                   !lower.includes("ganador") &&
                   !lower.includes("perdedor") &&
                   !lower.includes("partido") &&
                   !lower.includes("1º") &&
                   !lower.includes("2º") &&
                   !/\d/.test(t);
        })
        .sort((a, b) => a.localeCompare(b));
}

const customChicanaImages = [
    { name: "Barrilete Cósmico 🚀", path: "/Premios/Barrilete.webp" },
    { name: "Sugerencia Gemini 🤖", path: "/Premios/Gemini.webp" },
    { name: "Lluvia de Goles 🌧️", path: "/Premios/Lluvia.webp" },
    { name: "Te Pago una Birra 🍺", path: "/Premios/Birra.webp" },
    { name: "Pagame un Asado 🥩", path: "/Premios/MeDebes.webp" },
    { name: "Un resultado, un asado ⚽", path: "/Premios/TePago.webp" },
    { name: "Pacto del Empate 🥤", path: "/Premios/Empate.webp" },
    { name: "Si sobrevivo, papitas 🍟", path: "/Premios/Penales.webp" },
    { name: "A darlo vuelta! ⏳", path: "/Premios/Remontada.webp" },
    { name: "Despertate ⏰", path: "/Premios/Despertate.webp" },
    { name: "Gol de Último Minuto 🍫", path: "/Premios/GolDeUltimominuto.webp" },
    { name: "Alentando 📣", path: "/Premios/HayQueCantar.webp" },
    { name: "Re manija 🤪", path: "/Premios/HayqueSaltar.webp" },
    { name: "Son Malos! 🐕", path: "/Premios/Perros.webp" },
    { name: "Previa 🍻", path: "/Premios/Previa.webp" },
    { name: "Medio Tiempo 🥪", path: "/Premios/MedioTiempo.webp" },
    { name: "Hay Alargue 🥃", path: "/Premios/HayAlargue.webp" },
    { name: "VAR 🖥️", path: "/Premios/Var.webp" },
    { name: "Elije tu destino 🔮", path: "/Premios/elije.webp" },
    { name: "Alentando Bis 🙌", path: "/Premios/Alentando.webp" },
    { name: "Te veo con hambre 🌭", path: "/Premios/Hambre.webp" },
    { name: "Rifando 🎫", path: "/Premios/Rifando.webp" }
];

let selectedChicanaImagePath = "";
let selectedChicanaFileName = "";
let currentActiveIndex = 0;


function updateActiveChicanaInfo() {
    const img = customChicanaImages[currentActiveIndex];
    if (!img) return;
    selectedChicanaImagePath = img.path;
    selectedChicanaFileName = img.path.split("/").pop();
    
    // Update name display text
    const nameLabel = document.getElementById("chicana-image-name");
    if (nameLabel) {
        nameLabel.textContent = img.name;
    }
}

function resetChicanaCarouselPosition() {
    const carousel = document.getElementById("chicana-carousel");
    if (!carousel) return;
    const slideHeight = carousel.clientHeight;
    if (slideHeight > 0) {
        carousel.style.scrollBehavior = 'auto';
        carousel.scrollTop = (currentActiveIndex + 1) * slideHeight;
        carousel.style.scrollBehavior = 'smooth';
    }
}

function renderChicanaCarousel() {
    const carousel = document.getElementById("chicana-carousel");
    if (!carousel) return;
    
    carousel.innerHTML = "";
    
    // Create the slide list including clones for infinite scrolling:
    // Clone of last, original items, clone of first.
    const lastImg = customChicanaImages[customChicanaImages.length - 1];
    const firstImg = customChicanaImages[0];
    
    const slidesData = [
        { img: lastImg, isClone: true, originalIdx: customChicanaImages.length - 1 },
        ...customChicanaImages.map((img, idx) => ({ img, isClone: false, originalIdx: idx })),
        { img: firstImg, isClone: true, originalIdx: 0 }
    ];
    
    slidesData.forEach((slide) => {
        const slideEl = document.createElement("div");
        slideEl.className = "flex-shrink-0 w-full h-full snap-center relative flex items-center justify-center bg-slate-950/40 select-none";
        slideEl.dataset.originalIndex = slide.originalIdx;
        
        slideEl.innerHTML = `
            <img src="${slide.img.path}" alt="${slide.img.name}" class="w-full h-full object-cover select-none pointer-events-none">
        `;
        
        carousel.appendChild(slideEl);
    });
    
    // Set initial image info
    currentActiveIndex = 0;
    updateActiveChicanaInfo();
    
    // Add Scroll Snap wrapping logic
    let isWrapping = false;
    carousel.addEventListener('scroll', () => {
        const slideHeight = carousel.clientHeight;
        if (slideHeight <= 0 || isWrapping) return;
        
        const scrollTop = carousel.scrollTop;
        
        // Wrap-around at boundaries
        if (scrollTop <= 5) {
            isWrapping = true;
            carousel.style.scrollBehavior = 'auto';
            carousel.scrollTop = customChicanaImages.length * slideHeight;
            requestAnimationFrame(() => {
                carousel.style.scrollBehavior = 'smooth';
                isWrapping = false;
            });
            return;
        }
        
        if (scrollTop >= (customChicanaImages.length + 1) * slideHeight - 5) {
            isWrapping = true;
            carousel.style.scrollBehavior = 'auto';
            carousel.scrollTop = 1 * slideHeight;
            requestAnimationFrame(() => {
                carousel.style.scrollBehavior = 'smooth';
                isWrapping = false;
            });
            return;
        }
        
        // Calculate current slide and active index
        const currentSlide = Math.round(scrollTop / slideHeight);
        let activeImgIndex = currentSlide - 1;
        if (activeImgIndex < 0) activeImgIndex = customChicanaImages.length - 1;
        if (activeImgIndex > customChicanaImages.length - 1) activeImgIndex = 0;
        
        if (currentActiveIndex !== activeImgIndex) {
            currentActiveIndex = activeImgIndex;
            updateActiveChicanaInfo();
        }
    });
    
    // Prev / Next button listeners
    const btnPrev = document.getElementById("btn-prev-chicana");
    const btnNext = document.getElementById("btn-next-chicana");
    
    if (btnPrev) {
        btnPrev.onclick = () => {
            const slideHeight = carousel.clientHeight;
            if (slideHeight <= 0) return;
            const currentSlide = Math.round(carousel.scrollTop / slideHeight);
            carousel.scrollTo({
                top: (currentSlide - 1) * slideHeight,
                behavior: 'smooth'
            });
        };
    }
    
    if (btnNext) {
        btnNext.onclick = () => {
            const slideHeight = carousel.clientHeight;
            if (slideHeight <= 0) return;
            const currentSlide = Math.round(carousel.scrollTop / slideHeight);
            carousel.scrollTo({
                top: (currentSlide + 1) * slideHeight,
                behavior: 'smooth'
            });
        };
    }
    
    // Listen to resize to keep correct scroll alignment
    window.removeEventListener('resize', resetChicanaCarouselPosition);
    window.addEventListener('resize', resetChicanaCarouselPosition);
    
    // Defer initial scroll set to when layout is done (in case it is already visible)
    setTimeout(resetChicanaCarouselPosition, 100);
}

const handleShareCustomChicana = async (imagePath, fileName, text) => {
    try {
        const response = await fetch(imagePath);
        if (!response.ok) throw new Error("Image fetch failed");
        const imgBlob = await response.blob();
        
        const imgType = fileName.endsWith('.png') ? 'image/png' : 'image/webp';
        const imgFile = new File([imgBlob], fileName, { type: imgType });
        
        const filesToShare = [imgFile];
        
        let shared = false;
        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: filesToShare })) {
                    await navigator.share({
                        files: filesToShare,
                        title: "Mi Chicana - Prode Mundial 2026",
                        text: text
                    });
                    shared = true;
                }
            } catch (shareErr) {
                console.log("Compartir custom falló o fue cancelado:", shareErr);
                if (shareErr.name === 'AbortError') {
                    shared = true;
                }
            }
        }
        
        if (!shared) {
            // Fallback: download the image and copy text
            const imgLink = document.createElement("a");
            imgLink.download = fileName;
            imgLink.href = URL.createObjectURL(imgBlob);
            imgLink.click();
            
            setTimeout(() => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                    alert("Se descargó la imagen y se copió el texto al portapapeles. ¡Ya puedes compartirla en WhatsApp o Telegram!");
                } else {
                    alert(`Se descargó la imagen. Texto: "${text}"`);
                }
            }, 500);
        }
    } catch (err) {
        console.error("Error al compartir chicana custom:", err);
        handleShareText(text);
    }
};

function initCustomChicanaSharing() {
    const btnShare = document.getElementById("btn-share-custom-chicana");
    const textarea = document.getElementById("chicana-custom-text");
    if (!btnShare || !textarea) return;
    
    // Reset textarea on load
    textarea.value = "";
    
    btnShare.onclick = async () => {
        const customText = textarea.value.trim();
        if (!customText) {
            alert("Por favor escribe un mensaje para tu chicana.");
            return;
        }
        
        btnShare.disabled = true;
        await handleShareCustomChicana(
            selectedChicanaImagePath, 
            selectedChicanaFileName, 
            customText + "\n\nParticipe del Prode: " + window.location.origin
        );
        btnShare.disabled = false;
    };
}

function setupPredefinedToggler() {
    const btn = document.getElementById("btn-toggle-predefined-chicanas");
    const container = document.getElementById("predefined-chicanas-container");
    const icon = document.getElementById("icon-toggle-predefined-chicanas");
    if (btn && container && icon) {
        btn.onclick = null;
        btn.onclick = () => {
            const isHidden = container.classList.toggle("hidden");
            if (isHidden) {
                icon.classList.remove("rotate-90");
            } else {
                icon.classList.add("rotate-90");
            }
        };
    }
}

function setupCustomChicanaToggler() {
    const btn = document.getElementById("btn-toggle-custom-chicana");
    const container = document.getElementById("custom-chicana-container");
    const icon = document.getElementById("icon-toggle-custom-chicana");
    if (btn && container && icon) {
        btn.onclick = null;
        btn.onclick = () => {
            const isHidden = container.classList.toggle("hidden");
            if (isHidden) {
                icon.classList.remove("rotate-90");
            } else {
                icon.classList.add("rotate-90");
                // Reset carousel position when opening so the heights are computed correctly
                setTimeout(resetChicanaCarouselPosition, 50);
            }
        };
    }
}

async function loadCustomChicanasFromDb() {
    try {
        const { data, error } = await supabase
            .from('custom_chicanas')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) {
            console.warn("Table custom_chicanas might not exist yet:", error.message);
            return;
        }
        
        if (data && data.length > 0) {
            data.forEach(item => {
                const exists = customChicanaImages.some(img => img.path === item.path);
                if (!exists) {
                    customChicanaImages.push({
                        name: item.name,
                        path: item.path,
                        isDbCustom: true,
                        dbId: item.id
                    });
                }
            });
        }
    } catch (err) {
        console.warn("Error loading custom chicanas from DB:", err);
    }
}

async function compressChicanaToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const SIZE = 600;
                const canvas = document.createElement('canvas');
                canvas.width  = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext('2d');

                // Crop centrado (cuadrado)
                const side = Math.min(img.width, img.height);
                const sx = (img.width  - side) / 2;
                const sy = (img.height - side) / 2;
                ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

                // Reducir calidad hasta ≤ 150 KB
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob((b) => {
                        if (!b) { reject(new Error('Canvas toBlob falló')); return; }
                        if (b.size <= 153600 || quality <= 0.3) {
                            resolve(b);
                        } else {
                            quality -= 0.05;
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

function setupAdminChicanaUpload() {
    const triggerBtn = document.getElementById("btn-trigger-chicana-upload");
    const saveBtn = document.getElementById("btn-save-chicana-upload");
    const fileInput = document.getElementById("admin-chicana-file-input");
    const nameInput = document.getElementById("admin-chicana-name");
    const filenameDisplay = document.getElementById("admin-upload-filename");
    const adminPanel = document.getElementById("admin-chicana-upload-panel");
    
    if (!triggerBtn || !saveBtn || !fileInput || !nameInput || !filenameDisplay) return;
    
    // Show/hide panel based on admin status
    if (IS_SUPER_ADMIN) {
        if (adminPanel) adminPanel.classList.remove("hidden");
    } else {
        if (adminPanel) adminPanel.classList.add("hidden");
        return;
    }
    
    let selectedFile = null;
    
    triggerBtn.onclick = () => {
        fileInput.click();
    };
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        selectedFile = file;
        filenameDisplay.textContent = `Archivo: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        filenameDisplay.classList.remove("hidden");
        
        // Auto-fill name if empty
        if (!nameInput.value.trim()) {
            const baseName = file.name.split('.').slice(0, -1).join('.');
            nameInput.value = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        }
        
        saveBtn.disabled = false;
    };
    
    saveBtn.onclick = async () => {
        const nameVal = nameInput.value.trim();
        if (!nameVal) {
            alert("Por favor escribe un nombre para la chicana.");
            return;
        }
        if (!selectedFile) {
            alert("Por favor selecciona una imagen.");
            return;
        }
        
        // Disable form
        nameInput.disabled = true;
        triggerBtn.disabled = true;
        saveBtn.disabled = true;
        saveBtn.textContent = "Subiendo...";
        
        try {
            // 1. Optimize image client-side to WebP (600x600px square, max 150KB)
            const blob = await compressChicanaToWebP(selectedFile);
            
            // 2. Upload to Supabase Storage in 'chicanas' bucket
            const fileExt = 'webp';
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            
            const { error: uploadErr } = await supabase.storage
                .from('chicanas')
                .upload(fileName, blob, {
                    contentType: 'image/webp',
                    upsert: true
                });
                
            if (uploadErr) {
                if (uploadErr.message?.toLowerCase().includes("bucket")) {
                    throw new Error("El bucket 'chicanas' no existe. Asegúrate de ejecutar la migración SQL 'supabase-migration-chicanas.sql' en Supabase.");
                }
                throw uploadErr;
            }
            
            // 3. Get Public URL
            const { data: urlData } = supabase.storage
                .from('chicanas')
                .getPublicUrl(fileName);
                
            const publicUrl = urlData.publicUrl;
            
            // 4. Save metadata to custom_chicanas table
            const { data: insertData, error: insertErr } = await supabase
                .from('custom_chicanas')
                .insert({
                    name: nameVal,
                    path: publicUrl
                })
                .select()
                .single();
                
            if (insertErr) {
                if (insertErr.message?.toLowerCase().includes("relation")) {
                    throw new Error("La tabla 'custom_chicanas' no existe. Asegúrate de ejecutar la migración SQL 'supabase-migration-chicanas.sql' en Supabase.");
                }
                throw insertErr;
            }
            
            // 5. Add to local array and re-render carousel
            customChicanaImages.push({
                name: nameVal,
                path: publicUrl,
                isDbCustom: true,
                dbId: insertData.id
            });
            
            // Set as active
            currentActiveIndex = customChicanaImages.length - 1;
            
            // Re-render carousel
            renderChicanaCarousel();
            
            // Clear inputs
            nameInput.value = "";
            fileInput.value = "";
            selectedFile = null;
            filenameDisplay.classList.add("hidden");
            
            alert("¡Chicanita subida y optimizada con éxito! Ya aparece en tu carrusel.");
            
        } catch (err) {
            console.error("Error al subir chicana custom:", err);
            alert("Error al guardar: " + err.message);
        } finally {
            // Re-enable form
            nameInput.disabled = false;
            triggerBtn.disabled = false;
            saveBtn.disabled = false;
            saveBtn.textContent = "Guardar";
            if (!selectedFile) {
                saveBtn.disabled = true;
            }
        }
    };
}

function initPremios() {
    if (shuffledPremiosCards.length === 0) {
        // Shuffle Fisher-Yates
        shuffledPremiosCards = [...premiosCards];
        for (let i = shuffledPremiosCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPremiosCards[i], shuffledPremiosCards[j]] = [shuffledPremiosCards[j], shuffledPremiosCards[i]];
        }
    }
    
    // Reset state
    const premiosGrid = document.getElementById("premios-grid");
    if (premiosGrid) premiosGrid.innerHTML = "";
    loadedPremiosCount = 0;
    
    // Load first batch
    renderMorePremios();
    
    // Setup scroll observer
    setupPremiosObserver();

    // Setup custom chicana carousel, sharing, and predefined toggler (only once)
    if (!selectedChicanaImagePath) {
        loadCustomChicanasFromDb().then(() => {
            renderChicanaCarousel();
            initCustomChicanaSharing();
            setupPredefinedToggler();
            setupCustomChicanaToggler();
            setupAdminChicanaUpload();
        });
    }
}

function setupPremiosObserver() {
    const observerEl = document.getElementById("premios-observer");
    if (!observerEl) return;

    if (premiosObserverInstance) {
        premiosObserverInstance.disconnect();
    }

    const loaderEl = observerEl.querySelector(".spin-loader");

    premiosObserverInstance = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && loadedPremiosCount < shuffledPremiosCards.length) {
            if (loaderEl) loaderEl.classList.remove("hidden");
            
            setTimeout(() => {
                renderMorePremios();
                if (loaderEl) loaderEl.classList.add("hidden");
                checkAndLoadMore(); // Re-check after rendering next batch
            }, 100);
        }
    }, {
        rootMargin: "150px", // Trigger slightly before it comes into view
        threshold: 0.01
    });

    premiosObserverInstance.observe(observerEl);
    
    // Check initially in case screen is large enough that the observer is already visible
    checkAndLoadMore();
}

function checkAndLoadMore() {
    const observerEl = document.getElementById("premios-observer");
    if (!observerEl) return;
    
    const rect = observerEl.getBoundingClientRect();
    const inView = rect.top < window.innerHeight; // Observer is visible in viewport
    
    if (inView && loadedPremiosCount < shuffledPremiosCards.length) {
        renderMorePremios();
        // Check again after a tiny delay to allow DOM render
        setTimeout(checkAndLoadMore, 50);
    }
}

function renderMorePremios() {
    const premiosGrid = document.getElementById("premios-grid");
    if (!premiosGrid) return;
    
    const nextBatch = shuffledPremiosCards.slice(loadedPremiosCount, loadedPremiosCount + BATCH_SIZE);
    loadedPremiosCount += nextBatch.length;
    
    nextBatch.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = `bg-gradient-to-br ${card.bgColor} via-brand-dark to-slate-950 p-6 rounded-2xl border ${card.borderColor} flex flex-col justify-between space-y-4 ${card.hoverBorderColor} transition-all group duration-300 glitch-hover fade-in`;
        
        let selectHtml = "";
        if (card.hasMatchSelect) {
            selectHtml = `
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elegir Partido</label>
                    <select class="premios-match-select w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                        <option value="">Cargando partidos...</option>
                    </select>
                </div>
            `;
        } else if (card.hasTeamSelect) {
            selectHtml = `
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elegir Equipo</label>
                    <select class="premios-team-select w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                        <option value="">Cargando equipos...</option>
                    </select>
                </div>
            `;
        } else if (card.hasCountrySelect) {
            selectHtml = `
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elegir País</label>
                    <select class="premios-country-select w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                        <option value="">Cargando países...</option>
                    </select>
                </div>
            `;
        }
        
        cardEl.innerHTML = `
            <div class="flex flex-col space-y-3">
                <div class="flex items-start justify-between">
                    <div class="space-y-1 flex-1 pr-2">
                        <span class="text-[10px] bg-brand-500/20 text-brand-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">${card.badge}</span>
                        <h3 class="text-lg font-bold text-white mt-1 group-hover:text-brand-500 transition-colors glitch-card-title">${card.title}</h3>
                        <p class="text-xs text-slate-400 leading-relaxed">${card.description}</p>
                    </div>
                    <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-500 group-hover:scale-110 transition-transform duration-300 glitch-card-icon">
                        <i class="ph-bold ${card.icon} text-2xl"></i>
                    </div>
                </div>
                ${selectHtml}
            </div>
            <button class="btn-share-card w-full py-2.5 ${card.btnColor} font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                <i class="ph-bold ph-share-network text-sm"></i> Compartir Tarjeta
            </button>
        `;
        
        premiosGrid.appendChild(cardEl);
        
        // Populate selects
        if (card.hasMatchSelect) {
            const select = cardEl.querySelector(".premios-match-select");
            if (select && Array.isArray(matchesState)) {
                let validMatches = matchesState.filter(m => m.homeTeam && m.awayTeam && !m.tbd);
                if (card.id === "alargue") {
                    validMatches = validMatches.filter(m => m.stage !== "groups");
                }
                validMatches.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
                select.innerHTML = '<option value="">Seleccionar partido...</option>';
                validMatches.forEach(m => {
                    const opt = document.createElement("option");
                    const name = `${m.homeTeam} vs ${m.awayTeam}`;
                    opt.value = name;
                    opt.textContent = name;
                    select.appendChild(opt);
                });
            }
        } else if (card.hasTeamSelect || card.hasCountrySelect) {
            const select = cardEl.querySelector(card.hasTeamSelect ? ".premios-team-select" : ".premios-country-select");
            if (select) {
                const teams = getUniqueTeams();
                select.innerHTML = `<option value="">Seleccionar ${card.hasTeamSelect ? 'equipo' : 'país'}...</option>`;
                teams.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.textContent = t;
                    select.appendChild(opt);
                });
            }
        }
        
        // Add sharing click handler
        const shareBtn = cardEl.querySelector(".btn-share-card");
        if (shareBtn) {
            shareBtn.addEventListener("click", () => {
                let shareText = card.text || "";
                if (card.hasMatchSelect) {
                    const select = cardEl.querySelector(".premios-match-select");
                    const matchVal = select ? select.value : "";
                    if (!matchVal) {
                        alert("Para compartir esta tarjeta, debes seleccionar un partido de la lista obligatoriamente.");
                        return;
                    }
                    if (card.id === "penalazo") {
                        shareText = `¡Penalazo! Si cobran penal en ${matchVal}, me debés unas empanadas: https://sapate.net.ar/! 🥟⚽️🤞`;
                    } else if (card.id === "alargue") {
                        shareText = `¡Hay alargue! Si el partido de ${matchVal} va a tiempo extra, te pago un fernecito: https://sapate.net.ar/! 🥃⚽️🔥`;
                    } else {
                        shareText = `¡Te pago un asado si le pegas al resultado de ${matchVal} en el Prode Mundial 2026: https://sapate.net.ar/! 🥩⚽️🤞`;
                    }
                } else if (card.hasTeamSelect) {
                    const select = cardEl.querySelector(".premios-team-select");
                    const teamVal = select ? select.value : "";
                    if (!teamVal) {
                        alert("Para compartir esta tarjeta, debes seleccionar un equipo de la lista obligatoriamente.");
                        return;
                    }
                    shareText = `¡Alentando con el alma! ¡Vamos ${teamVal} carajo! 📣🇦🇷⚽️ https://sapate.net.ar/`;
                } else if (card.hasCountrySelect) {
                    const select = cardEl.querySelector(".premios-country-select");
                    const countryVal = select ? select.value : "";
                    if (!countryVal) {
                        alert("Para compartir esta tarjeta, debes seleccionar un país de la lista obligatoriamente.");
                        return;
                    }
                    shareText = `¡Qué perros que son! El peor equipo del Mundial sin dudas es ${countryVal}... 🐕⚽️🤦‍♂️ https://sapate.net.ar/`;
                }
                
                const fileName = `${card.id}.webp`;
                handleSharePremioCard(card.image, fileName, shareText);
            });
        }
    });
    
    // Hide/show observer
    const observerEl = document.getElementById("premios-observer");
    if (observerEl) {
        if (loadedPremiosCount >= shuffledPremiosCards.length) {
            observerEl.style.display = "none";
        } else {
            observerEl.style.display = "flex";
        }
    }
}

const btnInviteFriends = document.getElementById("btn-invite-friends");
if (btnInviteFriends) {
    btnInviteFriends.addEventListener("click", () => {
        handleSharePremioCard("/Premios/Alentando.webp", "Alentando.webp", "¡Sumate al prode Mundial 2026! 🏆⚽️ https://sapate.net.ar/");
    });
}

const btnExportLeagueImage = document.getElementById("btn-export-league-image");
if (btnExportLeagueImage) btnExportLeagueImage.addEventListener("click", handleExportLeagueRankingImage);

const btnLeaguePrev = document.getElementById("btn-league-prev");
const btnLeagueNext = document.getElementById("btn-league-next");

if (btnLeaguePrev) {
    btnLeaguePrev.addEventListener("click", () => {
        if (currentLeaguePage > 0) {
            currentLeaguePage--;
            displayLeagueRankingPage();
        }
    });
}

if (btnLeagueNext) {
    btnLeagueNext.addEventListener("click", () => {
        const itemsPerPage = 5;
        const totalPages = Math.ceil(currentLeagueMembers.length / itemsPerPage) || 1;
        if (currentLeaguePage < totalPages - 1) {
            currentLeaguePage++;
            displayLeagueRankingPage();
        }
    });
}

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
                <div class="flex gap-2 items-center justify-end pt-2 border-t border-slate-700/40">
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

    const leagueRankingTitle = document.getElementById("league-ranking-title");
    if (leagueRankingTitle) {
        leagueRankingTitle.textContent = league.name;
    }

    const btnShareLeague = document.getElementById("btn-share-league");
    if (btnShareLeague) {
        btnShareLeague.classList.remove("hidden");
        btnShareLeague.onclick = async () => {
            const shareText = `¡Únete a mi Liga Legendaria "${league.name}" en Prode Mundial 2026!\n\nIngresa a este enlace para aceptar el desafío:\n${window.location.origin}/?invite=${league.invite_code}`;
            handleSharePremioCard(
                "/Premios/Liga.webp", 
                "Liga.webp", 
                shareText, 
                "Se descargó la imagen de la liga y se copió el link de invitación al portapapeles. ¡Ya puedes compartirla!"
            );
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
        
        currentLeagueMembers = members;
        currentLeaguePage = 0;
        currentLeagueOwnerId = league.owner_id;
        currentLeagueId = league.id;
        
        displayLeagueRankingPage();
    } catch (err) {
        alert("Error al cargar los miembros: " + err.message);
    } finally {
        hideLoader();
    }
}

function displayLeagueRankingPage() {
    const { user } = getCurrentUser();
    if (!user) return;

    const rankingBody = document.getElementById("league-ranking-body");
    const paginationControls = document.getElementById("league-pagination-controls");
    const pageInfo = document.getElementById("league-page-info");
    const btnLeaguePrev = document.getElementById("btn-league-prev");
    const btnLeagueNext = document.getElementById("btn-league-next");

    if (!rankingBody) return;
    rankingBody.innerHTML = "";

    const itemsPerPage = 5;
    const totalPages = Math.ceil(currentLeagueMembers.length / itemsPerPage) || 1;

    if (currentLeaguePage >= totalPages) currentLeaguePage = totalPages - 1;
    if (currentLeaguePage < 0) currentLeaguePage = 0;

    const startIndex = currentLeaguePage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageMembers = currentLeagueMembers.slice(startIndex, endIndex);

    const isOwner = currentLeagueOwnerId === user.id;

    pageMembers.forEach((member, i) => {
        const index = startIndex + i;
        const isMedal = index < 3;
        let rankContent = `${index + 1}`;
        if (index === 0) rankContent = "🥇";
        else if (index === 1) rankContent = "🥈";
        else if (index === 2) rankContent = "🥉";

        const displayName = member.alias || (member.nombre + ' ' + member.apellido).trim() || "Usuario";
        const isMe = member.id === user.id;

        let badgesHtml = "";
        if (member.score === 0) {
            badgesHtml += `<span class="text-[12px] ml-1 cursor-help" title="🥶 El Mufa (0 Puntos)">🥶</span>`;
        } else if (index === 0 && member.score > 0) {
            badgesHtml += `<span class="text-[12px] ml-1 cursor-help" title="🔮 El Nostradamus (Líder Absoluto)">🔮</span>`;
        }

        let chicanaBtn = "";
        const myIndexInAll = currentLeagueMembers.findIndex(m => m.id === user.id);
        if (myIndexInAll !== -1 && index === myIndexInAll - 1 && member.score > 0) {
            const msg = encodeURIComponent(`¡Ojo por el retrovisor ${displayName}! Te estoy pisando los talones en el Prode Mundial 2026 🚗💨😈`);
            chicanaBtn = `<a href="https://api.whatsapp.com/send?text=${msg}" target="_blank" class="ml-2 inline-flex items-center justify-center bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white transition-all px-1.5 py-0.5 rounded text-[9px] uppercase font-bold" title="Chicanear por WhatsApp"><i class="ph-bold ph-whatsapp-logo mr-1 text-sm"></i> Chicana</a>`;
        }

        const tr = document.createElement("tr");
        tr.className = `border-slate-800 transition-colors ${isMe ? 'bg-brand-500/10 text-white font-bold' : (index % 2 === 0 ? '' : 'bg-slate-800/20')}`;

        let actionHtml = "";
        if (isOwner) {
            if (member.id === currentLeagueOwnerId) {
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

        const avatarVal = member.avatar_url ? member.avatar_url.trim() : null;
        const hasValidAvatar = avatarVal && avatarVal !== "" && avatarVal !== "null" && avatarVal !== "undefined";
        
        // CSS-overlay container avatar system to prevent broken image placeholders in Safari/Android
        const flagHtml = `
            <div class="relative w-6 h-6 flex-shrink-0">
                <div class="absolute inset-0 bg-slate-700 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    ${escapeHTML(displayName.substring(0,2).toUpperCase())}
                </div>
                ${hasValidAvatar ? `<img src="${escapeHTML(avatarVal)}" alt="" class="avatar-img absolute inset-0 w-full h-full rounded-full object-cover border border-slate-700 z-10">` : ''}
            </div>
        `;

        tr.innerHTML = `
            <td class="px-4 py-3 text-center font-bold ${isMedal ? 'text-lg' : 'text-slate-400'}">${rankContent}</td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2 flex-wrap">
                    ${flagHtml}
                    <div class="flex items-center">
                        <span class="text-xs sm:text-sm line-clamp-1">${escapeHTML(displayName)} ${isMe ? ' (Vos)' : ''}</span>
                        ${badgesHtml}
                        ${chicanaBtn}
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-right font-black text-slate-200">${member.score || 0} pts</td>
            ${isOwner ? actionHtml : ''}
        `;

        if (hasValidAvatar) {
            const imgEl = tr.querySelector(".avatar-img");
            if (imgEl) {
                imgEl.addEventListener("error", () => {
                    imgEl.style.display = "none";
                });
            }
        }

        if (isOwner && member.id !== currentLeagueOwnerId) {
            const btnExpel = tr.querySelector(".btn-expel-member");
            if (btnExpel) {
                btnExpel.onclick = async () => {
                    const confirmText = `¿Estás seguro de que querés expulsar a ${displayName} de esta liga?`;
                    if (confirm(confirmText)) {
                        showLoader();
                        try {
                            await removeLeagueMember(currentLeagueId, member.id);
                            const members = await fetchLeagueDetails(currentLeagueId);
                            currentLeagueMembers = members;
                            displayLeagueRankingPage();
                        } catch (err) {
                            alert("Error al expulsar al miembro: " + err.message);
                        } finally {
                            hideLoader();
                        }
                    }
                };
            }
        }

        rankingBody.appendChild(tr);
    });

    if (paginationControls && pageInfo && btnLeaguePrev && btnLeagueNext) {
        if (totalPages <= 1) {
            paginationControls.classList.add("hidden");
        } else {
            paginationControls.classList.remove("hidden");
            pageInfo.textContent = `Página ${currentLeaguePage + 1} de ${totalPages}`;
            btnLeaguePrev.disabled = currentLeaguePage === 0;
            btnLeagueNext.disabled = currentLeaguePage === totalPages - 1;
        }
    }
}

// =============================================
// PWA Service Worker & Custom Install Logic (Non-inline for CSP compliance)
// =============================================
let deferredPrompt;
const installBtn = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('App instalada por el usuario');
                installBtn.classList.add('hidden');
                installBtn.classList.remove('flex');
            }
            deferredPrompt = null;
        } else {
            alert("Para instalar la aplicación:\n\n📱 En iPhone/iPad: Toca el botón 'Compartir' (cuadrado con flecha) y selecciona 'Agregar a Inicio'.\n\n🤖 En Android: Toca los 3 puntos del navegador y selecciona 'Instalar aplicación' o 'Añadir a pantalla de inicio'.");
        }
    });
}

window.addEventListener('appinstalled', () => {
    if (installBtn) {
        installBtn.classList.add('hidden');
        installBtn.classList.remove('flex');
    }
    console.log('PWA ha sido instalada en el sistema.');
});

async function handlePendingInvite(userId) {
    const pendingCode = localStorage.getItem('pending_invite_code');
    if (!pendingCode) return;
    
    localStorage.removeItem('pending_invite_code');
    
    try {
        showLoader();
        // 1. Fetch group details using invite code
        const { data: league, error: searchError } = await supabase
            .from('user_groups')
            .select('id, name, description, prizes, invite_code, owner_id')
            .ilike('invite_code', pendingCode)
            .single();
            
        if (searchError || !league) {
            console.error("No se encontró la liga para el código de invitación pendiente.");
            return;
        }
        
        // 2. Check if user is already a member
        const { data: memberRecord, error: memberError } = await supabase
            .from('group_members')
            .select('status')
            .eq('group_id', league.id)
            .eq('user_id', userId)
            .maybeSingle();
            
        if (memberError) {
            console.error("Error al consultar pertenencia al grupo:", memberError);
            return;
        }
        
        hideLoader();
        
        if (memberRecord) {
            // Already a member, directly open it
            setActiveNav(btnNavLegendary, leagueDetailsView);
            renderLeagueDetailsView(league);
            return;
        }
        
        // 3. Automatically join user to the group (bypass confirm prompt)
        showLoader();
        await supabase.from('group_members').insert({
            group_id: league.id,
            user_id: userId,
            status: 'active'
        });
        hideLoader();
        alert(`¡Te has unido a la liga "${league.name}" con éxito!`);
        
        // Navigate to details view
        setActiveNav(btnNavLegendary, leagueDetailsView);
        renderLeagueDetailsView(league);
    } catch (err) {
        console.error("Error al procesar la invitación pendiente:", err);
        alert("Hubo un error al intentar unirse a la liga: " + (err.message || err));
    } finally {
        hideLoader();
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('PWA Service Worker registrado con éxito', reg.scope);
        }).catch(err => {
            console.error('Error al registrar el Service Worker', err);
        });
    });
}

// =============================================
// PRONÓSTICOS ESPECIALES LOGIC (Production Mode)
// =============================================
async function initEspecialesView() {
    const selectFavorito = document.getElementById("select-favorito");
    const selectSorpresa = document.getElementById("select-sorpresa");
    const selectDecepcion = document.getElementById("select-decepcion");
    const btnSaveEspeciales = document.getElementById("btn-save-especiales");

    if (!selectFavorito || !selectSorpresa || !selectDecepcion) return;

    const { user: currentUser } = getCurrentUser();

    // Obtener todos los equipos únicos ordenados de standings.js
    const teams = Object.values(GROUP_MAP)
        .flat()
        .map(t => ({ name: t.team, flag: t.flag }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Llenar los selects
    const populateSelect = (selectEl) => {
        selectEl.innerHTML = '<option value="">Seleccionar país...</option>';
        teams.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.name;
            opt.textContent = t.name;
            selectEl.appendChild(opt);
        });
    };

    populateSelect(selectFavorito);
    populateSelect(selectSorpresa);
    populateSelect(selectDecepcion);

    const isUserMock = isMock || (currentUser && String(currentUser.id).startsWith("mock_"));

    if (currentUser) {
        if (isUserMock) {
            const storedEsp = localStorage.getItem(`prode_mock_especiales_${currentUser.id}`);
            if (storedEsp) {
                const userData = JSON.parse(storedEsp);
                selectFavorito.value = userData.favorito || "";
                selectSorpresa.value = userData.sorpresa || "";
                selectDecepcion.value = userData.decepcion || "";
            }
        } else {
            // Cargar selección de Supabase
            const { data: userData } = await supabase
                .from('especiales')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();

            if (userData) {
                selectFavorito.value = userData.favorito || "";
                selectSorpresa.value = userData.sorpresa || "";
                selectDecepcion.value = userData.decepcion || "";
            }
        }
    }

    // Renderizar rankings
    updateEspecialesRanking();

    // Guardar al hacer click
    if (btnSaveEspeciales) {
        btnSaveEspeciales.onclick = async () => {
            if (!currentUser) {
                alert("Debes iniciar sesión para guardar.");
                return;
            }
            
            btnSaveEspeciales.disabled = true;
            btnSaveEspeciales.textContent = "Guardando...";

            const fav = selectFavorito.value;
            const sor = selectSorpresa.value;
            const dec = selectDecepcion.value;

            if (isUserMock) {
                localStorage.setItem(`prode_mock_especiales_${currentUser.id}`, JSON.stringify({
                    favorito: fav,
                    sorpresa: sor,
                    decepcion: dec
                }));
                updateEspecialesRanking();
                alert("¡Tus elecciones especiales se guardaron correctamente!");
            } else {
                const { error } = await supabase
                    .from('especiales')
                    .upsert({ 
                        user_id: currentUser.id, 
                        favorito: fav, 
                        sorpresa: sor, 
                        decepcion: dec,
                        updated_at: new Date().toISOString()
                    });

                if (error) {
                    console.error("Error al guardar especiales:", error);
                    alert("Hubo un error al guardar tus elecciones.");
                } else {
                    updateEspecialesRanking();
                    alert("¡Tus elecciones especiales se guardaron correctamente!");
                }
            }
            
            btnSaveEspeciales.disabled = false;
            btnSaveEspeciales.textContent = "Guardar Elecciones";
        };
    }

    // Configurar colapsables de la vista de especiales
    const setupCollapsible = (btnId, containerId, iconId) => {
        const btn = document.getElementById(btnId);
        const container = document.getElementById(containerId);
        const icon = document.getElementById(iconId);
        if (btn && container && icon) {
            // Unbind previous clicks
            btn.onclick = null;
            btn.onclick = () => {
                const isHidden = container.classList.toggle("hidden");
                if (isHidden) {
                    icon.classList.remove("rotate-90");
                } else {
                    icon.classList.add("rotate-90");
                }
            };
        }
    };
    setupCollapsible("btn-toggle-especiales-selection", "especiales-selection-container", "icon-toggle-especiales-selection");
    setupCollapsible("btn-toggle-jackpot", "jackpot-container", "icon-toggle-jackpot");
    setupCollapsible("btn-toggle-especiales-trends", "especiales-trends-container", "icon-toggle-especiales-trends");

    // Inicializar lógica de Jackpot
    if (typeof initJackpotGame === 'function') {
        initJackpotGame();
    }
}

async function updateEspecialesRanking() {
    const listFav = document.getElementById("ranking-mock-favoritos");
    const listSor = document.getElementById("ranking-mock-sorpresas");
    const listDec = document.getElementById("ranking-mock-decepciones");

    if (!listFav || !listSor || !listDec) return;

    // Obtener banderas
    const teamFlags = {};
    Object.values(GROUP_MAP).flat().forEach(t => {
        teamFlags[t.team] = t.flag;
    });

    // Votos base para semilla (seed) con 0 votos iniciales
    const baseFav = { "Argentina": 0, "Brasil": 0, "Francia": 0 };
    const baseSor = { "Ecuador": 0, "Marruecos": 0, "Japón": 0 };
    const baseDec = { "Alemania": 0, "España": 0, "Inglaterra": 0 };

    // Obtener votos reales de Supabase
    let allVotes = [];
    if (!isMock) {
        try {
            const { data, error } = await supabase
                .from('especiales')
                .select('favorito, sorpresa, decepcion');
            if (!error && data) {
                allVotes = data;
            }
        } catch (e) {
            console.warn("Bypassed Supabase ranking fetch:", e);
        }
    }

    // Merge with any local mock votes to show dynamic rankings
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("prode_mock_especiales_")) {
            try {
                const stored = JSON.parse(localStorage.getItem(key));
                if (stored) {
                    allVotes.push(stored);
                }
            } catch(e) {}
        }
    }

    allVotes.forEach(v => {
        if (v.favorito) baseFav[v.favorito] = (baseFav[v.favorito] || 0) + 1;
        if (v.sorpresa) baseSor[v.sorpresa] = (baseSor[v.sorpresa] || 0) + 1;
        if (v.decepcion) baseDec[v.decepcion] = (baseDec[v.decepcion] || 0) + 1;
    });

    // Ordenar y renderizar cada sección
    const renderSection = (container, votes, barColorClass) => {
        container.innerHTML = "";
        
        // Convertir a array, ordenar desc y mantener solo los primeros 3 (Top 3)
        const sorted = Object.entries(votes)
            .map(([teamName, count]) => ({ teamName, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        const maxVotes = Math.max(...sorted.map(s => s.count)) || 1;

        sorted.forEach(item => {
            const flagName = teamFlags[item.teamName] || "un";
            const flagUrl = flagName !== "un" ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${flagName}.svg` : null;
            const flagHtml = flagUrl 
                ? `<img src="${flagUrl}" class="w-4 h-auto rounded-[1px] border border-slate-700 object-cover">`
                : `<div class="w-4 h-3 bg-slate-700 rounded-[1px]"></div>`;

            const percentage = (item.count / maxVotes) * 100;

            const div = document.createElement("div");
            div.className = "space-y-1";
            div.innerHTML = `
                <div class="flex items-center justify-between text-xs text-slate-300">
                    <div class="flex items-center gap-1.5 font-semibold">
                        ${flagHtml}
                        <span class="font-medium">${escapeHTML(item.teamName)}</span>
                    </div>
                    <span class="font-bold text-slate-400">${item.count} ${item.count === 1 ? 'voto' : 'votos'}</span>
                </div>
                <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-850">
                    <div class="progress-bar h-full rounded-full ${barColorClass}"></div>
                </div>
            `;
            
            // Programmatically set style width to avoid CSP style-src-attr policy block
            const progressBar = div.querySelector(".progress-bar");
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            
            // Programmatic error listener to prevent broken image warnings under strict CSP
            const imgEl = div.querySelector("img");
            if (imgEl) {
                imgEl.addEventListener("error", () => {
                    imgEl.style.display = "none";
                });
            }

            container.appendChild(div);
        });
    };

    renderSection(listFav, baseFav, "bg-amber-500");
    renderSection(listSor, baseSor, "bg-purple-500");
    renderSection(listDec, baseDec, "bg-red-500");
}


async function sharePredictionImage(match, pred, userAlias) {
    // Helper: load an image URL into an HTMLImageElement via Blob to avoid CORS taint
    const loadImage = (url) => new Promise((resolve) => {
        if (!url) { resolve(null); return; }
        fetch(url, { mode: 'cors' })
            .then(r => r.blob())
            .then(blob => {
                const objUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(objUrl); resolve(img); };
                img.onerror = () => resolve(null);
                img.src = objUrl;
            })
            .catch(() => resolve(null));
    });

    // Helper: round-rect path
    const roundRect = (ctx, x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background gradient ──
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Border ──
    roundRect(ctx, 10, 10, W - 20, H - 20, 24);
    ctx.strokeStyle = 'rgba(34,197,94,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // ── Header strip ──
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillRect(0, 0, W, 72);
    ctx.strokeStyle = 'rgba(34,197,94,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 72); ctx.lineTo(W, 72); ctx.stroke();

    // Load logo
    const logoImg = await loadImage('/assets/cup.webp');
    if (logoImg) ctx.drawImage(logoImg, 32, 16, 40, 40);

    // Header text
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('PRODE MUNDIAL 2026', 84, 46);

    // Badge right
    roundRect(ctx, W - 260, 20, 228, 36, 18);
    ctx.fillStyle = 'rgba(34,197,94,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,197,94,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRONÓSTICO OFICIAL', W - 146, 43);

    // ── Subtitle: user alias ──
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Predicción de ${userAlias}`, W / 2, 126);

    // Load flag images in parallel
    const homeFlagUrl = match.homeFlag && match.homeFlag !== 'un'
        ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${match.homeFlag}.svg`
        : null;
    const awayFlagUrl = match.awayFlag && match.awayFlag !== 'un'
        ? `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${match.awayFlag}.svg`
        : null;

    const [homeFlag, awayFlag] = await Promise.all([loadImage(homeFlagUrl), loadImage(awayFlagUrl)]);

    const flagW = 160, flagH = 110;
    const flagY = 190;
    const centerX = W / 2;

    // ── Home team ──
    const homeX = centerX - 340;
    if (homeFlag) {
        roundRect(ctx, homeX, flagY, flagW, flagH, 10);
        ctx.save(); ctx.clip();
        ctx.drawImage(homeFlag, homeX, flagY, flagW, flagH);
        ctx.restore();
        ctx.strokeStyle = 'rgba(100,116,139,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    } else {
        roundRect(ctx, homeX, flagY, flagW, flagH, 10);
        ctx.fillStyle = '#1e293b'; ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 36px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('?', homeX + flagW / 2, flagY + flagH / 2 + 12);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(match.homeTeam, homeX + flagW / 2, flagY + flagH + 38);

    // ── Away team ──
    const awayX = centerX + 180;
    if (awayFlag) {
        roundRect(ctx, awayX, flagY, flagW, flagH, 10);
        ctx.save(); ctx.clip();
        ctx.drawImage(awayFlag, awayX, flagY, flagW, flagH);
        ctx.restore();
        ctx.strokeStyle = 'rgba(100,116,139,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    } else {
        roundRect(ctx, awayX, flagY, flagW, flagH, 10);
        ctx.fillStyle = '#1e293b'; ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 36px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('?', awayX + flagW / 2, flagY + flagH / 2 + 12);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(match.awayTeam, awayX + flagW / 2, flagY + flagH + 38);

    // ── Center prediction box ──
    const boxW = 200, boxH = 110;
    const boxX = centerX - boxW / 2;
    const boxY = flagY;

    roundRect(ctx, boxX, boxY, boxW, boxH, 16);
    ctx.fillStyle = 'rgba(15,23,42,0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(51,65,85,0.8)'; ctx.lineWidth = 2; ctx.stroke();

    let predDetails = pred.result || 'E';
    if (pred.homeGoals !== undefined && pred.awayGoals !== undefined && pred.homeGoals !== '' && pred.awayGoals !== '') {
        predDetails = `${pred.homeGoals} - ${pred.awayGoals}`;
    }

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(predDetails, centerX, boxY + 70);

    // ── Footer ──
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillRect(0, H - 56, W, 56);
    ctx.strokeStyle = 'rgba(34,197,94,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 56); ctx.lineTo(W, H - 56); ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Únete a jugar en:', 32, H - 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('sapate.net.ar', 200, H - 22);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('¡Pronostica y gana! 🏆', W - 32, H - 22);

    // ── Export ──
    const dataUrl = canvas.toDataURL('image/png');
    const dataURLtoBlob = (du) => {
        const arr = du.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
    };

    const fileName = `Pronostico_${match.homeTeam.replace(/\s+/g, '_')}_vs_${match.awayTeam.replace(/\s+/g, '_')}.png`;
    const blob = dataURLtoBlob(dataUrl);
    const file = new File([blob], fileName, { type: 'image/png' });

    let shared = false;
    if (navigator.share && navigator.canShare) {
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Pronóstico ${match.homeTeam} vs ${match.awayTeam}`,
                    text: `Mi pronóstico para ${match.homeTeam} vs ${match.awayTeam} en el Prode Mundial 2026: https://sapate.net.ar/ 🤞⚽`
                });
                shared = true;
            }
        } catch (shareErr) {
            console.log('Compartir cancelado o fallido:', shareErr);
            if (shareErr.name === 'AbortError') shared = true;
        }
    }

    if (!shared) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
    }
}

// =============================================
// ADMINISTRATIVE VIEWS & MANUAL MATCH OVERRIDES
// =============================================

function translateStage(stageId) {
    const found = STAGES.find(s => s.id === stageId);
    return found ? found.name : stageId;
}

window.initAdminView = function() {
    // Colapsar listado de usuarios por defecto
    const usersCollapseContainer = document.getElementById("users-collapse-container");
    if (usersCollapseContainer) {
        usersCollapseContainer.classList.add("hidden");
    }
    const iconToggleUsers = document.getElementById("icon-toggle-users");
    if (iconToggleUsers) {
        iconToggleUsers.classList.remove("rotate-90");
    }

    // Ocultar editor de partidos seleccionado
    const editor = document.getElementById("admin-selected-match-editor");
    if (editor) {
        editor.classList.add("hidden");
    }
    const select = document.getElementById("select-admin-all-matches");
    if (select) {
        select.value = "";
    }

    // Renderizar los partidos de la fecha actual
    renderAdminMatches();

    // Rellenar selector de todos los partidos
    populateAdminMatchesSelect();
};

window.renderAdminMatches = function() {
    const container = document.getElementById("admin-matches-list");
    if (!container) return;

    if (!Array.isArray(matchesState) || matchesState.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 italic">No hay partidos cargados.</p>`;
        return;
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('es-AR');

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('es-AR');

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('es-AR');

    // Filtrar partidos de ayer, hoy y mañana
    const currentMatches = matchesState.filter(m => {
        if (!m.matchDate) return false;
        const mDate = new Date(m.matchDate);
        const mDateStr = mDate.toLocaleDateString('es-AR');
        return mDateStr === todayStr || mDateStr === yesterdayStr || mDateStr === tomorrowStr;
    });

    if (currentMatches.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic">No hay partidos programados para ayer, hoy o mañana.</p>`;
        return;
    }

    // Ordenar cronológicamente
    currentMatches.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    container.innerHTML = "";
    currentMatches.forEach(m => {
        const timeStr = new Date(m.matchDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(m.matchDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

        const div = document.createElement("div");
        div.className = "flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs";

        div.innerHTML = `
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md font-mono text-[10px]">${dateStr} ${timeStr}</span>
                <span class="font-bold text-white truncate">${m.homeTeam} vs ${m.awayTeam}</span>
                <span class="text-[10px] bg-slate-800 text-slate-500 px-1.5 rounded uppercase tracking-wider">${translateStage(m.stage)}</span>
            </div>
            <div class="flex items-center gap-2 w-full md:w-auto justify-end">
                <div class="flex items-center gap-1">
                    <input type="number" min="0" placeholder="-" id="admin-home-${m.id}" class="w-12 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-center py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none" value="${m.homeGoals !== null && m.homeGoals !== undefined ? m.homeGoals : ''}">
                    <span class="text-slate-500 font-bold">-</span>
                    <input type="number" min="0" placeholder="-" id="admin-away-${m.id}" class="w-12 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-center py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none" value="${m.awayGoals !== null && m.awayGoals !== undefined ? m.awayGoals : ''}">
                </div>
                <select id="admin-status-${m.id}" class="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                    <option value="pending" ${m.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>Finalizado</option>
                </select>
                <button class="btn-save-admin-match bg-brand-600 hover:bg-brand-500 text-white font-bold py-1 px-3 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1" data-match-id="${m.id}">
                    <i class="ph-bold ph-floppy-disk"></i> Guardar
                </button>
            </div>
        `;

        container.appendChild(div);
    });

    // Event listeners para guardar cambios
    container.querySelectorAll(".btn-save-admin-match").forEach(btn => {
        btn.addEventListener("click", async () => {
            const matchId = btn.dataset.matchId;
            const homeInput = document.getElementById(`admin-home-${matchId}`);
            const awayInput = document.getElementById(`admin-away-${matchId}`);
            const statusSelect = document.getElementById(`admin-status-${matchId}`);

            if (!homeInput || !awayInput || !statusSelect) return;

            const homeGoals = homeInput.value.trim();
            const awayGoals = awayInput.value.trim();
            const status = statusSelect.value;

            await saveManualMatchResult(matchId, homeGoals, awayGoals, status);
        });
    });
};

window.populateAdminMatchesSelect = function() {
    const select = document.getElementById("select-admin-all-matches");
    if (!select) return;

    if (!Array.isArray(matchesState) || matchesState.length === 0) {
        select.innerHTML = `<option value="">Cargando partidos...</option>`;
        return;
    }

    const sortedMatches = [...matchesState];
    sortedMatches.sort((a, b) => {
        const nameA = `${a.homeTeam} vs ${a.awayTeam}`;
        const nameB = `${b.homeTeam} vs ${b.awayTeam}`;
        return nameA.localeCompare(nameB);
    });

    select.innerHTML = `<option value="">Seleccionar un partido para editar...</option>`;
    sortedMatches.forEach(m => {
        const option = document.createElement("option");
        option.value = m.id;
        option.textContent = `${m.homeTeam} vs ${m.awayTeam} (${translateStage(m.stage)})`;
        select.appendChild(option);
    });
};

async function saveManualMatchResult(matchId, homeGoals, awayGoals, status) {
    if (status === 'finished') {
        if (homeGoals === '' || awayGoals === '') {
            alert('Para finalizar un partido, debés ingresar los goles de ambos equipos.');
            return;
        }
    }

    showLoader();
    try {
        const { error } = await supabase.rpc('admin_update_match_manual', {
            p_match_id: matchId,
            p_home_goals: homeGoals,
            p_away_goals: awayGoals,
            p_status: status
        });

        if (error) throw error;

        alert('Partido actualizado correctamente. Se han recalculado los puntajes.');

        // Ocultar editor si el partido actualizado era el seleccionado
        const editor = document.getElementById("admin-selected-match-editor");
        if (editor) {
            const saveBtn = document.getElementById("btn-selected-save-match");
            if (saveBtn && saveBtn.dataset.matchId === matchId) {
                editor.classList.add("hidden");
                const select = document.getElementById("select-admin-all-matches");
                if (select) select.value = "";
            }
        }
    } catch (err) {
        console.error("Error al actualizar partido manualmente:", err);
        alert('Error al actualizar el partido: ' + err.message);
    } finally {
        hideLoader();
    }
}

// Configuración de listeners globales de administración
const btnToggleUsers = document.getElementById("btn-toggle-users");
const usersCollapseContainer = document.getElementById("users-collapse-container");
const iconToggleUsers = document.getElementById("icon-toggle-users");

if (btnToggleUsers && usersCollapseContainer && iconToggleUsers) {
    btnToggleUsers.addEventListener("click", async () => {
        const isHidden = usersCollapseContainer.classList.contains("hidden");
        if (isHidden) {
            usersCollapseContainer.classList.remove("hidden");
            iconToggleUsers.classList.add("rotate-90");
            await loadUsersGrid();
        } else {
            usersCollapseContainer.classList.add("hidden");
            iconToggleUsers.classList.remove("rotate-90");
        }
    });
}

const btnAdminLoadSelectedMatch = document.getElementById("btn-admin-load-selected-match");
const selectAdminAllMatches = document.getElementById("select-admin-all-matches");
const adminSelectedMatchEditor = document.getElementById("admin-selected-match-editor");

if (btnAdminLoadSelectedMatch && selectAdminAllMatches && adminSelectedMatchEditor) {
    btnAdminLoadSelectedMatch.addEventListener("click", () => {
        const matchId = selectAdminAllMatches.value;
        if (!matchId) {
            alert("Por favor, selecciona un partido de la lista.");
            return;
        }

        const match = matchesState.find(m => m.id === matchId);
        if (!match) {
            alert("No se encontró el partido.");
            return;
        }

        adminSelectedMatchEditor.classList.remove("hidden");
        adminSelectedMatchEditor.innerHTML = `
            <div class="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-white">${match.homeTeam} vs ${match.awayTeam}</span>
                    <span class="text-[10px] text-slate-500 font-mono">(${translateStage(match.stage)})</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1">
                        <input type="number" min="0" placeholder="-" id="selected-home-${match.id}" class="w-12 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-center py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none" value="${match.homeGoals !== null && match.homeGoals !== undefined ? match.homeGoals : ''}">
                        <span class="text-slate-500 font-bold">-</span>
                        <input type="number" min="0" placeholder="-" id="selected-away-${match.id}" class="w-12 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-center py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none" value="${match.awayGoals !== null && match.awayGoals !== undefined ? match.awayGoals : ''}">
                    </div>
                    <select id="selected-status-${match.id}" class="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                        <option value="pending" ${match.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                        <option value="finished" ${match.status === 'finished' ? 'selected' : ''}>Finalizado</option>
                    </select>
                    <button id="btn-selected-save-match" class="bg-brand-600 hover:bg-brand-500 text-white font-bold py-1 px-3 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1" data-match-id="${match.id}">
                        <i class="ph-bold ph-floppy-disk"></i> Guardar
                    </button>
                </div>
            </div>
        `;

        const saveBtn = document.getElementById("btn-selected-save-match");
        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                const matchId = saveBtn.dataset.matchId;
                const homeInput = document.getElementById(`selected-home-${matchId}`);
                const awayInput = document.getElementById(`selected-away-${matchId}`);
                const statusSelect = document.getElementById(`selected-status-${matchId}`);

                if (!homeInput || !awayInput || !statusSelect) return;

                const homeGoals = homeInput.value.trim();
                const awayGoals = awayInput.value.trim();
                const status = statusSelect.value;

                await saveManualMatchResult(matchId, homeGoals, awayGoals, status);
            });
        }
    });
}


// =============================================
// MINI JACKPOT Y TARJETA DE LA SUERTE LOGIC
// =============================================

function getCurrentUserRank() {
    const { user: currentUser, alias: currentAlias } = getCurrentUser();
    if (!currentUser) return -1;
    if (isMock) {
        return rankingState.findIndex(r => r.alias === currentAlias);
    } else {
        return rankingState.findIndex(r => r.id === currentUser.id);
    }
}

function updateJackpotAvailability() {
    const btnSpin = document.getElementById("btn-spin-jackpot");
    const btnMockWin = document.getElementById("btn-spin-jackpot-mock-win");
    const statusMsg = document.getElementById("jackpot-status-msg");
    if (!btnSpin || !statusMsg) return;

    const { user: currentUser, alias: currentAlias } = getCurrentUser();
    if (!currentUser) {
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.classList.add("hidden");
        statusMsg.innerHTML = "Iniciá sesión para jugar al Jackpot.";
        return;
    }

    if (rankingState.length === 0) {
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.classList.add("hidden");
        statusMsg.innerHTML = "Cargando clasificación general...";
        return;
    }

    const rankIdx = getCurrentUserRank();
    const isUserMock = isMock || (currentUser && String(currentUser.id).startsWith("mock_"));
    
    // Check daily cooldown (both in localStorage and in database profile field)
    const lastWinStr = localStorage.getItem("prode_jackpot_last_win_" + (currentUser.id || currentAlias));
    const dbWinStr = currentUser.last_jackpot_win;
    const todayStr = new Date().toDateString();
    if (lastWinStr === todayStr || dbWinStr === todayStr) {
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.classList.add("hidden");
        statusMsg.innerHTML = "🍀 ¡Ya ganaste tu tarjeta de la suerte hoy! Volvé mañana para jugar de nuevo.";
        return;
    }

    if (rankIdx !== -1 && rankIdx < 3) {
        // Podium (1st, 2nd, 3rd)
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.classList.add("hidden");
        statusMsg.innerHTML = "🏆 El podio (1°, 2° y 3° puesto) no puede jugar al jackpot. ¡Dejá algo de suerte para el resto!";
        return;
    }

    // Get current user score
    let userScore = 0;
    if (isUserMock) {
        const stored = localStorage.getItem("prode_mock_user");
        if (stored) {
            userScore = JSON.parse(stored).score || 0;
        }
    } else {
        const meInRanking = rankingState.find(r => r.id === currentUser.id);
        userScore = meInRanking ? meInRanking.score : 0;
    }

    // 0-Score safeguard: if 4th place has 0 pts or less than 10, set baseline target to 10
    let targetScore = rankingState.length >= 4 ? rankingState[3].score : 10;
    if (targetScore < 10) {
        targetScore = 10;
    }

    if (userScore >= targetScore) {
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.classList.add("hidden");
        statusMsg.innerHTML = `⚠️ Ya alcanzaste o superaste el puntaje del 4° puesto (${targetScore} pts). ¡No podés sumar más por ahora!`;
        return;
    }

    // Eligible!
    btnSpin.disabled = false;
    if (isUserMock && btnMockWin) {
        btnMockWin.classList.remove("hidden");
        btnMockWin.disabled = false;
    }
    const maxWin = targetScore - userScore;
    statusMsg.innerHTML = `🎰 ¡Estás habilitado para jugar! Podés ganar hasta <strong>${maxWin} puntos</strong> para igualar al 4° puesto (${targetScore} pts).`;
}

function initJackpotGame() {
    updateJackpotAvailability();

    const btnSpin = document.getElementById("btn-spin-jackpot");
    const btnMockWin = document.getElementById("btn-spin-jackpot-mock-win");
    const statusMsg = document.getElementById("jackpot-status-msg");
    if (!btnSpin) return;

    // Set up standard icons/flags on reels on load if empty
    const reelEls = [
        document.getElementById("jackpot-reel-1"),
        document.getElementById("jackpot-reel-2"),
        document.getElementById("jackpot-reel-3")
    ];

    const teams = Object.values(GROUP_MAP)
        .flat()
        .map(t => ({ name: t.team, flag: t.flag }));

    reelEls.forEach((reelEl, index) => {
        if (reelEl && (reelEl.innerHTML.includes("ph-question") || reelEl.innerHTML.trim() === "")) {
            const randomTeam = teams[Math.floor(Math.random() * teams.length)];
            const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${randomTeam.flag}.svg`;
            reelEl.innerHTML = `<img src="${flagUrl}" alt="${randomTeam.name}" title="${randomTeam.name}">`;
        }
    });

    const performSpin = (forceWin = false) => {
        btnSpin.disabled = true;
        if (btnMockWin) btnMockWin.disabled = true;
        
        statusMsg.textContent = forceWin ? "🎰 ¡Girando rodillos (Ganada Asegurada)..." : "🎰 ¡Girando rodillos!...";

        reelEls.forEach(el => el.classList.add("reel-blur"));

        let spinIntervals = [];
        let finalTeams = [null, null, null];

        // Pick forced winning team flag for a 3-match win if forceWin is true
        const winningTeam = forceWin ? teams[Math.floor(Math.random() * teams.length)] : null;

        // Spin reels at slightly different speeds/times
        reelEls.forEach((reelEl, index) => {
            const interval = setInterval(() => {
                const randomTeam = teams[Math.floor(Math.random() * teams.length)];
                const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${randomTeam.flag}.svg`;
                reelEl.innerHTML = `<img src="${flagUrl}" alt="${randomTeam.name}" title="${randomTeam.name}">`;
                finalTeams[index] = randomTeam;
            }, 80 + index * 20);
            
            spinIntervals.push(interval);
        });

        // Stop reels sequentially
        setTimeout(() => {
            clearInterval(spinIntervals[0]);
            reelEls[0].classList.remove("reel-blur");
            if (forceWin) {
                const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${winningTeam.flag}.svg`;
                reelEls[0].innerHTML = `<img src="${flagUrl}" alt="${winningTeam.name}" title="${winningTeam.name}">`;
                finalTeams[0] = winningTeam;
            }
            
            setTimeout(() => {
                clearInterval(spinIntervals[1]);
                reelEls[1].classList.remove("reel-blur");
                if (forceWin) {
                    const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${winningTeam.flag}.svg`;
                    reelEls[1].innerHTML = `<img src="${flagUrl}" alt="${winningTeam.name}" title="${winningTeam.name}">`;
                    finalTeams[1] = winningTeam;
                }
                
                setTimeout(() => {
                    clearInterval(spinIntervals[2]);
                    reelEls[2].classList.remove("reel-blur");
                    if (forceWin) {
                        const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/${winningTeam.flag}.svg`;
                        reelEls[2].innerHTML = `<img src="${flagUrl}" alt="${winningTeam.name}" title="${winningTeam.name}">`;
                        finalTeams[2] = winningTeam;
                    }
                    
                    if (btnMockWin) btnMockWin.disabled = false;
                    // Evaluate result
                    evaluateJackpotResult(finalTeams);
                }, 600);
            }, 600);
        }, 1200);
    };

    btnSpin.onclick = () => performSpin(false);

    if (btnMockWin) {
        btnMockWin.onclick = () => performSpin(true);
    }

    // Close button for lucky card modal
    const btnCloseLucky = document.getElementById("btn-close-lucky-card");
    const luckyModal = document.getElementById("modal-lucky-card");
    if (btnCloseLucky && luckyModal) {
        btnCloseLucky.onclick = () => {
            luckyModal.classList.add("hidden");
            luckyModal.classList.remove("flex");
            updateJackpotAvailability();
        };
    }
}

function evaluateJackpotResult(finalTeams) {
    const btnSpin = document.getElementById("btn-spin-jackpot");
    const statusMsg = document.getElementById("jackpot-status-msg");
    const { user: currentUser } = getCurrentUser();

    // Check matches
    const isThreeMatch = (finalTeams[0].flag === finalTeams[1].flag && finalTeams[1].flag === finalTeams[2].flag);
    const isTwoMatch = (finalTeams[0].flag === finalTeams[1].flag || finalTeams[1].flag === finalTeams[2].flag || finalTeams[0].flag === finalTeams[2].flag);
    
    const matchCount = isThreeMatch ? 3 : (isTwoMatch ? 2 : 0);

    let pointsWon = 0;
    if (matchCount === 3) {
        pointsWon = 3;
    } else if (matchCount === 2) {
        pointsWon = 1;
    }

    if (pointsWon === 0) {
        statusMsg.innerHTML = "❌ No hubo suerte esta vez. ¡Volvé a intentar!";
        btnSpin.disabled = false;
        updateJackpotAvailability();
        return;
    }

    // We won points! Check how many we can actually claim (capped at 4th place)
    let userScore = 0;
    const isUserMock = isMock || (currentUser && String(currentUser.id).startsWith("mock_"));
    if (isUserMock) {
        const stored = localStorage.getItem("prode_mock_user");
        if (stored) {
            userScore = JSON.parse(stored).score || 0;
        }
    } else {
        const meInRanking = rankingState.find(r => r.id === currentUser.id);
        userScore = meInRanking ? meInRanking.score : 0;
    }

    // 0-Score safeguard: if 4th place has 0 pts or less than 10, set baseline target to 10
    let targetScore = rankingState.length >= 4 ? rankingState[3].score : 10;
    if (targetScore < 10) {
        targetScore = 10;
    }
    const maxWin = Math.max(0, targetScore - userScore);
    
    // Apply cap
    const finalPointsWon = Math.min(pointsWon, maxWin);

    if (finalPointsWon <= 0) {
        statusMsg.innerHTML = "⚠️ Ganaste pero ya igualaste o superaste al 4° puesto. ¡Puntos acumulados: 0!";
        btnSpin.disabled = false;
        updateJackpotAvailability();
        return;
    }

    // Open Lucky Card modal to share and claim!
    jackpotWinningPoints = finalPointsWon;
    showLuckyCardModal(finalPointsWon);
}

function showLuckyCardModal(points) {
    const modal = document.getElementById("modal-lucky-card");
    const luckyImg = document.getElementById("lucky-card-img");
    const pointsLabel = document.getElementById("lucky-card-points-label");
    const btnShare = document.getElementById("btn-share-lucky-card");

    if (!modal || !luckyImg || !pointsLabel || !btnShare) return;

    // Trigger visual celebration animation!
    triggerConfetti();

    // Pick random prize image
    const randomCard = premiosCards[Math.floor(Math.random() * premiosCards.length)];
    luckyImg.src = randomCard.image || "/Premios/Birra.webp";

    pointsLabel.textContent = `🎁 ¡Vas a reclamar +${points} ${points === 1 ? 'punto' : 'puntos'}!`;
    luckyPrizeShared = false;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    btnShare.onclick = async () => {
        const textToShare = `Tarjeta de la suerte compartí y segui jugando. ¡Sumé +${points} puntos en el Prode Mundial 2026! 🍀🏆⚽`;
        const shareUrl = window.location.origin;

        let sharedSuccessfully = false;
        
        if (navigator.share) {
            try {
                // Fetch image to create File object
                const imgRes = await fetch(luckyImg.src);
                const blob = await imgRes.blob();
                const file = new File([blob], 'tarjeta_de_la_suerte.webp', { type: 'image/webp' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: "Tarjeta de la Suerte - Prode 2026",
                        text: textToShare + "\n" + shareUrl
                    });
                    sharedSuccessfully = true;
                } else {
                    await navigator.share({
                        title: "Tarjeta de la Suerte - Prode 2026",
                        text: textToShare,
                        url: shareUrl
                    });
                    sharedSuccessfully = true;
                }
            } catch (err) {
                console.log("Web share failed, trying fallback...", err);
            }
        }

        if (!sharedSuccessfully) {
            // Fallback: WhatsApp share
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare + " " + shareUrl)}`;
            window.open(waUrl, "_blank");
            sharedSuccessfully = true; // Count as shared for fallback
        }

        if (sharedSuccessfully) {
            await claimJackpotPoints(points);
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }
    };
}

async function claimJackpotPoints(points) {
    const { user: currentUser, alias: currentAlias } = getCurrentUser();
    if (!currentUser) return;

    showLoader();
    try {
        let currentScore = 0;
        const isUserMock = isMock || (currentUser && String(currentUser.id).startsWith("mock_"));
        if (isUserMock) {
            const stored = localStorage.getItem("prode_mock_user");
            if (stored) {
                const u = JSON.parse(stored);
                currentScore = u.score || 0;
                const newScore = currentScore + points;
                u.score = newScore;
                u.last_jackpot_win = todayStr;
                localStorage.setItem("prode_mock_user", JSON.stringify(u));
                
                // Set daily cooldown
                localStorage.setItem("prode_jackpot_last_win_" + u.uid, todayStr);
                
                // Update local memory user score and last jackpot win
                currentUser.score = newScore;
                currentUser.last_jackpot_win = todayStr;

                // Animate points counting up on the screen in real-time
                animatePointsUpdate(currentScore, newScore);

                // Update rankingState locally
                const myRankIdx = rankingState.findIndex(r => r.alias === currentAlias || r.id === currentUser.id);
                if (myRankIdx !== -1) {
                    rankingState[myRankIdx].score = newScore;
                    rankingState.sort((a, b) => b.score - a.score);
                } else {
                    rankingState.push({ id: currentUser.id, alias: currentAlias, score: newScore });
                    rankingState.sort((a, b) => b.score - a.score);
                }

                // Update UI panels in real-time without page reload
                renderRanking(rankingState);
                if (typeof updateEspecialesRanking === 'function') {
                    updateEspecialesRanking();
                }
                updateJackpotAvailability();

                showDevNotification(`🎉 ¡Puntos sumados! Se sumaron +${points} puntos (Total: ${newScore} pts) en Modo Mock.`);
            }
        } else {
            // Production Supabase Mode
            const { data: userData, error: fetchErr } = await supabase
                .from('users')
                .select('score')
                .eq('id', currentUser.id)
                .single();
                
            if (fetchErr) throw fetchErr;

            currentScore = userData.score || 0;
            const newScore = currentScore + points;

            const todayStr = new Date().toDateString();

            const { error: updateErr } = await supabase
                .from('users')
                .update({ 
                    score: newScore,
                    last_jackpot_win: todayStr
                })
                .eq('id', currentUser.id);

            if (updateErr) throw updateErr;

            // Update local session memory
            currentUser.last_jackpot_win = todayStr;

            // Set daily cooldown in localStorage
            localStorage.setItem("prode_jackpot_last_win_" + currentUser.id, todayStr);

            // Animate points counting up on the screen
            animatePointsUpdate(currentScore, newScore);

            // Update rankingState locally
            const myRankIdx = rankingState.findIndex(r => r.id === currentUser.id);
            if (myRankIdx !== -1) {
                rankingState[myRankIdx].score = newScore;
                rankingState.sort((a, b) => b.score - a.score);
            }

            renderRanking(rankingState);
            if (typeof updateEspecialesRanking === 'function') {
                updateEspecialesRanking();
            }
            updateJackpotAvailability();

            showDevNotification(`🎉 ¡Excelente! Puntos acreditados. Sumaste +${points} puntos al ranking.`);
        }
    } catch (err) {
        console.error("Error claiming jackpot points:", err);
        alert("Hubo un error al acreditar tus puntos. Inténtalo de nuevo.");
    } finally {
        hideLoader();
    }
}

// =============================================
// CONFETTI, NOTIFICATIONS AND POINTS ANIMATION
// =============================================

function triggerConfetti() {
    const existing = document.getElementById("confetti-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "confetti-container";
    container.className = "confetti-container";
    document.body.appendChild(container);

    const colors = [
        "#f59e0b", // amber/gold
        "#10b981", // emerald
        "#3b82f6", // blue
        "#ec4899", // pink
        "#ef4444", // red
        "#8b5cf6", // purple
        "#06b6d4", // cyan
        "#eab308"  // yellow
    ];

    const shapes = ["rect", "circle"];

    for (let i = 0; i < 120; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const left = Math.random() * 100;
        const size = Math.random() * 8 + 6; // 6 to 14px
        const duration = Math.random() * 2 + 1.8; // 1.8 to 3.8s
        const delay = Math.random() * 1.2;
        const sway = (Math.random() - 0.5) * 180; // -90px to 90px

        piece.style.backgroundColor = color;
        piece.style.left = `${left}%`;
        piece.style.width = `${size}px`;
        piece.style.height = shape === "circle" ? `${size}px` : `${size * 0.6}px`;
        if (shape === "circle") {
            piece.style.borderRadius = "50%";
        }
        piece.style.animationDuration = `${duration}s`;
        piece.style.animationDelay = `${delay}s`;
        piece.style.setProperty("--sway-x", `${sway}px`);

        container.appendChild(piece);
    }

    setTimeout(() => {
        container.remove();
    }, 6000);
}

function animatePointsUpdate(startScore, endScore, durationMs = 1500) {
    const display = document.getElementById("user-points-display");
    if (!display) return;

    display.classList.add("glow-pulse-green");

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        
        // Easing function (easeOutQuad)
        const ease = progress * (2 - progress);
        
        const current = Math.floor(startScore + (endScore - startScore) * ease);
        display.textContent = `${current} pts`;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            display.textContent = `${endScore} pts`;
            setTimeout(() => {
                display.classList.remove("glow-pulse-green");
            }, 600);
        }
    }

    requestAnimationFrame(update);
}

function showDevNotification(message) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "px-4 py-3 bg-slate-900/90 text-white text-sm font-semibold rounded-xl border border-slate-800 shadow-2xl flex items-center gap-2 transform translate-y-10 opacity-0 transition-all duration-300 ease-out pointer-events-auto max-w-sm";
    toast.innerHTML = `
        <i class="ph-bold ph-info text-brand-500 text-lg"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-10", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("translate-y-10", "opacity-0");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4500);
}



