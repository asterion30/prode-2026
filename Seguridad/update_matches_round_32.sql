-- =========================================================================
-- MIGRACIÓN: Corrección de Equipos y Horarios de 16vos de Final (Round of 32)
-- e Normalización del nombre de "Irán" a "RI de Irán" para el cálculo de grupos
-- Ejecutar este bloque SQL en el SQL Editor de Supabase
-- =========================================================================

-- 1. Normalización de nombre de Irán
UPDATE public.matches SET home_team = 'RI de Irán' WHERE home_team = 'Irán';
UPDATE public.matches SET away_team = 'RI de Irán' WHERE away_team = 'Irán';

-- 2. Resultados de partidos jugados que estaban pendientes
UPDATE public.matches SET home_goals = '1', away_goals = '2', status = 'finished' WHERE id = 'm_Jordania_Argelia';
UPDATE public.matches SET home_goals = '1', away_goals = '0', status = 'finished' WHERE id = 'm_Colombia_RDCongo';

-- 3. Recálculo de puntajes en la base de datos
SELECT public.calculate_scores();

-- 4. Actualización de partidos de 16vos de Final (Horarios Oficiales UTC y Equipos clasificados)

-- Match 73: Sudáfrica vs Canadá (2ºA vs 2ºB)
UPDATE public.matches 
SET home_team = 'Sudáfrica', away_team = 'Canadá', home_flag = 'za', away_flag = 'ca', match_date = '2026-06-28T19:00:00+00:00', tbd = false 
WHERE id = 'm73';

-- Match 74: Alemania vs 3º Grupo A/B/C/D/F (1ºE vs 3º A/B/C/D/F)
UPDATE public.matches 
SET home_team = 'Alemania', home_flag = 'de', match_date = '2026-06-29T20:30:00+00:00' 
WHERE id = 'm74';

-- Match 75: Países Bajos vs Marruecos (1ºF vs 2ºC)
UPDATE public.matches 
SET home_team = 'Países Bajos', away_team = 'Marruecos', home_flag = 'nl', away_flag = 'ma', match_date = '2026-06-30T01:00:00+00:00', tbd = false 
WHERE id = 'm75';

-- Match 76: Brasil vs Japón (1ºC vs 2ºF)
UPDATE public.matches 
SET home_team = 'Brasil', away_team = 'Japón', home_flag = 'br', away_flag = 'jp', match_date = '2026-06-29T17:00:00+00:00', tbd = false 
WHERE id = 'm76';

-- Match 77: 1º Grupo I vs 3º Grupo C/D/F/G/H
UPDATE public.matches 
SET match_date = '2026-06-30T21:00:00+00:00' 
WHERE id = 'm77';

-- Match 78: Costa de Marfil vs 2º Grupo I (2ºE vs 2ºI)
UPDATE public.matches 
SET home_team = 'Costa de Marfil', home_flag = 'ci', match_date = '2026-06-30T17:00:00+00:00' 
WHERE id = 'm78';

-- Match 79: México vs 3º Grupo C/E/F/H/I (1ºA vs 3º C/E/F/H/I)
UPDATE public.matches 
SET home_team = 'México', home_flag = 'mx', match_date = '2026-07-01T01:00:00+00:00' 
WHERE id = 'm79';

-- Match 80: 1º Grupo L vs 3º Grupo E/H/I/J/K
UPDATE public.matches 
SET match_date = '2026-07-01T16:00:00+00:00' 
WHERE id = 'm80';

-- Match 81: 1º Grupo D vs 3º Grupo B/E/F/I/J
UPDATE public.matches 
SET match_date = '2026-07-02T00:00:00+00:00' 
WHERE id = 'm81';

-- Match 82: 1º Grupo G vs 3º Grupo A/E/H/I/J
UPDATE public.matches 
SET match_date = '2026-07-01T20:00:00+00:00' 
WHERE id = 'm82';

-- Match 83: 2º Grupo K vs 2º Grupo L
UPDATE public.matches 
SET match_date = '2026-07-02T23:00:00+00:00' 
WHERE id = 'm83';

-- Match 84: 1º Grupo H vs 2º Grupo J
UPDATE public.matches 
SET match_date = '2026-07-02T19:00:00+00:00' 
WHERE id = 'm84';

-- Match 85: Suiza vs 3º Grupo E/F/G/I/J (1ºB vs 3º E/F/G/I/J)
UPDATE public.matches 
SET home_team = 'Suiza', home_flag = 'ch', match_date = '2026-07-03T03:00:00+00:00' 
WHERE id = 'm85';

-- Match 86: Argentina vs 2º Grupo H (1ºJ vs 2ºH)
UPDATE public.matches 
SET home_team = 'Argentina', home_flag = 'ar', match_date = '2026-07-03T22:00:00+00:00' 
WHERE id = 'm86';

-- Match 87: 1º Grupo K vs 3º Grupo D/E/I/J/L
UPDATE public.matches 
SET match_date = '2026-07-04T01:30:00+00:00' 
WHERE id = 'm87';

-- Match 88: 2º Grupo D vs 2º Grupo G
UPDATE public.matches 
SET match_date = '2026-07-03T18:00:00+00:00' 
WHERE id = 'm88';
