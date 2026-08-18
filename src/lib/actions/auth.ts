"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { MENSAGEM_CADASTRO_GENERICA, type EstadoAuth } from "@/lib/auth-estado";

/**
 * Autenticação no SERVIDOR (Fase 8, correção do achado do smoke).
 *
 * POR QUE ISTO EXISTE. Até aqui as cinco telas de entrada eram `<form>` sem
 * `action` e sem `method`, com a submissão inteira no `onSubmit` do React.
 * Antes da hidratação — rede lenta, aparelho fraco, chunk que não chegou — o
 * navegador faz o fallback nativo: **GET para a própria URL com todos os campos
 * na query string**. Medido na preview da Fase 8:
 *
 *     /admin/login?email=admin%40promofy.test&senha=promofy123
 *
 * A senha em query string entra no histórico do navegador, no `Referer` das
 * requisições seguintes e nos logs de acesso da Vercel e de qualquer proxy no
 * caminho. Não exige atacante: vaza sozinho.
 *
 * A correção é `<form action={serverAction}>`. O Next 14 então emite um form
 * com `method="POST"` de verdade — sem JavaScript o login **funciona**, e a
 * credencial vai no CORPO, nunca na URL.
 *
 * Lembrete da casa: em arquivo `"use server"` TODO export precisa ser `async`.
 * Por isso `autenticar` e `mensagemDeErro` ficam sem export, e o estado inicial
 * mora em `src/lib/auth-estado.ts` — exportar um OBJETO daqui atravessa o
 * `next build` calado e derruba a rota na primeira requisição.
 */

/** Mensagens de erro: nunca ecoam o texto cru do GoTrue. */
function mensagemDeErro(bruta: string | undefined): string {
  if (bruta === "Invalid login credentials") return "E-mail ou senha incorretos.";
  return "Não foi possível entrar agora. Tente novamente.";
}

/**
 * Núcleo compartilhado pelos quatro logins.
 *
 * `papelExigido: null` reproduz o comportamento do `/m/login`, que nunca
 * conferiu papel — mudar isso aqui seria carona indevida numa correção de
 * segurança de outro assunto.
 *
 * O `redirect()` do Next sinaliza por exceção, então ele fica FORA de qualquer
 * try/catch: engolido, viraria uma tela de erro em vez de um login bem-sucedido.
 */
async function autenticar(
  formData: FormData,
  papelExigido: "lojista" | "admin" | null,
  destino: string,
  msgPapelErrado: string,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (error || !data.user) return { erro: mensagemDeErro(error?.message) };

  if (papelExigido) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.role !== papelExigido) {
      await supabase.auth.signOut();
      return { erro: msgPapelErrado };
    }
  }

  redirect(destino);
}

export async function entrarConsumidorAction(
  _anterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  return autenticar(formData, null, "/m", "");
}

export async function entrarLojistaAction(
  _anterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  return autenticar(formData, "lojista", "/e", "Esta conta não é de um estabelecimento.");
}

export async function entrarPortalAction(
  _anterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  return autenticar(formData, "lojista", "/portal", "Esta conta não tem acesso a esta área.");
}

export async function entrarAdminAction(
  _anterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  return autenticar(formData, "admin", "/admin", "Esta conta não tem acesso a esta área.");
}

/**
 * Cadastro do consumidor.
 *
 * O aceite dos termos passa a ser conferido AQUI. Antes vivia só no
 * `disabled` do botão, que é decoração: qualquer um removia pelo DevTools.
 * Sem JavaScript o `required` do checkbox nativo barra no navegador; com ou
 * sem ele, esta checagem é a que vale.
 *
 * Papel NUNCA vai em `options.data` — o trigger `handle_new_user` copia os
 * campos para `profiles` e o papel é decidido lá.
 *
 * FASE 9/Z2 — O ORÁCULO DE EXISTÊNCIA DE CONTA.
 *
 * Esta tela respondia "Este e-mail já está cadastrado" a qualquer visitante.
 * É um oráculo aberto, e destoava do resto: a Fase 8 gastou uma migration
 * inteira para que a busca por CPF desse a MESMA resposta aos três "não
 * achei", justamente para não revelar quem é cliente de quem — enquanto um
 * formulário público dizia "esta pessoa usa o Promofy" para quem perguntasse.
 *
 * Esta entrega traz UMA das duas mudanças previstas: a mensagem deixa de
 * distinguir "já existe" de outras falhas. A janela por IP ficou de fora —
 * ver _promofy_handoff/pendentes/: o desenho chaveava a janela por um
 * PARÂMETRO do cliente numa RPC concedida a `anon`, então quem rotacionasse o
 * IP nunca era contado e quem fixasse o IP de uma vítima negava cadastro a
 * todos atrás daquele CGNAT. Decisão pendente.
 *
 * O QUE ISSO **NÃO** RESOLVE, e é importante não fingir que resolve: com
 * `mailer_autoconfirm` ligado (decisão da Fase 3), o cadastro que dá certo
 * cria sessão e REDIRECIONA; o que falha, não. Essa diferença é observável e
 * nenhuma mensagem neutra a apaga. Fechar de verdade exige ligar a confirmação
 * de e-mail — decisão de produto, no backlog.
 */
export async function cadastrarAction(
  _anterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim();
  const celular = String(formData.get("celular") ?? "").trim();
  const nascimento = String(formData.get("nascimento") ?? "");
  const aceito = formData.get("aceito");

  if (!aceito) return { erro: "É preciso aceitar os termos para continuar." };
  if (!email || !senha || !nome) return { erro: "Preencha e-mail, nome e senha." };
  if (senha.length < 6) return { erro: "A senha precisa ter pelo menos 6 caracteres." };

  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      // yyyy-mm-dd do input type=date — validado no trigger.
      data: { nome, cpf, telefone: celular, nascimento },
    },
  });

  if (error) {
    const m = error.message.toLowerCase();
    // "senha curta" continua específico: é erro do próprio formulário, não
    // diz nada sobre terceiros, e esconder isso só atrapalharia quem cadastra.
    if (m.includes("password")) {
      return { erro: "A senha precisa ter pelo menos 6 caracteres." };
    }
    // TUDO O MAIS — inclusive "already registered" — cai na mesma frase. Ela
    // aponta o login sem afirmar que ESTE e-mail existe.
    return { erro: MENSAGEM_CADASTRO_GENERICA };
  }

  // Confirmação de e-mail desligada em produção por decisão da Fase 3
  // (`mailer_autoconfirm: true`, conferido no Passo 0 do deploy da Fase 8):
  // a sessão já existe aqui e o fluxo segue direto para o onboarding.
  redirect("/m/onboarding");
}
