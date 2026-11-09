import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Category } from "@chrise/core";
import { CategoryBadge, Money, PageTitle, Ring, SectionTitle, Sparkline } from "./kit";
import { renderWithProviders } from "@/test/render";

const category: Category = {
  id: "pet-racao",
  name: "Ração e petiscos",
  group: "pets",
  kind: "expense",
  nature: "fixed",
  color: "pink",
  icon: "Bone",
};

describe("Money", () => {
  it("mostra o sinal de negativo quando sign='auto'", () => {
    const { container } = renderWithProviders(<Money value={-1234} sign="auto" />);
    expect(container.textContent?.replace(/\u00A0/g, " ")).toBe("−R$ 12,34");
  });

  it("respeita o sinal explícito", () => {
    const { container } = renderWithProviders(<Money value={4590} sign="+" />);
    expect(container.textContent?.replace(/\u00A0/g, " ")).toBe("+R$ 45,90");
  });

  it("não mostra sinal quando não é pedido", () => {
    const { container } = renderWithProviders(<Money value={4590} />);
    expect(container.textContent).not.toContain("+");
    expect(container.textContent).not.toContain("−");
  });
});

describe("CategoryBadge", () => {
  it("renderiza o ícone da categoria", () => {
    const { container } = renderWithProviders(<CategoryBadge category={category} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("funciona sem categoria (ícone genérico)", () => {
    const { container } = renderWithProviders(<CategoryBadge />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("Ring", () => {
  it("mostra o conteúdo e limita o progresso a 100%", () => {
    const { container } = renderWithProviders(
      <Ring value={1.8}>
        <span>180%</span>
      </Ring>,
    );
    expect(screen.getByText("180%")).toBeInTheDocument();
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[1]?.getAttribute("stroke-dashoffset")).toBe("0");
  });
});

describe("Sparkline", () => {
  it("não desenha com menos de dois pontos", () => {
    const { container } = renderWithProviders(<Sparkline values={[10]} />);
    expect(container.firstChild).toBeNull();
  });

  it("desenha a linha e o trecho tracejado da previsão", () => {
    const { container } = renderWithProviders(<Sparkline values={[10, 12, 9, 15]} dashedFrom={1} />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[1]?.getAttribute("stroke-dasharray")).toBe("3 4");
  });
});

describe("SectionTitle e PageTitle", () => {
  it("mostra a ação como link", () => {
    renderWithProviders(<SectionTitle title="Limites do mês" to="/budgets" action="Ajustar" />);
    expect(screen.getByRole("heading", { name: "Limites do mês" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajustar/ })).toHaveAttribute("href", "/budgets");
  });

  it("mostra o eyebrow e o título", () => {
    renderWithProviders(<PageTitle eyebrow="Preferências" title="Ajustes" />);
    expect(screen.getByText("Preferências")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
  });
});
