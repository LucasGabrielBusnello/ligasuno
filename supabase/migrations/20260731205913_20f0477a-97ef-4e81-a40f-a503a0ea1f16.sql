
-- Diretores podem atualizar dados da atlética (config, história, imagens)
DROP POLICY IF EXISTS athletics_director_update ON public.athletics;
CREATE POLICY athletics_director_update ON public.athletics
  FOR UPDATE TO authenticated
  USING (public.is_athletic_director(auth.uid(), id))
  WITH CHECK (public.is_athletic_director(auth.uid(), id));

-- Diretores podem ver e excluir pagamentos de associação
DROP POLICY IF EXISTS athletic_memb_pay_director_read ON public.athletic_membership_payments;
CREATE POLICY athletic_memb_pay_director_read ON public.athletic_membership_payments
  FOR SELECT TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id));

DROP POLICY IF EXISTS athletic_memb_pay_director_delete ON public.athletic_membership_payments;
CREATE POLICY athletic_memb_pay_director_delete ON public.athletic_membership_payments
  FOR DELETE TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id));

-- Diretores podem gerenciar pedidos de produtos
DROP POLICY IF EXISTS athletic_orders_director_all ON public.athletic_product_orders;
CREATE POLICY athletic_orders_director_all ON public.athletic_product_orders
  FOR ALL TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));
