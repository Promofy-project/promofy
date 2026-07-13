export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          criado_em: string
          fim: string | null
          id: number
          inicio: string
          plano_id: string
          status: Database["public"]["Enums"]["status_assinatura"]
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          fim?: string | null
          id?: never
          inicio?: string
          plano_id: string
          status?: Database["public"]["Enums"]["status_assinatura"]
          usuario_id: string
        }
        Update: {
          criado_em?: string
          fim?: string | null
          id?: never
          inicio?: string
          plano_id?: string
          status?: Database["public"]["Enums"]["status_assinatura"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          comentario: string | null
          criado_em: string
          estabelecimento_id: string
          id: number
          rating: number
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          estabelecimento_id: string
          id?: never
          rating: number
          usuario_id?: string | null
          usuario_nome: string
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          estabelecimento_id?: string
          id?: never
          rating?: number
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          gradiente: string
          icon: string
          id: string
          label: string
          ordem: number
        }
        Insert: {
          gradiente: string
          icon: string
          id: string
          label: string
          ordem?: number
        }
        Update: {
          gradiente?: string
          icon?: string
          id?: string
          label?: string
          ordem?: number
        }
        Relationships: []
      }
      config_pontos: {
        Row: {
          acao: Database["public"]["Enums"]["acao_pontos"]
          pontos: number
        }
        Insert: {
          acao: Database["public"]["Enums"]["acao_pontos"]
          pontos: number
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_pontos"]
          pontos?: number
        }
        Relationships: []
      }
      cupom_eventos: {
        Row: {
          criado_em: string
          cupom_id: string
          id: number
          tipo: Database["public"]["Enums"]["tipo_evento_cupom"]
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          cupom_id: string
          id?: never
          tipo: Database["public"]["Enums"]["tipo_evento_cupom"]
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          cupom_id?: string
          id?: never
          tipo?: Database["public"]["Enums"]["tipo_evento_cupom"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupom_eventos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupom_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          atualizado_em: string
          avaliacoes: number
          beneficio: string
          categoria_id: string
          criado_em: string
          destaque: boolean
          distancia_km: number | null
          economia: number
          estabelecimento_id: string
          horarios: Json
          id: string
          imagem: string
          limite_por_usuario: number
          limite_total: number | null
          ocultar_ate_inicio: boolean
          ordem: number
          prazo_ativacao_horas: number
          preco_de: number | null
          preco_por: number | null
          rating: number | null
          regras: Json
          status: Database["public"]["Enums"]["status_cupom"]
          titulo: string
          validade_fim: string
          validade_inicio: string | null
        }
        Insert: {
          atualizado_em?: string
          avaliacoes?: number
          beneficio?: string
          categoria_id: string
          criado_em?: string
          destaque?: boolean
          distancia_km?: number | null
          economia: number
          estabelecimento_id: string
          horarios?: Json
          id?: string
          imagem?: string
          limite_por_usuario?: number
          limite_total?: number | null
          ocultar_ate_inicio?: boolean
          ordem?: number
          prazo_ativacao_horas?: number
          preco_de?: number | null
          preco_por?: number | null
          rating?: number | null
          regras?: Json
          status?: Database["public"]["Enums"]["status_cupom"]
          titulo: string
          validade_fim: string
          validade_inicio?: string | null
        }
        Update: {
          atualizado_em?: string
          avaliacoes?: number
          beneficio?: string
          categoria_id?: string
          criado_em?: string
          destaque?: boolean
          distancia_km?: number | null
          economia?: number
          estabelecimento_id?: string
          horarios?: Json
          id?: string
          imagem?: string
          limite_por_usuario?: number
          limite_total?: number | null
          ocultar_ate_inicio?: boolean
          ordem?: number
          prazo_ativacao_horas?: number
          preco_de?: number | null
          preco_por?: number | null
          rating?: number | null
          regras?: Json
          status?: Database["public"]["Enums"]["status_cupom"]
          titulo?: string
          validade_fim?: string
          validade_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons_usuario: {
        Row: {
          ativado_em: string
          codigo: string
          cupom_id: string
          expira_em: string | null
          id: number
          nps: number | null
          status: Database["public"]["Enums"]["status_cupom_usuario"]
          usuario_id: string
          validado_em: string | null
        }
        Insert: {
          ativado_em?: string
          codigo?: string
          cupom_id: string
          expira_em?: string | null
          id?: never
          nps?: number | null
          status?: Database["public"]["Enums"]["status_cupom_usuario"]
          usuario_id: string
          validado_em?: string | null
        }
        Update: {
          ativado_em?: string
          codigo?: string
          cupom_id?: string
          expira_em?: string | null
          id?: never
          nps?: number | null
          status?: Database["public"]["Enums"]["status_cupom_usuario"]
          usuario_id?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_usuario_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estabelecimentos: {
        Row: {
          atualizado_em: string
          categoria_id: string
          cidade: string
          criado_em: string
          id: string
          nome: string
          owner_id: string | null
          rating: number
          rating_count: number
          status: Database["public"]["Enums"]["status_estabelecimento"]
        }
        Insert: {
          atualizado_em?: string
          categoria_id: string
          cidade: string
          criado_em?: string
          id?: string
          nome: string
          owner_id?: string | null
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["status_estabelecimento"]
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string
          cidade?: string
          criado_em?: string
          id?: string
          nome?: string
          owner_id?: string | null
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["status_estabelecimento"]
        }
        Relationships: [
          {
            foreignKeyName: "estabelecimentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estabelecimentos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          badge: string | null
          beneficios: Json
          bloqueado: boolean
          descricao: string
          destaque: boolean
          id: string
          legenda: string | null
          nome: string
          ordem: number
          periodo: string
          preco: number
        }
        Insert: {
          badge?: string | null
          beneficios?: Json
          bloqueado?: boolean
          descricao?: string
          destaque?: boolean
          id: string
          legenda?: string | null
          nome: string
          ordem?: number
          periodo?: string
          preco?: number
        }
        Update: {
          badge?: string | null
          beneficios?: Json
          bloqueado?: boolean
          descricao?: string
          destaque?: boolean
          id?: string
          legenda?: string | null
          nome?: string
          ordem?: number
          periodo?: string
          preco?: number
        }
        Relationships: []
      }
      pontos_transacoes: {
        Row: {
          acao: Database["public"]["Enums"]["acao_pontos"]
          criado_em: string
          id: number
          pontos: number
          referencia_id: string | null
          usuario_id: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["acao_pontos"]
          criado_em?: string
          id?: never
          pontos: number
          referencia_id?: string | null
          usuario_id: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_pontos"]
          criado_em?: string
          id?: never
          pontos?: number
          referencia_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_transacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          atualizado_em: string
          cidade: string | null
          cpf: string | null
          criado_em: string
          id: string
          nascimento: string | null
          nome: string
          role: Database["public"]["Enums"]["papel_usuario"]
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          cpf?: string | null
          criado_em?: string
          id: string
          nascimento?: string | null
          nome?: string
          role?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          cpf?: string | null
          criado_em?: string
          id?: string
          nascimento?: string | null
          nome?: string
          role?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      cupom_metricas: {
        Row: {
          ativacoes: number | null
          cliques: number | null
          cupom_id: string | null
          resgates: number | null
          visualizacoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cupom_eventos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      gerar_codigo_cupom: { Args: never; Returns: string }
    }
    Enums: {
      acao_pontos: "resgate" | "nps" | "indicacao" | "visita"
      papel_usuario: "consumidor" | "lojista" | "admin"
      status_assinatura: "ativa" | "cancelada" | "expirada"
      status_cupom: "ativo" | "indisponivel" | "expirado" | "esgotado"
      status_cupom_usuario: "ativo" | "validado" | "expirado"
      status_estabelecimento: "ativo" | "pendente" | "suspenso"
      tipo_evento_cupom: "visualizacao" | "clique" | "ativacao" | "validacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acao_pontos: ["resgate", "nps", "indicacao", "visita"],
      papel_usuario: ["consumidor", "lojista", "admin"],
      status_assinatura: ["ativa", "cancelada", "expirada"],
      status_cupom: ["ativo", "indisponivel", "expirado", "esgotado"],
      status_cupom_usuario: ["ativo", "validado", "expirado"],
      status_estabelecimento: ["ativo", "pendente", "suspenso"],
      tipo_evento_cupom: ["visualizacao", "clique", "ativacao", "validacao"],
    },
  },
} as const

