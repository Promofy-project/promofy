import { buscarAvisosAdmin } from "@/lib/data/avisos";
import { buscarEstabelecimentosAdmin } from "@/lib/data/admin";
import { AvisosClient } from "./avisos-client";

export const dynamic = "force-dynamic";

/**
 * Quadro de avisos (Fase 8/M1).
 *
 * Até aqui esta tela era 100% mock: dois literais em `useState`, "Enviar
 * aviso" só fazia `setAvisos(...)`, e recarregar a página zerava tudo. Os
 * destinos eram CATEGORIAS (`todos | CategoriaId`), o que nunca teve
 * contraparte no banco — o mural entrega por ESTABELECIMENTO, que é quem tem
 * dono, sessão e caixa de entrada.
 */
export default async function AdminAvisos() {
  const [avisos, estabelecimentos] = await Promise.all([
    buscarAvisosAdmin(),
    buscarEstabelecimentosAdmin(),
  ]);

  return (
    <AvisosClient
      avisos={avisos}
      estabelecimentos={estabelecimentos.map((e) => ({ id: e.id, nome: e.nome }))}
    />
  );
}
