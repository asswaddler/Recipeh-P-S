// Core data types for the Meal Planning App

// ============================================
// Recipe Types
// ============================================

export interface Recipe {
  recipeId: string;
  name: string;
  description?: string;
  category?: string;
  servingsDefault: number;
  ingredients: ParsedIngredient[];
  ingredientNotes?: string;
  instructions: string[];
  rawIngredients?: string; // Original multi-line cell value
}

export interface ParsedIngredient {
  name: string;
  quantity: number | null; // null if not parseable
  unit: string | null;
  original: string; // Keep original text for fallback display
}

// ============================================
// Ingredients Catalogue Types
// ============================================

export type MajorCategory = 'Fresh' | 'Pantry' | 'Freezer';

export interface CatalogueItem {
  id: string;
  name: string;
  majorCategory: MajorCategory;
  minorCategory: string;
}

export interface IngredientsCatalogue {
  Fresh: Record<string, CatalogueItem[]>;
  Pantry: Record<string, CatalogueItem[]>;
  Freezer: Record<string, CatalogueItem[]>;
}

// ============================================
// Weekly Plan Types
// ============================================

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner';

export interface MealPlanEntry {
  weekId: string;
  day: DayOfWeek;
  mealSlot: MealSlot;
  recipeId: string | null;
  servingsOverride?: number;
}

export interface WeeklyPlan {
  weekId: string;
  entries: MealPlanEntry[];
}

// ============================================
// Grocery List Types
// ============================================

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  displayText: string;
  sources: string[]; // Recipe names or "Manual"
  isManual: boolean;
  majorCategory?: MajorCategory;
  minorCategory?: string;
}

export interface ManualGroceryAddition {
  id: string;
  weekId: string;
  itemName: string;
  quantity?: string;
  catalogueItemId?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse {
  recipes: Recipe[];
  ingredientsCatalogue: IngredientsCatalogue;
  weeklyPlan: MealPlanEntry[];
}

export interface SavePlanResponse {
  success: boolean;
  message?: string;
}

// ============================================
// App State Types
// ============================================

export interface AppState {
  recipes: Recipe[];
  ingredientsCatalogue: IngredientsCatalogue;
  currentWeekId: string;
  weeklyPlan: WeeklyPlan;
  manualAdditions: ManualGroceryAddition[];
  checkedGroceryItems: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastFetch: {
    recipes: number | null;
    catalogue: number | null;
    plan: Record<string, number>;
  };
}

// ============================================
// Configuration Types
// ============================================

export interface AppConfig {
  apiBaseUrl: string;
  cacheExpiry: {
    recipes: number; // milliseconds
    catalogue: number;
    plan: number;
  };
  fieldMappings?: {
    recipes?: Partial<Record<keyof Recipe, string>>;
    weeklyPlan?: Partial<Record<keyof MealPlanEntry, string>>;
  };
}
