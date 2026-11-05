import type { Category } from "@chrise/core";

/**
 * Categorias padrão. Os mesmos IDs são criados para cada usuário novo no
 * Supabase (ver supabase/migrations), então mock e produção falam a mesma língua.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  // Receitas
  { id: "nf-servicos", name: "Nota fiscal (PJ)", group: "receita", kind: "income", nature: "fixed", color: "hsl(var(--success))", icon: "FileText" },
  { id: "freelance", name: "Freelance", group: "receita", kind: "income", nature: "variable", color: "hsl(var(--chart-5))", icon: "Laptop" },
  { id: "rendimentos", name: "Rendimentos", group: "receita", kind: "income", nature: "variable", color: "hsl(var(--chart-1))", icon: "PiggyBank" },

  // Moradia
  { id: "aluguel", name: "Aluguel", group: "moradia", kind: "expense", nature: "fixed", color: "hsl(var(--chart-1))", icon: "Home" },
  { id: "condominio", name: "Condomínio", group: "moradia", kind: "expense", nature: "fixed", color: "hsl(var(--chart-1))", icon: "Building" },
  { id: "energia", name: "Energia", group: "moradia", kind: "expense", nature: "fixed", color: "hsl(var(--chart-1))", icon: "Zap" },
  { id: "internet", name: "Internet e celular", group: "moradia", kind: "expense", nature: "fixed", color: "hsl(var(--chart-1))", icon: "Wifi" },

  // Alimentação
  { id: "mercado", name: "Mercado", group: "alimentacao", kind: "expense", nature: "variable", color: "hsl(var(--chart-2))", icon: "ShoppingCart" },
  { id: "delivery", name: "Delivery", group: "alimentacao", kind: "expense", nature: "variable", color: "hsl(var(--chart-2))", icon: "Bike" },
  { id: "restaurante", name: "Restaurantes", group: "alimentacao", kind: "expense", nature: "variable", color: "hsl(var(--chart-2))", icon: "UtensilsCrossed" },

  // Pets
  { id: "pet-racao", name: "Ração e petiscos", group: "pets", kind: "expense", nature: "fixed", color: "hsl(var(--chart-4))", icon: "Bone" },
  { id: "pet-veterinario", name: "Veterinário", group: "pets", kind: "expense", nature: "variable", color: "hsl(var(--chart-4))", icon: "Stethoscope" },
  { id: "pet-banho", name: "Banho e tosa", group: "pets", kind: "expense", nature: "variable", color: "hsl(var(--chart-4))", icon: "PawPrint" },

  // Transporte, saúde, lazer
  { id: "transporte", name: "Transporte", group: "transporte", kind: "expense", nature: "variable", color: "hsl(var(--chart-5))", icon: "Car" },
  { id: "plano-saude", name: "Plano de saúde", group: "saude", kind: "expense", nature: "fixed", color: "hsl(var(--info))", icon: "HeartPulse" },
  { id: "farmacia", name: "Farmácia", group: "saude", kind: "expense", nature: "variable", color: "hsl(var(--info))", icon: "Pill" },
  { id: "academia", name: "Academia", group: "saude", kind: "expense", nature: "fixed", color: "hsl(var(--info))", icon: "Dumbbell" },
  { id: "lazer", name: "Lazer", group: "lazer", kind: "expense", nature: "variable", color: "hsl(var(--chart-3))", icon: "PartyPopper" },
  { id: "assinaturas", name: "Assinaturas", group: "assinaturas", kind: "expense", nature: "fixed", color: "hsl(var(--chart-3))", icon: "Tv" },
  { id: "cursos", name: "Cursos e livros", group: "educacao", kind: "expense", nature: "variable", color: "hsl(var(--chart-5))", icon: "GraduationCap" },

  // Impostos e custos da PJ
  { id: "das", name: "DAS (Simples)", group: "impostos", kind: "expense", nature: "fixed", color: "hsl(var(--danger))", icon: "Landmark" },
  { id: "inss", name: "INSS pró-labore", group: "impostos", kind: "expense", nature: "fixed", color: "hsl(var(--danger))", icon: "Landmark" },
  { id: "contador", name: "Contador", group: "impostos", kind: "expense", nature: "fixed", color: "hsl(var(--danger))", icon: "Calculator" },

  { id: "outros", name: "Outros", group: "outros", kind: "expense", nature: "variable", color: "hsl(var(--muted-foreground))", icon: "Package" },
];
