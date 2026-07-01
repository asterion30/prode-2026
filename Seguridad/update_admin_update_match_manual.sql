-- Recrear la función admin_update_match_manual para soportar qualified_team
CREATE OR REPLACE FUNCTION public.admin_update_match_manual(
  p_match_id text,
  p_home_goals text,
  p_away_goals text,
  p_status text,
  p_qualified_team text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.matches
  SET home_goals = p_home_goals,
      away_goals = p_away_goals,
      status = p_status,
      qualified_team = p_qualified_team
  WHERE id = p_match_id;

  -- Recalcular puntajes tras la actualización manual
  PERFORM public.calculate_scores();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
