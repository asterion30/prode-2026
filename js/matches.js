// js/matches.js
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db, isMock } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

// Mock Data for the 2026 World Cup (Sample)
// Used when Firebase is not connected
export const MOCK_MATCHES = [];

MOCK_MATCHES.push({ id: "m_México_Sudáfrica", stage: "groups", homeTeam: "México", awayTeam: "Sudáfrica", matchDate: "2026-06-11T15:00:00-04:00", homeFlag: "mx", awayFlag: "za", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_RepúblicadeCorea_RepúblicaCheca", stage: "groups", homeTeam: "República de Corea", awayTeam: "República Checa", matchDate: "2026-06-11T22:00:00-04:00", homeFlag: "kr", awayFlag: "cz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Canadá_BosniayHerzegovina", stage: "groups", homeTeam: "Canadá", awayTeam: "Bosnia y Herzegovina", matchDate: "2026-06-12T15:00:00-04:00", homeFlag: "ca", awayFlag: "ba", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_EstadosUnidos_Paraguay", stage: "groups", homeTeam: "Estados Unidos", awayTeam: "Paraguay", matchDate: "2026-06-12T21:00:00-04:00", homeFlag: "us", awayFlag: "py", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Catar_Suiza", stage: "groups", homeTeam: "Catar", awayTeam: "Suiza", matchDate: "2026-06-12T15:00:00-04:00", homeFlag: "qa", awayFlag: "ch", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Brasil_Marruecos", stage: "groups", homeTeam: "Brasil", awayTeam: "Marruecos", matchDate: "2026-06-12T18:00:00-04:00", homeFlag: "br", awayFlag: "ma", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Haití_Escocia", stage: "groups", homeTeam: "Haití", awayTeam: "Escocia", matchDate: "2026-06-12T21:00:00-04:00", homeFlag: "ht", awayFlag: "gb-sct", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Australia_Turquía", stage: "groups", homeTeam: "Australia", awayTeam: "Turquía", matchDate: "2026-06-12T00:00:00-04:00", homeFlag: "au", awayFlag: "tr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Alemania_Curazao", stage: "groups", homeTeam: "Alemania", awayTeam: "Curazao", matchDate: "2026-06-14T13:00:00-04:00", homeFlag: "de", awayFlag: "cw", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_PaísesBajos_Japón", stage: "groups", homeTeam: "Países Bajos", awayTeam: "Japón", matchDate: "2026-06-14T16:00:00-04:00", homeFlag: "nl", awayFlag: "jp", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_CostadeMarfil_Ecuador", stage: "groups", homeTeam: "Costa de Marfil", awayTeam: "Ecuador", matchDate: "2026-06-14T19:00:00-04:00", homeFlag: "ci", awayFlag: "ec", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Suecia_Túnez", stage: "groups", homeTeam: "Suecia", awayTeam: "Túnez", matchDate: "2026-06-14T22:00:00-04:00", homeFlag: "se", awayFlag: "tn", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_España_CaboVerde", stage: "groups", homeTeam: "España", awayTeam: "Cabo Verde", matchDate: "2026-06-15T12:00:00-04:00", homeFlag: "es", awayFlag: "cv", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Bélgica_Egipto", stage: "groups", homeTeam: "Bélgica", awayTeam: "Egipto", matchDate: "2026-06-15T15:00:00-04:00", homeFlag: "be", awayFlag: "eg", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_ArabiaSaudí_Uruguay", stage: "groups", homeTeam: "Arabia Saudí", awayTeam: "Uruguay", matchDate: "2026-06-15T18:00:00-04:00", homeFlag: "sa", awayFlag: "uy", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_RIdeIrán_NuevaZelanda", stage: "groups", homeTeam: "RI de Irán", awayTeam: "Nueva Zelanda", matchDate: "2026-06-15T21:00:00-04:00", homeFlag: "ir", awayFlag: "nz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Francia_Senegal", stage: "groups", homeTeam: "Francia", awayTeam: "Senegal", matchDate: "2026-06-16T15:00:00-04:00", homeFlag: "fr", awayFlag: "sn", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Irak_Noruega", stage: "groups", homeTeam: "Irak", awayTeam: "Noruega", matchDate: "2026-06-16T18:00:00-04:00", homeFlag: "iq", awayFlag: "no", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Argentina_Argelia", stage: "groups", homeTeam: "Argentina", awayTeam: "Argelia", matchDate: "2026-06-16T21:00:00-04:00", homeFlag: "ar", awayFlag: "dz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Austria_Jordania", stage: "groups", homeTeam: "Austria", awayTeam: "Jordania", matchDate: "2026-06-16T00:00:00-04:00", homeFlag: "at", awayFlag: "jo", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Portugal_RDCongo", stage: "groups", homeTeam: "Portugal", awayTeam: "RD Congo", matchDate: "2026-06-16T13:00:00-04:00", homeFlag: "pt", awayFlag: "cd", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Inglaterra_Croacia", stage: "groups", homeTeam: "Inglaterra", awayTeam: "Croacia", matchDate: "2026-06-16T16:00:00-04:00", homeFlag: "gb-eng", awayFlag: "hr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Ghana_Panamá", stage: "groups", homeTeam: "Ghana", awayTeam: "Panamá", matchDate: "2026-06-16T19:00:00-04:00", homeFlag: "gh", awayFlag: "pa", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Uzbekistán_Colombia", stage: "groups", homeTeam: "Uzbekistán", awayTeam: "Colombia", matchDate: "2026-06-16T22:00:00-04:00", homeFlag: "uz", awayFlag: "co", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_RepúblicaCheca_Sudáfrica", stage: "groups", homeTeam: "República Checa", awayTeam: "Sudáfrica", matchDate: "2026-06-18T12:00:00-04:00", homeFlag: "cz", awayFlag: "za", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Suiza_BosniayHerzegovina", stage: "groups", homeTeam: "Suiza", awayTeam: "Bosnia y Herzegovina", matchDate: "2026-06-18T15:00:00-04:00", homeFlag: "ch", awayFlag: "ba", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Canadá_Catar", stage: "groups", homeTeam: "Canadá", awayTeam: "Catar", matchDate: "2026-06-18T18:00:00-04:00", homeFlag: "ca", awayFlag: "qa", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_México_RepúblicadeCorea", stage: "groups", homeTeam: "México", awayTeam: "República de Corea", matchDate: "2026-06-18T21:00:00-04:00", homeFlag: "mx", awayFlag: "kr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_EstadosUnidos_Australia", stage: "groups", homeTeam: "Estados Unidos", awayTeam: "Australia", matchDate: "2026-06-19T15:00:00-04:00", homeFlag: "us", awayFlag: "au", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Escocia_Marruecos", stage: "groups", homeTeam: "Escocia", awayTeam: "Marruecos", matchDate: "2026-06-19T18:00:00-04:00", homeFlag: "gb-sct", awayFlag: "ma", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Brasil_Haití", stage: "groups", homeTeam: "Brasil", awayTeam: "Haití", matchDate: "2026-06-19T21:00:00-04:00", homeFlag: "br", awayFlag: "ht", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Turquía_Paraguay", stage: "groups", homeTeam: "Turquía", awayTeam: "Paraguay", matchDate: "2026-06-19T00:00:00-04:00", homeFlag: "tr", awayFlag: "py", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_PaísesBajos_Suecia", stage: "groups", homeTeam: "Países Bajos", awayTeam: "Suecia", matchDate: "2026-06-19T13:00:00-04:00", homeFlag: "nl", awayFlag: "se", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Alemania_CostadeMarfil", stage: "groups", homeTeam: "Alemania", awayTeam: "Costa de Marfil", matchDate: "2026-06-19T16:00:00-04:00", homeFlag: "de", awayFlag: "ci", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Ecuador_Curazao", stage: "groups", homeTeam: "Ecuador", awayTeam: "Curazao", matchDate: "2026-06-19T22:00:00-04:00", homeFlag: "ec", awayFlag: "cw", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Túnez_Japón", stage: "groups", homeTeam: "Túnez", awayTeam: "Japón", matchDate: "2026-06-19T00:00:00-04:00", homeFlag: "tn", awayFlag: "jp", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_España_ArabiaSaudí", stage: "groups", homeTeam: "España", awayTeam: "Arabia Saudí", matchDate: "2026-06-21T12:00:00-04:00", homeFlag: "es", awayFlag: "sa", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Bélgica_Irán", stage: "groups", homeTeam: "Bélgica", awayTeam: "Irán", matchDate: "2026-06-21T15:00:00-04:00", homeFlag: "be", awayFlag: "ir", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Uruguay_CaboVerde", stage: "groups", homeTeam: "Uruguay", awayTeam: "Cabo Verde", matchDate: "2026-06-21T18:00:00-04:00", homeFlag: "uy", awayFlag: "cv", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_NuevaZelanda_Egipto", stage: "groups", homeTeam: "Nueva Zelanda", awayTeam: "Egipto", matchDate: "2026-06-21T21:00:00-04:00", homeFlag: "nz", awayFlag: "eg", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Argentina_Austria", stage: "groups", homeTeam: "Argentina", awayTeam: "Austria", matchDate: "2026-06-22T13:00:00-04:00", homeFlag: "ar", awayFlag: "at", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Francia_Irak", stage: "groups", homeTeam: "Francia", awayTeam: "Irak", matchDate: "2026-06-22T17:00:00-04:00", homeFlag: "fr", awayFlag: "iq", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Noruega_Senegal", stage: "groups", homeTeam: "Noruega", awayTeam: "Senegal", matchDate: "2026-06-22T20:00:00-04:00", homeFlag: "no", awayFlag: "sn", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Jordania_Argelia", stage: "groups", homeTeam: "Jordania", awayTeam: "Argelia", matchDate: "2026-06-22T23:00:00-04:00", homeFlag: "jo", awayFlag: "dz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Portugal_Uzbekistán", stage: "groups", homeTeam: "Portugal", awayTeam: "Uzbekistán", matchDate: "2026-06-23T13:00:00-04:00", homeFlag: "pt", awayFlag: "uz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Inglaterra_Ghana", stage: "groups", homeTeam: "Inglaterra", awayTeam: "Ghana", matchDate: "2026-06-23T16:00:00-04:00", homeFlag: "gb-eng", awayFlag: "gh", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Panamá_Croacia", stage: "groups", homeTeam: "Panamá", awayTeam: "Croacia", matchDate: "2026-06-23T19:00:00-04:00", homeFlag: "pa", awayFlag: "hr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Colombia_RDCongo", stage: "groups", homeTeam: "Colombia", awayTeam: "RD Congo", matchDate: "2026-06-23T22:00:00-04:00", homeFlag: "co", awayFlag: "cd", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Suiza_Canadá", stage: "groups", homeTeam: "Suiza", awayTeam: "Canadá", matchDate: "2026-06-23T15:00:00-04:00", homeFlag: "ch", awayFlag: "ca", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_BosniayHerzegovina_Catar", stage: "groups", homeTeam: "Bosnia y Herzegovina", awayTeam: "Catar", matchDate: "2026-06-23T15:00:00-04:00", homeFlag: "ba", awayFlag: "qa", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Escocia_Brasil", stage: "groups", homeTeam: "Escocia", awayTeam: "Brasil", matchDate: "2026-06-23T18:00:00-04:00", homeFlag: "gb-sct", awayFlag: "br", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Marruecos_Haití", stage: "groups", homeTeam: "Marruecos", awayTeam: "Haití", matchDate: "2026-06-23T18:00:00-04:00", homeFlag: "ma", awayFlag: "ht", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_RepúblicaCheca_México", stage: "groups", homeTeam: "República Checa", awayTeam: "México", matchDate: "2026-06-23T21:00:00-04:00", homeFlag: "cz", awayFlag: "mx", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Sudáfrica_RepúblicadeCorea", stage: "groups", homeTeam: "Sudáfrica", awayTeam: "República de Corea", matchDate: "2026-06-23T21:00:00-04:00", homeFlag: "za", awayFlag: "kr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Curazao_CostadeMarfil", stage: "groups", homeTeam: "Curazao", awayTeam: "Costa de Marfil", matchDate: "2026-06-25T16:00:00-04:00", homeFlag: "cw", awayFlag: "ci", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Ecuador_Alemania", stage: "groups", homeTeam: "Ecuador", awayTeam: "Alemania", matchDate: "2026-06-25T16:00:00-04:00", homeFlag: "ec", awayFlag: "de", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Japón_Suecia", stage: "groups", homeTeam: "Japón", awayTeam: "Suecia", matchDate: "2026-06-25T19:00:00-04:00", homeFlag: "jp", awayFlag: "se", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Túnez_PaísesBajos", stage: "groups", homeTeam: "Túnez", awayTeam: "Países Bajos", matchDate: "2026-06-25T19:00:00-04:00", homeFlag: "tn", awayFlag: "nl", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Turquía_EstadosUnidos", stage: "groups", homeTeam: "Turquía", awayTeam: "Estados Unidos", matchDate: "2026-06-25T22:00:00-04:00", homeFlag: "tr", awayFlag: "us", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Paraguay_Australia", stage: "groups", homeTeam: "Paraguay", awayTeam: "Australia", matchDate: "2026-06-25T22:00:00-04:00", homeFlag: "py", awayFlag: "au", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Noruega_Francia", stage: "groups", homeTeam: "Noruega", awayTeam: "Francia", matchDate: "2026-06-26T15:00:00-04:00", homeFlag: "no", awayFlag: "fr", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Senegal_Irak", stage: "groups", homeTeam: "Senegal", awayTeam: "Irak", matchDate: "2026-06-26T15:00:00-04:00", homeFlag: "sn", awayFlag: "iq", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_CaboVerde_ArabiaSaudí", stage: "groups", homeTeam: "Cabo Verde", awayTeam: "Arabia Saudí", matchDate: "2026-06-26T20:00:00-04:00", homeFlag: "cv", awayFlag: "sa", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Uruguay_España", stage: "groups", homeTeam: "Uruguay", awayTeam: "España", matchDate: "2026-06-26T20:00:00-04:00", homeFlag: "uy", awayFlag: "es", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Egipto_Irán", stage: "groups", homeTeam: "Egipto", awayTeam: "Irán", matchDate: "2026-06-26T23:00:00-04:00", homeFlag: "eg", awayFlag: "ir", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_NuevaZelanda_Bélgica", stage: "groups", homeTeam: "Nueva Zelanda", awayTeam: "Bélgica", matchDate: "2026-06-26T23:00:00-04:00", homeFlag: "nz", awayFlag: "be", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Panamá_Inglaterra", stage: "groups", homeTeam: "Panamá", awayTeam: "Inglaterra", matchDate: "2026-06-26T17:00:00-04:00", homeFlag: "pa", awayFlag: "gb-eng", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Croacia_Ghana", stage: "groups", homeTeam: "Croacia", awayTeam: "Ghana", matchDate: "2026-06-26T17:00:00-04:00", homeFlag: "hr", awayFlag: "gh", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Colombia_Portugal", stage: "groups", homeTeam: "Colombia", awayTeam: "Portugal", matchDate: "2026-06-26T19:30:00-04:00", homeFlag: "co", awayFlag: "pt", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_RDCongo_Uzbekistán", stage: "groups", homeTeam: "RD Congo", awayTeam: "Uzbekistán", matchDate: "2026-06-26T19:30:00-04:00", homeFlag: "cd", awayFlag: "uz", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Argelia_Austria", stage: "groups", homeTeam: "Argelia", awayTeam: "Austria", matchDate: "2026-06-26T22:00:00-04:00", homeFlag: "dz", awayFlag: "at", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m_Jordania_Argentina", stage: "groups", homeTeam: "Jordania", awayTeam: "Argentina", matchDate: "2026-06-26T22:00:00-04:00", homeFlag: "jo", awayFlag: "ar", status: "pending", tbd: false });
MOCK_MATCHES.push({ id: "m73", stage: "round_32", homeTeam: "2º Grupo A", awayTeam: "2º Grupo B", matchDate: "2026-06-28T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m74", stage: "round_32", homeTeam: "1º Grupo E", awayTeam: "3º Grupo A/B/C/D/F", matchDate: "2026-06-29T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m75", stage: "round_32", homeTeam: "1º Grupo F", awayTeam: "2º Grupo C", matchDate: "2026-06-29T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m76", stage: "round_32", homeTeam: "1º Grupo C", awayTeam: "2º Grupo F", matchDate: "2026-06-29T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m77", stage: "round_32", homeTeam: "1º Grupo I", awayTeam: "3º Grupo C/D/F/G/H", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m78", stage: "round_32", homeTeam: "2º Grupo E", awayTeam: "2º Grupo I", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m79", stage: "round_32", homeTeam: "1º Grupo A", awayTeam: "3º Grupo C/E/F/H/I", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m80", stage: "round_32", homeTeam: "1º Grupo L", awayTeam: "3º Grupo E/H/I/J/K", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m81", stage: "round_32", homeTeam: "1º Grupo D", awayTeam: "3º Grupo B/E/F/I/J", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m82", stage: "round_32", homeTeam: "1º Grupo G", awayTeam: "3º Grupo A/E/H/I/J", matchDate: "2026-06-30T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m83", stage: "round_32", homeTeam: "2º Grupo K", awayTeam: "2º Grupo L", matchDate: "2026-07-02T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m84", stage: "round_32", homeTeam: "1º Grupo H", awayTeam: "2º Grupo J", matchDate: "2026-07-02T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m85", stage: "round_32", homeTeam: "1º Grupo B", awayTeam: "3º Grupo E/F/G/I/J", matchDate: "2026-07-02T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m86", stage: "round_32", homeTeam: "1º Grupo J", awayTeam: "2º Grupo H", matchDate: "2026-07-03T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m87", stage: "round_32", homeTeam: "1º Grupo K", awayTeam: "3º Grupo D/E/I/J/L", matchDate: "2026-07-03T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m88", stage: "round_32", homeTeam: "2º Grupo D", awayTeam: "2º Grupo G", matchDate: "2026-07-03T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m89", stage: "round_16", homeTeam: "Ganador Partido 74", awayTeam: "Ganador Partido 77", matchDate: "2026-07-03T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m90", stage: "round_16", homeTeam: "Ganador Partido 73", awayTeam: "Ganador Partido 75", matchDate: "2026-07-03T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m91", stage: "round_16", homeTeam: "Ganador Partido 76", awayTeam: "Ganador Partido 78", matchDate: "2026-07-05T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m92", stage: "round_16", homeTeam: "Ganador Partido 79", awayTeam: "Ganador Partido 80", matchDate: "2026-07-05T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m93", stage: "round_16", homeTeam: "Ganador Partido 83", awayTeam: "Ganador Partido 84", matchDate: "2026-07-06T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m94", stage: "round_16", homeTeam: "Ganador Partido 81", awayTeam: "Ganador Partido 82", matchDate: "2026-07-06T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m95", stage: "round_16", homeTeam: "Ganador Partido 86", awayTeam: "Ganador Partido 88", matchDate: "2026-07-07T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m96", stage: "round_16", homeTeam: "Ganador Partido 85", awayTeam: "Ganador Partido 87", matchDate: "2026-07-07T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m97", stage: "quarter_finals", homeTeam: "Ganador Partido 89", awayTeam: "Ganador Partido 90", matchDate: "2026-07-09T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m98", stage: "quarter_finals", homeTeam: "Ganador Partido 93", awayTeam: "Ganador Partido 94", matchDate: "2026-07-10T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m99", stage: "quarter_finals", homeTeam: "Ganador Partido 91", awayTeam: "Ganador Partido 92", matchDate: "2026-07-10T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m100", stage: "quarter_finals", homeTeam: "Ganador Partido 95", awayTeam: "Ganador Partido 96", matchDate: "2026-07-10T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m101", stage: "semi_finals", homeTeam: "Ganador Partido 97", awayTeam: "Ganador Partido 98", matchDate: "2026-07-14T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m102", stage: "semi_finals", homeTeam: "Ganador Partido 99", awayTeam: "Ganador Partido 100", matchDate: "2026-07-14T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m103", stage: "third_place", homeTeam: "Perdedor Partido 101", awayTeam: "Perdedor Partido 102", matchDate: "2026-07-14T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });
MOCK_MATCHES.push({ id: "m104", stage: "final", homeTeam: "Ganador Partido 101", awayTeam: "Ganador Partido 102", matchDate: "2026-07-19T15:00:00-04:00", homeFlag: "un", awayFlag: "un", status: "pending", tbd: true });

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
