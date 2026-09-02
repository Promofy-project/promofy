"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { salvarPerfilEstabAction } from "@/lib/actions/estab";
import { CampoImagem } from "@/components/campo-imagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EstabelecimentoForm({
  id,
  nomeInicial,
  cidadeInicial,
  logoInicial,
}: {
  id: string;
  nomeInicial: string;
  cidadeInicial: string;
  logoInicial: string;
}) {
  const router = useRouter();
  const [nome, setNome] = React.useState(nomeInicial);
  const [cidade, setCidade] = React.useState(cidadeInicial);
  const [logo, setLogo] = React.useState<string | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    const r = await salvarPerfilEstabAction({
      nome,
      cidade,
      ...(logo !== undefined ? { logo } : {}),
    });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="est-nome" className="text-sm font-semibold">
          Nome
        </label>
        <Input
          id="est-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="est-cidade" className="text-sm font-semibold">
          Cidade
        </label>
        <Input
          id="est-cidade"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
        />
      </div>
      <CampoImagem
        rotulo="Logo"
        valorAtual={logoInicial}
        estabelecimentoId={id}
        onChange={setLogo}
      />
      {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
      {ok && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <Check className="h-4 w-4" /> Alterações salvas.
        </p>
      )}
      <Button type="submit" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar cadastro"}
      </Button>
    </form>
  );
}
