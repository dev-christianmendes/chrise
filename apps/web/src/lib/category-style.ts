import {
  Bike,
  Bone,
  Building,
  Calculator,
  Car,
  CircleDollarSign,
  Dumbbell,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Package,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Pill,
  ShoppingCart,
  Stethoscope,
  Tv,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Category, CategoryGroup } from "@chrise/core";

/**
 * Ícones importados um a um (não o pacote inteiro): o nome vem do banco
 * (`categories.icon`), o componente vem daqui.
 */
const ICONS: Record<string, LucideIcon> = {
  Bike, Bone, Building, Calculator, Car, Dumbbell, FileText, GraduationCap, HeartPulse, Home, Landmark,
  Laptop, Package, PartyPopper, PawPrint, PiggyBank, Pill, ShoppingCart, Stethoscope, Tv, UtensilsCrossed, Wifi, Zap,
};

export const categoryIcon = (category?: Pick<Category, "icon">): LucideIcon =>
  (category?.icon && ICONS[category.icon]) || CircleDollarSign;

/** Cor por GRUPO, não por categoria: casa é sempre azul, pets sempre rosa. Intuição antes de legenda. */
export const groupColor = (group: CategoryGroup | undefined, alpha?: number): string =>
  `hsl(var(--g-${group ?? "outros"})${alpha !== undefined ? ` / ${alpha}` : ""})`;

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  receita: "Receitas",
  moradia: "Casa",
  alimentacao: "Comida",
  pets: "Pets",
  transporte: "Transporte",
  saude: "Saúde",
  lazer: "Lazer",
  assinaturas: "Assinaturas",
  educacao: "Educação",
  impostos: "Impostos PJ",
  outros: "Outros",
};
