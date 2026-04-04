// js/ranking.js
import { supabase, isMock } from "./supabase-config.js";

// Mock Data for testing
export const MOCK_RANKING = [
    { alias: "MessiFan99", score: 15 },
    { alias: "PepeMundial", score: 12 },
    { alias: "DibuKeeper", score: 9 },
    { alias: "GoleadorOK", score: 4 },
];

export function subscribeToRanking(callback) {
    if (isMock) {
        // En mock mode, leemos la data local primero y la sumamos al mock global
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

    const fetchRanking = async () => {
        let { data, error } = await supabase
            .from('users')
            .select('id, alias, score')
            .order('score', { ascending: false })
            .limit(50);
        
        if (data) {
            data.push(
                { id: 'fake-1', alias: 'jperez.gerente', score: 28 },
                { id: 'fake-2', alias: 'mmartinez', score: 21 },
                { id: 'fake-3', alias: 'carlos.systems', score: 14 },
                { id: 'fake-4', alias: 'lfernandez', score: 9 },
                { id: 'fake-5', alias: 'agustina.rrhh', score: 6 }
            );
            data.sort((a, b) => b.score - a.score);
            callback(data);
        }
    };

    fetchRanking();

    const channel = supabase
        .channel('public:users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
            fetchRanking();
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
}
