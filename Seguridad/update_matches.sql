-- =========================================================================
-- MIGRACIÓN: Corrección de fechas y horarios de partidos (Fase de Grupos)
-- Ejecutar este bloque SQL en el SQL Editor de Supabase
-- =========================================================================

-- Matchday 1
UPDATE public.matches SET match_date = '2026-06-14T04:00:00+00:00' WHERE id = 'm_Australia_Turquía';
UPDATE public.matches SET match_date = '2026-06-13T19:00:00+00:00' WHERE id = 'm_Catar_Suiza';
UPDATE public.matches SET match_date = '2026-06-13T22:00:00+00:00' WHERE id = 'm_Brasil_Marruecos';
UPDATE public.matches SET match_date = '2026-06-14T01:00:00+00:00' WHERE id = 'm_Haití_Escocia';
UPDATE public.matches SET match_date = '2026-06-17T04:00:00+00:00' WHERE id = 'm_Austria_Jordania';
UPDATE public.matches SET match_date = '2026-06-17T18:00:00+00:00' WHERE id = 'm_Portugal_RDCongo';
UPDATE public.matches SET match_date = '2026-06-18T02:00:00+00:00' WHERE id = 'm_Uzbekistán_Colombia';
UPDATE public.matches SET match_date = '2026-06-17T20:00:00+00:00' WHERE id = 'm_Inglaterra_Croacia';
UPDATE public.matches SET match_date = '2026-06-17T23:00:00+00:00' WHERE id = 'm_Ghana_Panamá';

-- Matchday 2
UPDATE public.matches SET match_date = '2026-06-20T03:00:00+00:00' WHERE id = 'm_Turquía_Paraguay';
UPDATE public.matches SET match_date = '2026-06-20T17:00:00+00:00' WHERE id = 'm_PaísesBajos_Suecia';
UPDATE public.matches SET match_date = '2026-06-20T20:00:00+00:00' WHERE id = 'm_Alemania_CostadeMarfil';
UPDATE public.matches SET match_date = '2026-06-21T00:00:00+00:00' WHERE id = 'm_Ecuador_Curazao';
UPDATE public.matches SET match_date = '2026-06-21T03:00:00+00:00' WHERE id = 'm_Túnez_Japón';
UPDATE public.matches SET match_date = '2026-06-23T01:00:00+00:00' WHERE id = 'm_Francia_Irak';
UPDATE public.matches SET match_date = '2026-06-23T17:00:00+00:00' WHERE id = 'm_Portugal_Uzbekistán';
UPDATE public.matches SET match_date = '2026-06-23T20:00:00+00:00' WHERE id = 'm_Inglaterra_Ghana';
UPDATE public.matches SET match_date = '2026-06-23T23:00:00+00:00' WHERE id = 'm_Panamá_Croacia';

-- Matchday 3
UPDATE public.matches SET match_date = '2026-06-25T01:00:00+00:00' WHERE id = 'm_RepúblicaCheca_México';
UPDATE public.matches SET match_date = '2026-06-25T01:00:00+00:00' WHERE id = 'm_Sudáfrica_RepúblicadeCorea';
UPDATE public.matches SET match_date = '2026-06-24T19:00:00+00:00' WHERE id = 'm_Suiza_Canadá';
UPDATE public.matches SET match_date = '2026-06-25T02:00:00+00:00' WHERE id = 'm_BosniayHerzegovina_Catar';
UPDATE public.matches SET match_date = '2026-06-24T22:00:00+00:00' WHERE id = 'm_Escocia_Brasil';
UPDATE public.matches SET match_date = '2026-06-24T22:00:00+00:00' WHERE id = 'm_Marruecos_Haití';
UPDATE public.matches SET match_date = '2026-06-28T01:00:00+00:00' WHERE id = 'm_Colombia_Portugal';
UPDATE public.matches SET match_date = '2026-06-27T23:30:00+00:00' WHERE id = 'm_RDCongo_Uzbekistán';
UPDATE public.matches SET match_date = '2026-06-27T21:00:00+00:00' WHERE id = 'm_Panamá_Inglaterra';
UPDATE public.matches SET match_date = '2026-06-27T21:00:00+00:00' WHERE id = 'm_Croacia_Ghana';
UPDATE public.matches SET match_date = '2026-06-28T02:00:00+00:00' WHERE id = 'm_Argelia_Austria';
UPDATE public.matches SET match_date = '2026-06-28T02:00:00+00:00' WHERE id = 'm_Jordania_Argentina';

-- Corrección del partido España vs Arabia Saudí (Estaba invertido 0-4 en lugar de 4-0)
UPDATE public.matches SET home_goals = '4', away_goals = '0' WHERE id = 'm_España_ArabiaSaudí';

-- Recalcular puntajes tras corregir el resultado
SELECT public.calculate_scores();
