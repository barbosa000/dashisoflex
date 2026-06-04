
CREATE TABLE public.daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  venda_loja NUMERIC(12,2) NOT NULL DEFAULT 0,
  faturado_loja NUMERIC(12,2) NOT NULL DEFAULT 0,
  mercado_livre NUMERIC(12,2) NOT NULL DEFAULT 0,
  full_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sale_date)
);

CREATE TABLE public.monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  meta_loja NUMERIC(12,2) NOT NULL DEFAULT 0,
  meta_mercado_livre NUMERIC(12,2) NOT NULL DEFAULT 0,
  dias_uteis INT NOT NULL DEFAULT 22,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sales TO authenticated;
GRANT ALL ON public.daily_sales TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_goals TO authenticated;
GRANT ALL ON public.monthly_goals TO service_role;

ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sales" ON public.daily_sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals" ON public.monthly_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_daily_sales_updated BEFORE UPDATE ON public.daily_sales FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_monthly_goals_updated BEFORE UPDATE ON public.monthly_goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
