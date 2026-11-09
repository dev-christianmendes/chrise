import { Bone, CircleDollarSign, PawPrint } from "lucide-react";
import { describe, expect, it } from "vitest";
import { GROUP_LABEL, categoryIcon, groupColor } from "./category-style";

describe("categoryIcon", () => {
  it("resolve o ícone pelo nome vindo do banco", () => {
    expect(categoryIcon({ icon: "Bone" })).toBe(Bone);
    expect(categoryIcon({ icon: "PawPrint" })).toBe(PawPrint);
  });

  it("cai no ícone genérico quando o nome é desconhecido ou ausente", () => {
    expect(categoryIcon({ icon: "nao-existe" })).toBe(CircleDollarSign);
    expect(categoryIcon({ icon: undefined })).toBe(CircleDollarSign);
    expect(categoryIcon()).toBe(CircleDollarSign);
  });
});

describe("groupColor", () => {
  it("usa a variável CSS do grupo", () => {
    expect(groupColor("pets")).toBe("hsl(var(--g-pets))");
    expect(groupColor("pets", 0.14)).toBe("hsl(var(--g-pets) / 0.14)");
  });

  it("cai em 'outros' quando o grupo não existe", () => {
    expect(groupColor(undefined)).toBe("hsl(var(--g-outros))");
  });
});

describe("GROUP_LABEL", () => {
  it("rotula todos os grupos de categoria", () => {
    expect(Object.keys(GROUP_LABEL)).toHaveLength(11);
    expect(GROUP_LABEL.receita).toBe("Receitas");
    expect(GROUP_LABEL.impostos).toBe("Impostos PJ");
  });
});
