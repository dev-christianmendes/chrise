import { expect, type Page, test } from "@playwright/test";

const sidebar = (page: Page) => page.locator("aside");

test.describe("demo mock", () => {
  test("abre o cofre e deixa claro que os dados são fictícios", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/Livre para gastar em/i)).toBeVisible();
    await expect(page.getByText("Modo demonstração.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /Separar p\/ imposto/i })).toBeVisible();
  });

  test("navega pelas seções principais", async ({ page }) => {
    await page.goto("/");

    await sidebar(page).getByRole("link", { name: "Extrato" }).click();
    await expect(page.getByRole("heading", { name: "Extrato" })).toBeVisible();

    await sidebar(page).getByRole("link", { name: "Impostos" }).click();
    await expect(page.getByRole("heading", { name: "Impostos" })).toBeVisible();
    await expect(page.getByText("Fator R")).toBeVisible();

    await sidebar(page).getByRole("link", { name: "Futuro" }).click();
    await expect(page.getByRole("heading", { name: "Futuro" })).toBeVisible();
  });

  test("cria um lançamento e ele aparece no extrato", async ({ page }) => {
    await page.goto("/");

    await sidebar(page).getByRole("button", { name: "Lançar" }).click();
    await expect(page.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();

    await page.getByPlaceholder("0,00").fill("45,90");
    await page.getByLabel("Descrição").fill("Teste E2E");
    await page.getByRole("button", { name: /Delivery/ }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Gasto registrado")).toBeVisible();

    await sidebar(page).getByRole("link", { name: "Extrato" }).click();
    await expect(page.getByText("Teste E2E")).toBeVisible();
  });

  test("importa um extrato CSV", async ({ page }) => {
    const csv = ["Data;Descrição;Valor", "05/11/2026;Mercado E2E;-120,50"].join("\n");

    await page.goto("/transactions?import=1");
    await expect(page.getByRole("heading", { name: "Importar extrato" })).toBeVisible();

    await page.locator("#statement-file").setInputFiles({
      name: "extrato.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText("Mercado E2E")).toBeVisible();
    await page.getByRole("button", { name: /^Importar \d+$/ }).click();
    await expect(page.getByText(/1 lançamento importado/)).toBeVisible();
  });

  test("continua funcionando sem rede e preserva o lançamento", async ({ page, context }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Extrato" })).toBeVisible();

    await sidebar(page).getByRole("button", { name: "Lançar" }).click();
    await page.getByPlaceholder("0,00").fill("31,50");
    await page.getByLabel("Descrição").fill("Offline E2E");
    await page.getByRole("button", { name: /Delivery/ }).click();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Gasto registrado")).toBeVisible();
    await expect(page.getByText("Offline E2E")).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Offline E2E")).toBeVisible();
  });
});
