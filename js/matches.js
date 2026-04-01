// js/matches.js
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db, isMock } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

// Mock Data for the 2026 World Cup (Sample)
// Used when Firebase is not connected
export const MOCK_MATCHES = [];

// Generar los 5 partidos iniciales confirmados
MOCK_MATCHES.push({ id: "m1", stage: "groups", homeTeam: "México", awayTeam: "Croacia", matchDate: "2026-06-11T12:00:00-06:00", homeFlag: "mx", awayFlag: "hr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m2", stage: "groups", homeTeam: "Canadá", awayTeam: "Suiza", matchDate: "2026-06-12T13:00:00-07:00", homeFlag: "ca", awayFlag: "ch", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m3", stage: "groups", homeTeam: "EE.UU.", awayTeam: "Japón", matchDate: "2026-06-12T15:00:00-07:00", homeFlag: "us", awayFlag: "jp", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m4", stage: "groups", homeTeam: "Argentina", awayTeam: "Polonia", matchDate: "2026-06-13T16:00:00-04:00", homeFlag: "ar", awayFlag: "pl", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m5", stage: "groups", homeTeam: "España", awayTeam: "Corea", matchDate: "2026-06-14T12:00:00-04:00", homeFlag: "es", awayFlag: "kr", status: "pending", tbd: false });

// Generar el resto de la Fase de Grupos (72 en total, faltan 67)
let matchIdCounter = 6;
for(let i=1; i<=67; i++) {
    MOCK_MATCHES.push({
        id: `mg${matchIdCounter++}`, stage: "groups",
        homeTeam: `Equipo por definir`, awayTeam: `Equipo por definir`,
        matchDate: `2026-06-${14 + (i%14)}T15:00:00-04:00`,
        homeFlag: "un", awayFlag: "un", status: "pending", tbd: true
    });
}
// 16vos de final (32 equipos -> 16 partidos)
for(let i=1; i<=16; i++) {
    MOCK_MATCHES.push({ id: `m32_${i}`, stage: "round_32", homeTeam: `1ro Grupo ?`, awayTeam: `2do Grupo ?`, matchDate: `2026-06-29T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
}
// Octavos de final (8 partidos)
for(let i=1; i<=8; i++) {
    MOCK_MATCHES.push({ id: `m16_${i}`, stage: "round_16", homeTeam: `Ganador 16vos ${i*2-1}`, awayTeam: `Ganador 16vos ${i*2}`, matchDate: `2026-07-04T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
}
// Cuartos de final (4 partidos)
for(let i=1; i<=4; i++) {
    MOCK_MATCHES.push({ id: `m8_${i}`, stage: "quarter_finals", homeTeam: `Ganador 8vos ${i*2-1}`, awayTeam: `Ganador 8vos ${i*2}`, matchDate: `2026-07-09T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
}
// Semifinales (2 partidos)
for(let i=1; i<=2; i++) {
    MOCK_MATCHES.push({ id: `m4_${i}`, stage: "semi_finals", homeTeam: `Ganador 4tos ${i*2-1}`, awayTeam: `Ganador 4tos ${i*2}`, matchDate: `2026-07-14T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
}
// Tercer Puesto
MOCK_MATCHES.push({ id: `m3rd`, stage: "third_place", homeTeam: `Perdedor Semi 1`, awayTeam: `Perdedor Semi 2`, matchDate: `2026-07-18T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
// Final
MOCK_MATCHES.push({ id: `final`, stage: "final", homeTeam: `Ganador Semi 1`, awayTeam: `Ganador Semi 2`, matchDate: `2026-07-19T15:00:00-04:00`, homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });

export function subscribeToMatches(callback) {
    if (isMock) {
        callback(MOCK_MATCHES);
        return () => {};
    }

    const q = query(collection(db, "matches"), orderBy("matchDate", "asc"));
    return onSnapshot(q, (snapshot) => {
        const matches = [];
        snapshot.forEach((doc) => {
            matches.push({ id: doc.id, ...doc.data() });
        });
        callback(matches);
    }, (error) => {
        console.error("Error fetching matches:", error);
    });
}

export function subscribeToUserPredictions(userId, callback) {
    if (isMock) {
        let lastData = localStorage.getItem(`prode_preds_${userId}`) || "{}";
        callback(JSON.parse(lastData));
        
        // Polling loop for mock to simulate real-time updates across multiple tabs
        const interval = setInterval(() => {
            const data = localStorage.getItem(`prode_preds_${userId}`) || "{}";
            if (data !== lastData) {
                lastData = data;
                callback(JSON.parse(data));
            }
        }, 1000);
        return () => clearInterval(interval);
    }

    const predsRef = collection(db, "users", userId, "predictions");
    return onSnapshot(predsRef, (snapshot) => {
        const preds = {};
        snapshot.forEach((doc) => {
            preds[doc.id] = doc.data();
        });
        callback(preds);
    });
}

export async function savePrediction(matchId, result, homeGoals = '', awayGoals = '') {
    const { user } = getCurrentUser();
    if (!user) throw new Error("Debes estar logueado.");
    
    // El frontend ya valida la hora, pero lo ideal es que Cloud Rules validen esto en backend.
    
    if (isMock) {
        const k = `prode_preds_${user.uid}`;
        const preds = JSON.parse(localStorage.getItem(k) || "{}");
        preds[matchId] = { result, homeGoals, awayGoals, updatedAt: new Date().toISOString() };
        localStorage.setItem(k, JSON.stringify(preds));
        return;
    }

    const ref = doc(db, "users", user.uid, "predictions", matchId);
    await setDoc(ref, {
        result: result,
        homeGoals: homeGoals,
        awayGoals: awayGoals,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}
