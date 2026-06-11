-- ============================================================
-- MIGRACIÓN: Creación de tabla 'raffles' para Rifa Solidaria
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.raffles (
  id text PRIMARY KEY,
  creator_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  creator_email text NOT NULL,
  creator_name text NOT NULL,
  title text NOT NULL,
  subtitle text,
  beneficiary text NOT NULL,
  whatsapp_phone text NOT NULL,
  payment_alias text,
  ticket_value numeric NOT NULL DEFAULT 0,
  draw_date date NOT NULL,
  draw_type text NOT NULL DEFAULT 'external',
  draw_method text NOT NULL,
  draw_moment text,
  total_numbers integer NOT NULL DEFAULT 100,
  ticket_type text NOT NULL DEFAULT 'sequential',
  custom_tickets jsonb,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  numbers_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  winning_number text,
  reports_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)

-- 1. Cualquiera puede leer los detalles de las rifas (Público)
CREATE POLICY "Cualquiera puede leer rifas"
  ON public.raffles FOR SELECT
  USING (true);

-- 2. Solo usuarios autenticados pueden crear sus propias rifas
CREATE POLICY "Usuarios autenticados pueden crear rifas"
  ON public.raffles FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- 3. Solo el creador de la rifa puede actualizarla
CREATE POLICY "Creador puede actualizar sus rifas"
  ON public.raffles FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 4. Solo el creador de la rifa puede eliminarla
CREATE POLICY "Creador puede eliminar sus rifas"
  ON public.raffles FOR DELETE
  USING (auth.uid() = creator_id);

-- Habilitar Realtime para las rifas
ALTER PUBLICATION supabase_realtime ADD TABLE public.raffles;
