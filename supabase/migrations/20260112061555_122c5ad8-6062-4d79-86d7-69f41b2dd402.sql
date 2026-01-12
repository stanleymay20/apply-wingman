-- Fix security warnings by setting search_path on functions

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.get_today_application_count(UUID) SET search_path = public;
ALTER FUNCTION public.update_daily_stats() SET search_path = public;