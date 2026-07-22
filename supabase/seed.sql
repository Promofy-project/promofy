-- ============================================================
-- Promofy — Fase 1 · Seed (roda em todo `supabase db reset`)
--
-- Dados transcritos de src/lib/mock-data.ts e
-- src/components/portal/cupons-seed.ts. IDs preservados ('e1',
-- 'c01', slugs) — /m/cupom/[id] continua lendo o mock nesta fase.
--
-- Usuários de teste NÃO nascem aqui: auth.users é criado por
-- scripts/seed-users.ts (admin API + service_role), que também
-- liga estabelecimentos.e1.owner_id ao lojista. O npm script
-- `db:reset` encadeia os dois passos.
-- ============================================================

-- CATEGORIAS (6) ---------------------------------------------
insert into public.categorias (id, label, icon, gradiente, ordem) values
  ('alimentacao', 'Alimentação', 'UtensilsCrossed', 'linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)', 1),
  ('fitness',     'Fitness',     'Dumbbell',        'linear-gradient(135deg, #22C55E 0%, #0EA5A4 100%)', 2),
  ('beleza',      'Beleza',      'Scissors',        'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)', 3),
  ('eletronicos', 'Eletrônicos', 'Smartphone',      'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)', 4),
  ('educacao',    'Educação',    'GraduationCap',   'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', 5),
  ('pet',         'Pet',         'PawPrint',        'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)', 6);

-- ESTABELECIMENTOS (6) — owner_id null até o seed de usuários --
insert into public.estabelecimentos
  (id, nome, categoria_id, cidade, status, rating, rating_count) values
  ('e1', 'Sabor & Cia',          'alimentacao', 'São Paulo, SP',   'ativo',    4.8, 1240),
  ('e2', 'PowerFit Academia',    'fitness',     'São Paulo, SP',   'ativo',    4.7,  890),
  ('e3', 'Studio Bella',         'beleza',      'Campinas, SP',    'ativo',    4.9,  654),
  ('e4', 'TechMais Eletrônicos', 'eletronicos', 'São Paulo, SP',   'pendente', 4.4, 2130),
  ('e5', 'Saber+ Cursos',        'educacao',    'Remoto / Online', 'ativo',    4.8,  412),
  ('e6', 'Mundo Pet',            'pet',         'Santo André, SP', 'suspenso', 4.7,  738);

-- CATEGORIAS POR ESTABELECIMENTO (Fase 4) ---------------------
-- Junção obrigatória ANTES dos cupons (trigger checa categoria ∈ conjunto).
-- e1 prova o caso multi-categoria do cliente: restaurante fitness.
insert into public.estabelecimento_categorias (estabelecimento_id, categoria_id) values
  ('e1', 'alimentacao'),
  ('e1', 'fitness'),
  ('e2', 'fitness'),
  ('e3', 'beleza'),
  ('e4', 'eletronicos'),
  ('e5', 'educacao'),
  ('e6', 'pet')
on conflict do nothing; -- a migration 12 já faz backfill da principal

-- CUPONS (12 do catálogo + 2 campanhas portal-only do e1) -----
-- ordem = índice do array do mock (home = order by ordem limit 6).
-- rating/avaliacoes = POR CUPOM (protótipo; difere do estabelecimento).
-- limite_total = 1000 nos cupons do e1 (paridade com cupons-seed.ts).
insert into public.cupons
  (id, estabelecimento_id, titulo, categoria_id, beneficio, economia,
   preco_de, preco_por, validade_fim, limite_total, regras, horarios,
   status, destaque, distancia_km, imagem, ordem, rating, avaliacoes) values
  ('c01', 'e1', 'Rodízio de pizza em dobro', 'alimentacao',
   '2 rodízios pelo preço de 1', 45, 89.9, 44.9, current_date + 45, 1000,
   '["Válido para consumo no local, jantar.","Não cumulativo com outras promoções.","Necessário apresentar o cupom no caixa."]'::jsonb,
   '{"descricao":"Ter a Dom, 18h às 23h","dias":["Ter","Qua","Qui","Sex","Sáb","Dom"],"inicio":"18:00","fim":"23:00"}'::jsonb,
   'ativo', true, 1.2, '/img/cupons/c01.jpg', 1, 4.8, 1240),
  ('c02', 'e1', '20% off no almoço executivo', 'alimentacao',
   'Prato + bebida + sobremesa', 18, null, null, current_date + 30, 1000,
   '["Válido de segunda a sexta.","Limite de 1 cupom por pessoa."]'::jsonb,
   '{"descricao":"Seg a Sex, 11h às 15h","dias":["Seg","Ter","Qua","Qui","Sex"],"inicio":"11:00","fim":"15:00"}'::jsonb,
   'ativo', false, 2.4, '/img/cupons/c02.jpg', 2, 4.5, 1240),
  ('c03', 'e2', '1 mês grátis na matrícula', 'fitness',
   'Plano anual com 1 mês cortesia', 99, 199, 99, current_date + 60, null,
   '["Válido para novos alunos.","Fidelidade mínima de 12 meses.","Avaliação física inclusa."]'::jsonb,
   '{"descricao":"Seg a Sáb, 6h às 22h","dias":["Seg","Ter","Qua","Qui","Sex","Sáb"],"inicio":"06:00","fim":"22:00"}'::jsonb,
   'ativo', true, 0.8, '/img/cupons/c03.jpg', 3, 4.7, 890),
  ('c04', 'e2', 'Aula de spinning 2x1', 'fitness',
   'Traga um amigo sem custo', 30, null, null, current_date + 30, null,
   '["Sujeito à lotação da turma.","Agendamento prévio obrigatório."]'::jsonb,
   '{"descricao":"Seg, Qua e Sex, 19h"}'::jsonb,
   'indisponivel', false, 3.1, '/img/cupons/c04.jpg', 4, 4.3, 890),
  ('c05', 'e3', 'Corte + escova com 40% off', 'beleza',
   'Inclui hidratação expressa', 50, 125, 75, current_date + 40, null,
   '["Mediante agendamento.","Válido de terça a quinta."]'::jsonb,
   '{"descricao":"Ter a Sáb, 9h às 19h","dias":["Ter","Qua","Qui","Sex","Sáb"],"inicio":"09:00","fim":"19:00"}'::jsonb,
   'ativo', true, 1.6, '/img/cupons/c05.jpg', 5, 4.9, 654),
  ('c06', 'e3', 'Dia de noiva com brinde', 'beleza',
   'Pacote completo + acompanhante', 120, null, null, current_date + 75, null,
   '["Reserva com 30 dias de antecedência.","Sinal de 30%."]'::jsonb,
   '{"descricao":"Sob agendamento"}'::jsonb,
   'ativo', false, 4.2, '/img/cupons/c06.jpg', 6, 4.6, 654),
  ('c07', 'e4', 'Fone bluetooth com 35% off', 'eletronicos',
   'Modelos selecionados', 140, 399, 259, current_date + 35, null,
   '["Enquanto durarem os estoques.","Garantia de 12 meses."]'::jsonb,
   '{"descricao":"Seg a Sáb, 10h às 22h"}'::jsonb,
   'ativo', false, 2.0, '/img/cupons/c07.jpg', 7, 4.4, 2130),
  ('c08', 'e4', 'Película + capa grátis na compra', 'eletronicos',
   'Na compra de qualquer smartphone', 60, null, null, current_date + 30, null,
   '["Instalação inclusa.","1 brinde por aparelho."]'::jsonb,
   '{"descricao":"Seg a Sáb, 10h às 22h"}'::jsonb,
   'indisponivel', false, 5.0, '/img/cupons/c08.jpg', 8, 4.2, 2130),
  ('c09', 'e5', 'Curso de inglês — 3 meses grátis', 'educacao',
   'Plano semestral com 3 meses extra', 290, 580, 290, current_date + 90, null,
   '["Para novas matrículas.","Material didático à parte."]'::jsonb,
   '{"descricao":"Acesso 24h (online)"}'::jsonb,
   'ativo', true, 1.1, '/img/cupons/c09.jpg', 9, 4.8, 412),
  ('c10', 'e5', 'Mentoria de carreira 50% off', 'educacao',
   'Sessão individual de 1h', 75, 150, 75, current_date + 50, null,
   '["Agendamento conforme disponibilidade.","Online via vídeo."]'::jsonb,
   '{"descricao":"Seg a Sex, 9h às 18h"}'::jsonb,
   'ativo', false, 6.3, '/img/cupons/c10.jpg', 10, 4.5, 412),
  ('c11', 'e6', 'Banho & tosa leve 2x1', 'pet',
   'Para cães de pequeno porte', 40, null, null, current_date + 40, null,
   '["Mediante agendamento.","Válido de segunda a quinta."]'::jsonb,
   '{"descricao":"Seg a Sáb, 8h às 18h"}'::jsonb,
   'ativo', true, 0.9, '/img/cupons/c11.jpg', 11, 4.7, 738),
  ('c12', 'e6', 'Ração premium 25% off', 'pet',
   'Sacos de 15kg selecionados', 55, 220, 165, current_date + 55, null,
   '["Limite de 2 unidades por cliente.","Enquanto durar o estoque."]'::jsonb,
   '{"descricao":"Seg a Sáb, 8h às 18h"}'::jsonb,
   'ativo', false, 3.7, '/img/cupons/c12.jpg', 12, 4.6, 738),
  -- Campanhas anteriores do e1 (só aparecem no portal; a policy pública
  -- e o filtro da home excluem status esgotado/expirado)
  ('p-campanha-esgotada', 'e1', 'Combo casal + 2 sobremesas', 'alimentacao',
   'Para 2 pessoas, no jantar', 60, null, null, current_date + 28, 500,
   '["Válido no jantar, mediante reserva.","Limite de 1 por mesa."]'::jsonb,
   '{"descricao":"Ter a Dom, 18h às 23h"}'::jsonb,
   'esgotado', false, 1.2, '', 100, 4.7, 320),
  ('p-campanha-expirada', 'e1', 'Rodízio com 30% off (almoço)', 'alimentacao',
   'Almoço de segunda a sexta', 28, null, null, current_date - 43, 800,
   '["Válido no almoço, dias úteis."]'::jsonb,
   '{"descricao":"Seg a Sex, 11h às 15h"}'::jsonb,
   'expirado', false, 1.2, '', 101, 4.6, 210);

-- PLANOS (4 — copy do app, planosMobile) ---------------------
insert into public.planos
  (id, nome, preco, periodo, descricao, beneficios, destaque, bloqueado, badge, legenda, ordem) values
  ('basico', 'Plano Básico', 9.9, '/mês', '',
   '["Acesso a todas as ofertas disponíveis na cidade","Possibilidade de resgatar até 5 cupons por mês","Participação no ranking de pontuação para premiações","Notificações personalizadas de ofertas na sua região"]'::jsonb,
   false, false, null, null, 1),
  ('plus', 'Plano Plus', 19.9, '/mês', '',
   '["Acesso a todas as ofertas disponíveis na cidade e regiões próximas","Cupons ilimitados por mês","Participação no ranking de pontuação para premiações","Notificações personalizadas de ofertas na sua região"]'::jsonb,
   true, false, 'Mais popular', null, 2),
  ('familia', 'Plano Família', 29.9, '/mês', '',
   '["Acesso a todas as ofertas para até 4 perfis cadastrados","Cupons ilimitados por mês, compartilhados entre os membros","Participação de todos os membros no ranking de pontuação","Benefícios exclusivos como cupons bônus a cada 3 meses"]'::jsonb,
   false, false, null, null, 3),
  ('vip', 'Plano VIP', 0, '', '',
   '["Acesso antecipado às ofertas mais exclusivas","Cupons ilimitados e sem restrições geográficas (cidades da mesma rede Promofy)","Participação no ranking de pontuação para premiações (com pontuação dobrada)","Convites para eventos e promoções especiais com parceiros"]'::jsonb,
   false, true, 'Em breve',
   'Plano exclusivo — liberado apenas para membros convidados ou por conquista. Saiba mais.', 4);

-- CONFIG_PONTOS (fonte única — espelha PONTOS_POR_ACAO) -------
insert into public.config_pontos (acao, pontos) values
  ('resgate',   50),
  ('nps',       30),
  ('indicacao', 100),
  ('visita',    10);

-- AVALIACOES (6 — legado do mock: usuario_id null + nome exibido;
-- o seed de usuários vincula a 1ª ao consumidor de teste) ------
insert into public.avaliacoes
  (usuario_nome, estabelecimento_id, rating, comentario, criado_em) values
  ('Mariana Alves',   'e1', 5, 'Economizei mais de R$ 200 no primeiro mês. O app é viciante!',                    '2026-06-18'),
  ('Rafael Souza',    'e2', 5, 'Achei a academia perto de casa com 1 mês grátis. Recomendo demais.',              '2026-06-15'),
  ('Camila Ferreira', 'e3', 4, 'Cupons fáceis de usar, só queria mais opções de beleza na minha região.',         '2026-06-12'),
  ('Lucas Pereira',   'e4', 5, 'O resgate é instantâneo, mostrei no caixa e funcionou na hora.',                  '2026-06-09'),
  ('Beatriz Lima',    'e5', 4, 'Plano Plus vale muito a pena pelo cashback. Já se pagou.',                        '2026-06-05'),
  ('Thiago Rocha',    'e6', 5, 'Banho e tosa do meu cachorro saiu pela metade do preço. Top!',                    '2026-06-02');

-- CUPOM_EVENTOS — métricas derivadas (reproduz metricasCupom do
-- mock + campanhas do portal; ~20,5k linhas via generate_series)
insert into public.cupom_eventos (cupom_id, tipo)
select v.cupom_id, v.tipo::public.tipo_evento_cupom
from (values
  ('c01', 'visualizacao', 4820), ('c01', 'clique', 1960), ('c01', 'ativacao', 740), ('c01', 'validacao', 482),
  ('c02', 'visualizacao', 3110), ('c02', 'clique', 1180), ('c02', 'ativacao', 410), ('c02', 'validacao', 233),
  ('p-campanha-esgotada', 'visualizacao', 2640), ('p-campanha-esgotada', 'clique', 980),
  ('p-campanha-esgotada', 'ativacao', 520),      ('p-campanha-esgotada', 'validacao', 500),
  ('p-campanha-expirada', 'visualizacao', 1870), ('p-campanha-expirada', 'clique', 610),
  ('p-campanha-expirada', 'ativacao', 240),      ('p-campanha-expirada', 'validacao', 180)
) as v(cupom_id, tipo, qtd)
cross join lateral generate_series(1, v.qtd);

-- PUBLICADO_EM (Fase 4) — cupons do seed nascem direto no status final
-- (sem passar por aprovar_cupom); mesmo predicado do backfill da
-- migration 14, para local e hosted não divergirem.
update public.cupons
   set publicado_em = criado_em
 where status not in ('pendente', 'rejeitado');
