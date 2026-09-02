-- ============================================================
-- Promofy — CLIENT-RETURNS-01 · admin edita cupom
--
-- cupons NÃO tem policy de UPDATE para admin (migration 3) e `status`
-- / `estabelecimento_id` estão fora do grant do lojista (migration 9).
-- A correção operacional do admin — o pedido v1 §4 / v2 §2.2 — precisa
-- de RPC security definer, o mesmo padrão de aprovar/rejeitar.
--
-- Decisão de produto (melhor regra já explícita no trigger
-- `checar_edicao_cupom`): o admin É o revisor, então a edição NÃO
-- rebaixa para pendente. O trigger isenta `private.is_admin()` e
-- portanto NÃO grava histórico — esta RPC grava `editado_admin` à
-- mão, append-only, sem apagar rejeição/autor/eventos.
--
-- `estabelecimento_id`, `id`, `status`, `categoria_id` (legado
-- congelado) e `moderacao_historico` no patch são CAMPO PROIBIDO:
-- recusa inteira, não ignora em silêncio. Tenant escape vira erro.
-- ============================================================

create or replace function public.admin_editar_cupom(
  p_cupom_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
  v_uid uuid := (select auth.uid());
  v_chave text;
  v_proibidos text[] := array[
    'estabelecimento_id',
    'id',
    'status',
    'categoria_id',
    'moderacao_historico',
    'criado_em'
  ];
  v_permitidos text[] := array[
    'titulo',
    'beneficio',
    'economia',
    'economia_variavel',
    'validade_inicio',
    'validade_fim',
    'ocultar_ate_inicio',
    'prazo_ativacao_horas',
    'regras',
    'taxas',
    'formas_consumo',
    'horarios',
    'imagem',
    'limite_total',
    'limite_por_usuario',
    'categoria_nova_id'
  ];
  v_titulo text;
  v_folha uuid;
  v_nchaves int;
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return jsonb_build_object('ok', false, 'motivo', 'patch_invalido');
  end if;

  select count(*) into v_nchaves from jsonb_object_keys(p_patch);
  if v_nchaves = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'patch_invalido');
  end if;

  for v_chave in select jsonb_object_keys(p_patch)
  loop
    if v_chave = any (v_proibidos) or v_chave <> all (v_permitidos) then
      return jsonb_build_object('ok', false, 'motivo', 'campo_proibido');
    end if;
  end loop;

  select * into v_row
    from public.cupons
   where id = p_cupom_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if p_patch ? 'titulo' then
    v_titulo := nullif(btrim(p_patch ->> 'titulo'), '');
    if v_titulo is null then
      return jsonb_build_object('ok', false, 'motivo', 'titulo_vazio');
    end if;
    v_row.titulo := v_titulo;
  end if;

  if p_patch ? 'beneficio' then
    v_row.beneficio := coalesce(p_patch ->> 'beneficio', '');
  end if;

  if p_patch ? 'economia' then
    v_row.economia := (p_patch ->> 'economia')::numeric;
  end if;

  if p_patch ? 'economia_variavel' then
    v_row.economia_variavel := (p_patch ->> 'economia_variavel')::boolean;
  end if;

  if p_patch ? 'validade_inicio' then
    if nullif(p_patch ->> 'validade_inicio', '') is null then
      v_row.validade_inicio := null;
    else
      v_row.validade_inicio := (p_patch ->> 'validade_inicio')::date;
    end if;
  end if;

  if p_patch ? 'validade_fim' then
    if nullif(p_patch ->> 'validade_fim', '') is null then
      return jsonb_build_object('ok', false, 'motivo', 'validade_vazia');
    end if;
    v_row.validade_fim := (p_patch ->> 'validade_fim')::date;
  end if;

  if p_patch ? 'ocultar_ate_inicio' then
    v_row.ocultar_ate_inicio := (p_patch ->> 'ocultar_ate_inicio')::boolean;
  end if;

  if p_patch ? 'prazo_ativacao_horas' then
    v_row.prazo_ativacao_horas := (p_patch ->> 'prazo_ativacao_horas')::integer;
  end if;

  if p_patch ? 'regras' and jsonb_typeof(p_patch -> 'regras') = 'array' then
    v_row.regras := p_patch -> 'regras';
  end if;

  if p_patch ? 'taxas' and jsonb_typeof(p_patch -> 'taxas') = 'array' then
    v_row.taxas := p_patch -> 'taxas';
  end if;

  if p_patch ? 'formas_consumo' and jsonb_typeof(p_patch -> 'formas_consumo') = 'array' then
    v_row.formas_consumo := p_patch -> 'formas_consumo';
  end if;

  if p_patch ? 'horarios' and jsonb_typeof(p_patch -> 'horarios') = 'object' then
    v_row.horarios := p_patch -> 'horarios';
  end if;

  if p_patch ? 'imagem' then
    v_row.imagem := coalesce(p_patch ->> 'imagem', '');
  end if;

  if p_patch ? 'limite_total' then
    if p_patch ->> 'limite_total' is null or p_patch ->> 'limite_total' = '' then
      v_row.limite_total := null;
    else
      v_row.limite_total := (p_patch ->> 'limite_total')::integer;
    end if;
  end if;

  if p_patch ? 'limite_por_usuario' then
    if p_patch ->> 'limite_por_usuario' is null or p_patch ->> 'limite_por_usuario' = '' then
      v_row.limite_por_usuario := null;
    else
      v_row.limite_por_usuario := (p_patch ->> 'limite_por_usuario')::integer;
    end if;
  end if;

  if p_patch ? 'categoria_nova_id' then
    begin
      v_folha := (p_patch ->> 'categoria_nova_id')::uuid;
    exception when invalid_text_representation then
      return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
    end;
    if not exists (
      select 1
        from public.estabelecimento_categorias_novas j
       where j.estabelecimento_id = v_row.estabelecimento_id
         and j.categoria_id = v_folha
    ) then
      return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
    end if;
    v_row.categoria_nova_id := v_folha;
  end if;

  v_row.moderacao_historico := coalesce(v_row.moderacao_historico, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'em', now(),
         'acao', 'editado_admin',
         'por', v_uid::text
       ));

  update public.cupons
     set titulo = v_row.titulo,
         beneficio = v_row.beneficio,
         economia = v_row.economia,
         economia_variavel = v_row.economia_variavel,
         validade_inicio = v_row.validade_inicio,
         validade_fim = v_row.validade_fim,
         ocultar_ate_inicio = v_row.ocultar_ate_inicio,
         prazo_ativacao_horas = v_row.prazo_ativacao_horas,
         regras = v_row.regras,
         taxas = v_row.taxas,
         formas_consumo = v_row.formas_consumo,
         horarios = v_row.horarios,
         imagem = v_row.imagem,
         limite_total = v_row.limite_total,
         limite_por_usuario = v_row.limite_por_usuario,
         categoria_nova_id = v_row.categoria_nova_id,
         moderacao_historico = v_row.moderacao_historico,
         atualizado_em = now()
   where id = p_cupom_id;

  return jsonb_build_object('ok', true, 'id', p_cupom_id);
end;
$$;

revoke execute on function public.admin_editar_cupom(text, jsonb) from public, anon;
grant execute on function public.admin_editar_cupom(text, jsonb) to authenticated;

comment on function public.admin_editar_cupom(text, jsonb) is
  'CLIENT-RETURNS-01: admin corrige campos permitidos do cupom. Nao muda estabelecimento_id/status/historico (append). Nao rebaixa para pendente — o admin e o revisor.';
