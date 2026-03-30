// js/ranking.js
import { collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db, isMock } from "./firebase-config.js";

// Mock Data for testing
export const MOCK_RANKING = [
    { alias: "MessiFan99", score: 15 },
    { alias: "PepeMundial", score: 12 },
    { alias: "DibuKeeper", score: 9 },
    { alias: "GoleadorOK", score: 4 },
];

export function subscribeToRanking(callback) {
    if (isMock) {
        // En mock mode, leemos la data local primero y la sumamos al mock global (simulando usuarios)
        let currentMock = [...MOCK_RANKING];
        const localUserStr = localStorage.getItem("prode_mock_user");
        if(localUserStr) {
            const localUser = JSON.parse(localUserStr);
            currentMock.push({ alias: localUser.alias, score: localUser.score || 0 });
        }
        
        currentMock.sort((a,b) => b.score - a.score);
        callback(currentMock);
        
        const interval = setInterval(() => {
             let updMock = [...MOCK_RANKING];
             const lcStr = localStorage.getItem("prode_mock_user");
             if(lcStr) {
                 const lc = JSON.parse(lcStr);
                 updMock.push({ alias: lc.alias, score: lc.score || 0 });
             }
             updMock.sort((a,b) => b.score - a.score);
             callback(updMock);
        }, 3000);
        return () => clearInterval(interval);
    }

    const q = query(collection(db, "users"), orderBy("score", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
        const ranking = [];
        snapshot.forEach((doc) => {
            ranking.push({ id: doc.id, ...doc.data() });
        });
        callback(ranking);
    }, (error) => {
        console.error("Error fetching ranking:", error);
    });
}
