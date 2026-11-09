-- Pró-labore padrão = salário mínimo vigente (2026: R$ 1.621,00, Decreto 12.797/2025).
-- Só muda o DEFAULT para perfis novos; perfis existentes não são tocados.
alter table public.tax_profiles alter column pro_labore_cents set default 162100;
