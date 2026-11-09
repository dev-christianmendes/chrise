import { describe, expect, it } from "vitest";
import { DATA_SOURCE, IS_DEMO, repository } from "./repository";

describe("seleção do repositório", () => {
  it("usa o mock na demo (sem VITE_DATA_SOURCE=supabase)", () => {
    expect(DATA_SOURCE).toBe("mock");
    expect(IS_DEMO).toBe(true);
    expect(repository.source).toBe("mock");
  });
});
