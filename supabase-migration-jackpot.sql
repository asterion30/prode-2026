-- ============================================================
-- MIGRACIÓN: Control de Jackpot diario (Previene evasión con multidispositivo/incógnito)
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- Agregar columna last_jackpot_win a la tabla users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_jackpot_win text DEFAULT NULL;
