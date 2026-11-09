import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ErrorState, ListSkeleton, PageSkeleton } from "./states";
import { renderWithProviders } from "@/test/render";

describe("states", () => {
  it("mostra a mensagem de erro com role=alert", () => {
    renderWithProviders(<ErrorState error={new Error("API fora do ar")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("API fora do ar");
  });

  it("avisa que a página está carregando", () => {
    renderWithProviders(<PageSkeleton />);
    expect(screen.getByLabelText("Carregando")).toHaveAttribute("aria-busy", "true");
  });

  it("mostra o esqueleto de lista", () => {
    renderWithProviders(<ListSkeleton />);
    expect(screen.getByLabelText("Carregando")).toHaveAttribute("aria-busy", "true");
  });
});
