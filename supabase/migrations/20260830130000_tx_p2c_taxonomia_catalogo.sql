-- ============================================================
-- Promofy — TX-P2C · Catálogo canônico 14×75 em STAGING local
--
-- Carrega DADO dentro do schema staging que a TX-P2B criou
-- (20260830120000_tx_p2b_taxonomia_schema_staging.sql). Continua
-- STAGING, não cutover:
--   · não altera public.categorias legado — segue sendo a AUTORIDADE
--     do runtime;
--   · não altera catalogo_filtros / catalogo_categorias /
--     categoria_para_filtro (migration 20260829120000, hospedada e
--     imutável) — as três continuam lendo o legado;
--   · não toca cupons.categoria_id, estabelecimentos.categoria_id nem
--     estabelecimento_categorias.categoria_id;
--   · não faz backfill de nada.
--
-- Fonte: docs/taxonomia/Promofy_Anotacoes_Devs.pdf §5.1 (Segmento e Categoria)
-- 14 segmentos / 75 categorias folha. "Outros" não existe na fonte e
-- não foi inventado aqui.
--
-- UUIDs são EXPLÍCITOS e ESTÁVEIS — a fonte da verdade é
-- docs/taxonomia/catalogo-v1.json (versão 1), gerado uma única vez.
-- Não usar gen_random_uuid() aqui: local, QA e produção têm de
-- carregar a MESMA identidade técnica para o mesmo slug, ou o de-para
-- de estabelecimentos/cupons planejado para o cutover (TX-P2D) quebra
-- silenciosamente. Reproduzir localmente = rodar esta migration, nunca
-- regenerar os IDs.
--
-- Todas as folhas com icon_override/tema_override NULL: a fonte não
-- define override, então herdam do segmento (contrato da TX-P2B).
--
-- Sem ON CONFLICT: um catálogo parcialmente aplicado (ex.: um
-- db:reset interrompido no meio) tem de barulhar, não seguir como se
-- nada tivesse acontecido — silêncio aqui seria pior que a migration
-- falhar e o operador perceber.
-- ============================================================

insert into public.segmentos
  (id, slug, nome, icon, tema, ordem, ativo)
values
  ('406c31ec-182a-4e06-bf54-89abce35f133', 'alimentacao', 'Alimentação', 'UtensilsCrossed', 'laranja', 1, true),
  ('2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'fitness', 'Fitness e Saúde', 'Dumbbell', 'verde', 2, true),
  ('c8ce0334-0ea8-41ff-bcee-fcb32239c379', 'automotivo', 'Automotivo', 'Car', 'grafite', 3, true),
  ('7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'beleza', 'Beleza e Bem Estar', 'Scissors', 'rosa', 4, true),
  ('cc65d3a3-a4f2-4993-b1d4-30a18401a4cc', 'entretenimento', 'Entretenimento', 'Clapperboard', 'roxo', 5, true),
  ('984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'turismo-hotelaria', 'Turismo e Hotelaria', 'Plane', 'ciano', 6, true),
  ('df938169-d414-4e7f-945e-b1c1bc73cc33', 'moda', 'Moda', 'Shirt', 'violeta', 7, true),
  ('31a816b1-acf4-48b0-b79d-ceba81873d4e', 'eletronicos', 'Eletrônicos', 'Smartphone', 'azul', 8, true),
  ('c90f05b8-c112-456e-a3f1-a33b7c460373', 'educacao', 'Educação', 'GraduationCap', 'indigo', 9, true),
  ('a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'pet', 'Pet', 'PawPrint', 'ambar', 10, true),
  ('b0cd77f4-8158-41b4-8c1f-7fcf62f14adb', 'servicos', 'Serviços', 'Wrench', 'cinza', 11, true),
  ('a5efd568-3934-4f12-8b03-a08a8019b245', 'saude', 'Saúde', 'Stethoscope', 'vermelho', 12, true),
  ('9a256cd1-4419-436d-8d63-6fc6dc5829dc', 'casa-decoracao', 'Casa e Decoração', 'Sofa', 'terra', 13, true),
  ('bec1d450-c6e6-4b90-9e5d-c76e0f7d13bc', 'infantil-maternidade', 'Infantil e Maternidade', 'Baby', 'amarelo', 14, true);

insert into public.categorias_novas
  (id, segmento_id, slug, nome, icon_override, tema_override, ordem, ativo)
values
  ('07fd0832-1987-4645-a5f9-7815a94eb378', '406c31ec-182a-4e06-bf54-89abce35f133', 'restaurante', 'Restaurante', null, null, 1, true),  -- alimentacao
  ('2677d35c-b604-4f58-be4c-6877c573c648', '406c31ec-182a-4e06-bf54-89abce35f133', 'bar-petiscaria', 'Bar e Petiscaria', null, null, 2, true),  -- alimentacao
  ('b8d0a98f-90a1-48e6-bcf4-e85141468b8c', '406c31ec-182a-4e06-bf54-89abce35f133', 'hamburgueria-lanchonete', 'Hamburgueria/Lanchonete', null, null, 3, true),  -- alimentacao
  ('acfb22ac-3dba-44f1-93d1-0dd0b7a05b7c', '406c31ec-182a-4e06-bf54-89abce35f133', 'cafeteria', 'Cafeteria', null, null, 4, true),  -- alimentacao
  ('1aa12224-d0ee-408e-9b6f-52a542a4f13e', '406c31ec-182a-4e06-bf54-89abce35f133', 'padaria', 'Padaria', null, null, 5, true),  -- alimentacao
  ('d046bef8-0b6d-4236-8c5b-7b1f3b9b9e47', '406c31ec-182a-4e06-bf54-89abce35f133', 'confeitaria', 'Confeitaria', null, null, 6, true),  -- alimentacao
  ('af3aa2b7-8f63-4c00-8b5f-0edaa16a702b', '406c31ec-182a-4e06-bf54-89abce35f133', 'pizzaria', 'Pizzaria', null, null, 7, true),  -- alimentacao
  ('c9943597-135f-4628-8158-b9561327e856', '406c31ec-182a-4e06-bf54-89abce35f133', 'sorveteria', 'Sorveteria', null, null, 8, true),  -- alimentacao
  ('e1f0f2c8-d98a-4df0-8759-d577ee3f3338', '406c31ec-182a-4e06-bf54-89abce35f133', 'acai', 'Açaí', null, null, 9, true),  -- alimentacao
  ('a6c8478d-c2ed-4d55-9e43-1de95f83e08c', '406c31ec-182a-4e06-bf54-89abce35f133', 'espetinho', 'Espetinho', null, null, 10, true),  -- alimentacao
  ('77e90339-6903-4f0e-a880-9fc949f25e1a', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'academia', 'Academia', null, null, 1, true),  -- fitness
  ('db7dc060-f18b-4351-8613-106f0bc17c18', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'alimentacao-fitness', 'Alimentação Fitness', null, null, 2, true),  -- fitness
  ('72c8be9e-3386-491d-843c-abfd731d49dd', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'suplementos', 'Suplementos', null, null, 3, true),  -- fitness
  ('ada74a26-03ff-4520-97be-feed5eab73ab', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'produtos-naturais', 'Produtos Naturais', null, null, 4, true),  -- fitness
  ('30697c44-af83-45b2-989b-dfbf55940bd6', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'personal-trainer', 'Personal Trainer', null, null, 5, true),  -- fitness
  ('ace554d7-0091-4e3e-b1b3-238abca9c334', '2cbb2b1e-ab64-45ce-94ab-544f30cceffc', 'esportes', 'Esportes', null, null, 6, true),  -- fitness
  ('4dceebf4-1152-45e8-b863-2b095917818a', 'c8ce0334-0ea8-41ff-bcee-fcb32239c379', 'autopecas', 'Autopeças', null, null, 1, true),  -- automotivo
  ('bc85a6b2-9e4a-477f-95b4-0aac76ad2f7b', 'c8ce0334-0ea8-41ff-bcee-fcb32239c379', 'manutencao', 'Manutenção', null, null, 2, true),  -- automotivo
  ('7bc83b64-e843-470a-a556-eae75be52188', 'c8ce0334-0ea8-41ff-bcee-fcb32239c379', 'estetica-automotiva', 'Estética Automotiva', null, null, 3, true),  -- automotivo
  ('5d6ead34-eba8-49ee-9262-4d15e2df2140', 'c8ce0334-0ea8-41ff-bcee-fcb32239c379', 'servicos-guincho', 'Serviços de Guincho', null, null, 4, true),  -- automotivo
  ('600a46ea-8d8f-4a24-8864-5c8bf329feed', '7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'salao-de-beleza', 'Salão de Beleza', null, null, 1, true),  -- beleza
  ('e20779fe-5dca-4415-90bd-32492eaa9b45', '7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'barbearia', 'Barbearia', null, null, 2, true),  -- beleza
  ('dd2af35d-62ce-45de-8fa1-b2073ef9215b', '7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'clinica-estetica', 'Clínica de Estética', null, null, 3, true),  -- beleza
  ('391180b1-2296-4e78-b092-de58e45ba46a', '7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'spa', 'Spa', null, null, 4, true),  -- beleza
  ('af4c9d7e-05d1-4c8b-9ff3-5a2497bbe128', '7efccd51-937d-4ec3-b254-cf0aaed3f36f', 'perfumaria-cosmeticos', 'Perfumaria e Cosméticos', null, null, 5, true),  -- beleza
  ('0c5d4ffd-acbd-4dd1-a5f7-e29ad05a6d0e', 'cc65d3a3-a4f2-4993-b1d4-30a18401a4cc', 'cinema', 'Cinema', null, null, 1, true),  -- entretenimento
  ('1933cc91-e29d-42c8-94a6-62385502f2e2', 'cc65d3a3-a4f2-4993-b1d4-30a18401a4cc', 'casas-shows-eventos', 'Casas de Shows e Eventos', null, null, 2, true),  -- entretenimento
  ('bb14b6e0-79e2-4f7e-9661-0935272b7dd3', 'cc65d3a3-a4f2-4993-b1d4-30a18401a4cc', 'parques-atracoes', 'Parques/Atrações', null, null, 3, true),  -- entretenimento
  ('26df6b16-bb95-46a6-8b9d-52c7d8a5f2e0', 'cc65d3a3-a4f2-4993-b1d4-30a18401a4cc', 'jogos-diversoes', 'Jogos e Diversões', null, null, 4, true),  -- entretenimento
  ('c01c4e14-697e-4a75-8586-97993205a88b', '984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'hotel', 'Hotel', null, null, 1, true),  -- turismo-hotelaria
  ('c376309b-cd31-4fd2-93f0-c1f2aa52cfb2', '984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'pousada', 'Pousada', null, null, 2, true),  -- turismo-hotelaria
  ('dde28e4c-151c-4a52-b4a2-0afad7adc97c', '984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'agencia-turismo', 'Agência de Turismo', null, null, 3, true),  -- turismo-hotelaria
  ('e6f1c5d5-6569-4a58-9432-37d2e7f251d8', '984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'passeios-excursoes', 'Passeios e Excursões', null, null, 4, true),  -- turismo-hotelaria
  ('2a0b81ba-a61f-45b1-b462-d5b106cc8770', '984ecc3d-ce9a-46d5-9751-31ac73f569fc', 'locais-eventos', 'Locais para Eventos', null, null, 5, true),  -- turismo-hotelaria
  ('41f09f68-900c-44ba-bef5-88dc3758d73e', 'df938169-d414-4e7f-945e-b1c1bc73cc33', 'roupas-femininas', 'Roupas Femininas', null, null, 1, true),  -- moda
  ('168e9ce7-17df-47d2-b329-9a398ccee1f0', 'df938169-d414-4e7f-945e-b1c1bc73cc33', 'roupas-masculinas', 'Roupas Masculinas', null, null, 2, true),  -- moda
  ('ac59b1fb-e120-4aec-bb5a-50e8b83ef131', 'df938169-d414-4e7f-945e-b1c1bc73cc33', 'calcados-masculinos', 'Calçados Masculinos', null, null, 3, true),  -- moda
  ('4dac008b-5b12-4d7d-8d32-566b1ae28b21', 'df938169-d414-4e7f-945e-b1c1bc73cc33', 'calcados-femininos', 'Calçados Femininos', null, null, 4, true),  -- moda
  ('bf01084b-0ec6-4e9b-ada5-036f3932964e', 'df938169-d414-4e7f-945e-b1c1bc73cc33', 'moda-infantil', 'Moda Infantil', null, null, 5, true),  -- moda
  ('f47d139d-176c-462b-a17a-f998172badbe', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'celulares-acessorios', 'Celulares e Acessórios', null, null, 1, true),  -- eletronicos
  ('d0ffafbb-b7d6-40e0-81af-59c229217045', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'eletroeletronicos', 'Eletroeletrônicos', null, null, 2, true),  -- eletronicos
  ('aa160aa6-ebe7-44e7-98fb-6fc9b95d8b50', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'computadores-notebooks', 'Computadores e Notebooks', null, null, 3, true),  -- eletronicos
  ('43048eac-9129-42e3-898e-799441136c20', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'assistencia-tecnica', 'Assistência Técnica', null, null, 4, true),  -- eletronicos
  ('e244c379-9dda-4075-a8bc-84f68ff67574', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'jogos-consoles', 'Jogos e Consoles', null, null, 5, true),  -- eletronicos
  ('72a596ad-f780-4531-9dfc-df47f3a1a1b4', '31a816b1-acf4-48b0-b79d-ceba81873d4e', 'servicos-ti', 'Serviços de TI', null, null, 6, true),  -- eletronicos
  ('6efe677a-106d-4a41-8747-56eb630fe846', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'infantil', 'Infantil', null, null, 1, true),  -- educacao
  ('6e534645-4eaa-43ce-a920-7a790c50ae79', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'idiomas', 'Idiomas', null, null, 2, true),  -- educacao
  ('b3c87dfc-4f33-417c-bea2-a55da396635f', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'brinquedoteca', 'Brinquedoteca', null, null, 3, true),  -- educacao
  ('f4880f5c-e619-4879-b370-d202f37d4e6a', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'livraria', 'Livraria', null, null, 4, true),  -- educacao
  ('7b195441-1e05-407f-865b-90a308d7785b', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'esportes', 'Esportes', null, null, 5, true),  -- educacao
  ('aab94c17-3b8a-41c2-a442-7efa159dcb6f', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'cursos-profissionalizantes', 'Cursos Profissionalizantes', null, null, 6, true),  -- educacao
  ('cee52f40-89a0-4717-8b01-d5fef1202f3b', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'reforco-escolar', 'Reforço Escolar', null, null, 7, true),  -- educacao
  ('d73483cf-62a8-4f70-84fb-b23d8263c417', 'c90f05b8-c112-456e-a3f1-a33b7c460373', 'papelaria', 'Papelaria', null, null, 8, true),  -- educacao
  ('de832ede-429a-40e5-9ac3-26620677ff00', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'petshop', 'Petshop', null, null, 1, true),  -- pet
  ('08f0ba43-c86c-4281-8603-9473947afd28', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'banho-tosa', 'Banho e Tosa', null, null, 2, true),  -- pet
  ('869127c8-1814-4923-a2a9-63af8767f9f7', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'racao-acessorios', 'Ração e Acessórios', null, null, 3, true),  -- pet
  ('cab16f1f-ecd0-4bd2-9539-b1e734e41e7a', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'clinica-veterinaria', 'Clínica Veterinária', null, null, 4, true),  -- pet
  ('aed625b0-7819-413f-b5a5-1a6848b224c6', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'hotel-animais', 'Hotel para Animais', null, null, 5, true),  -- pet
  ('39bf8fd4-7b58-4172-9e73-29b7850d9687', 'a91b9906-3095-4ccb-ae8b-37d7dcfbdfcb', 'servicos-cuidador', 'Serviços de Cuidador', null, null, 6, true),  -- pet
  ('fbfa6ebc-a6bc-4726-a2c0-5a40bf069048', 'b0cd77f4-8158-41b4-8c1f-7fcf62f14adb', 'lavanderia', 'Lavanderia', null, null, 1, true),  -- servicos
  ('0f82246b-4f8c-46f3-8835-95c531c9513f', 'b0cd77f4-8158-41b4-8c1f-7fcf62f14adb', 'chaveiro', 'Chaveiro', null, null, 2, true),  -- servicos
  ('eaff9738-8995-44b4-ab5f-1ab85236c493', 'b0cd77f4-8158-41b4-8c1f-7fcf62f14adb', 'assistencia-residencial', 'Assistência Residencial', null, null, 3, true),  -- servicos
  ('e88f9f13-c969-472f-89dc-83bf2a203fc2', 'b0cd77f4-8158-41b4-8c1f-7fcf62f14adb', 'motorista-particular', 'Motorista Particular', null, null, 4, true),  -- servicos
  ('d0c49823-1310-4a09-a5c2-b55f2773ea23', 'a5efd568-3934-4f12-8b03-a08a8019b245', 'farmacias', 'Farmácias', null, null, 1, true),  -- saude
  ('2e2cbc12-2020-4e6b-b9bb-c49ea3625b66', 'a5efd568-3934-4f12-8b03-a08a8019b245', 'clinicas-medicas', 'Clínicas Médicas', null, null, 2, true),  -- saude
  ('dc27e88d-8f6a-488c-a391-b2c8badceabe', 'a5efd568-3934-4f12-8b03-a08a8019b245', 'clinicas-odontologicas', 'Clínicas Odontológicas', null, null, 3, true),  -- saude
  ('49a814a5-9894-470f-95de-4d811c184467', 'a5efd568-3934-4f12-8b03-a08a8019b245', 'fisioterapia', 'Fisioterapia', null, null, 4, true),  -- saude
  ('a167e3c1-424a-456e-910a-eb55a0364508', 'a5efd568-3934-4f12-8b03-a08a8019b245', 'terapias-alternativas', 'Terapias Alternativas', null, null, 5, true),  -- saude
  ('a9e9d0a1-be6a-41f6-829f-d41daed5dd7a', '9a256cd1-4419-436d-8d63-6fc6dc5829dc', 'moveis-eletrodomesticos', 'Móveis e Eletrodomésticos', null, null, 1, true),  -- casa-decoracao
  ('aff1e25f-ad2a-4593-9d3b-aa7829e48bf1', '9a256cd1-4419-436d-8d63-6fc6dc5829dc', 'loja-decoracao', 'Loja de Decoração', null, null, 2, true),  -- casa-decoracao
  ('90064962-36f2-43ef-b340-ba74116f15a2', '9a256cd1-4419-436d-8d63-6fc6dc5829dc', 'iluminacao', 'Iluminação', null, null, 3, true),  -- casa-decoracao
  ('95260920-53f5-4c1b-98af-bcf6e87a16d7', '9a256cd1-4419-436d-8d63-6fc6dc5829dc', 'tapecaria', 'Tapeçaria', null, null, 4, true),  -- casa-decoracao
  ('f748cb82-b673-43ad-9382-ca6596d13d1d', 'bec1d450-c6e6-4b90-9e5d-c76e0f7d13bc', 'roupas-infantis', 'Roupas Infantis', null, null, 1, true),  -- infantil-maternidade
  ('d540279a-5208-42c3-995c-2947cc2ae6ae', 'bec1d450-c6e6-4b90-9e5d-c76e0f7d13bc', 'brinquedos-jogos', 'Brinquedos e Jogos', null, null, 2, true),  -- infantil-maternidade
  ('38baa52e-6e23-4ca4-8bbb-7be305a691a1', 'bec1d450-c6e6-4b90-9e5d-c76e0f7d13bc', 'servicos-bebes', 'Serviços para Bebês', null, null, 3, true)  -- infantil-maternidade
;
