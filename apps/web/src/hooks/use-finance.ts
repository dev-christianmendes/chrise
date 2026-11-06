import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentYearMonth, type FinanceSnapshot, type TaxProfile } from "@chrise/core";
import type { NewBudget, NewTransaction } from "@chrise/data";
import { repository } from "@/lib/repository";

export const keys = {
  categories: ["categories"] as const,
  accounts: ["accounts"] as const,
  transactions: ["transactions"] as const,
  budgets: ["budgets"] as const,
  taxProfile: ["tax-profile"] as const,
};

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => repository.listCategories(), staleTime: Infinity });

export const useAccounts = () =>
  useQuery({ queryKey: keys.accounts, queryFn: () => repository.listAccounts(), staleTime: 5 * 60_000 });

export const useTransactions = () =>
  useQuery({ queryKey: keys.transactions, queryFn: () => repository.listTransactions() });

export const useBudgets = () => useQuery({ queryKey: keys.budgets, queryFn: () => repository.listBudgets() });

export const useTaxProfile = () => useQuery({ queryKey: keys.taxProfile, queryFn: () => repository.getTaxProfile() });

/** Tudo que as telas de análise precisam, já combinado. `snapshot` só existe quando tudo carregou. */
export function useSnapshot(month = currentYearMonth()) {
  const categories = useCategories();
  const accounts = useAccounts();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const taxProfile = useTaxProfile();
  const all = [categories, accounts, transactions, budgets, taxProfile];

  const snapshot = useMemo<FinanceSnapshot | undefined>(() => {
    if (!categories.data || !accounts.data || !transactions.data || !budgets.data || !taxProfile.data) return undefined;
    return {
      month,
      categories: categories.data,
      accounts: accounts.data,
      transactions: transactions.data,
      budgets: budgets.data,
      taxProfile: taxProfile.data,
    };
  }, [month, categories.data, accounts.data, transactions.data, budgets.data, taxProfile.data]);

  return {
    snapshot,
    isLoading: all.some((q) => q.isLoading),
    error: all.find((q) => q.error)?.error ?? null,
  };
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTransaction) => repository.createTransaction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.transactions }),
  });
}

export function useImportTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: NewTransaction[]) => repository.createTransactions(inputs),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.transactions }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.deleteTransaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.transactions }),
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewBudget) => repository.upsertBudget(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.budgets }),
  });
}

export function useSaveTaxProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: TaxProfile) => repository.saveTaxProfile(profile),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.taxProfile }),
  });
}
