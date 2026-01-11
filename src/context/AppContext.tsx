import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect
} from 'react';
import type { ReactNode } from 'react';
import type {
  Recipe,
  IngredientsCatalogue,
  MealPlanEntry,
  WeeklyPlan,
  ManualGroceryAddition,
  DayOfWeek,
  MealSlot
} from '../types';
import {
  fetchData,
  savePlan,
  getManualAdditions,
  saveManualAdditions,
  useMockData,
  getMockData
} from '../services/api';
import { getWeekId, getPreviousWeekId, getNextWeekId } from '../utils/dateUtils';

// ============================================
// State Types
// ============================================

interface AppState {
  recipes: Recipe[];
  ingredientsCatalogue: IngredientsCatalogue;
  currentWeekId: string;
  weeklyPlan: WeeklyPlan;
  manualAdditions: ManualGroceryAddition[];
  checkedGroceryItems: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean | null;
  hasUnsavedChanges: boolean;
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SAVE_SUCCESS'; payload: boolean | null }
  | { type: 'SET_RECIPES'; payload: Recipe[] }
  | { type: 'SET_CATALOGUE'; payload: IngredientsCatalogue }
  | { type: 'SET_WEEK_ID'; payload: string }
  | { type: 'SET_WEEKLY_PLAN'; payload: MealPlanEntry[] }
  | { type: 'SET_MEAL'; payload: { day: DayOfWeek; mealSlot: MealSlot; recipeId: string | null; servingsOverride?: number } }
  | { type: 'SET_SERVINGS_OVERRIDE'; payload: { day: DayOfWeek; mealSlot: MealSlot; servings: number | undefined } }
  | { type: 'SET_MANUAL_ADDITIONS'; payload: ManualGroceryAddition[] }
  | { type: 'ADD_MANUAL_ADDITION'; payload: ManualGroceryAddition }
  | { type: 'REMOVE_MANUAL_ADDITION'; payload: string }
  | { type: 'TOGGLE_GROCERY_ITEM'; payload: string }
  | { type: 'CLEAR_CHECKED_ITEMS' }
  | { type: 'MARK_SAVED' };

// ============================================
// Initial State
// ============================================

const initialState: AppState = {
  recipes: [],
  ingredientsCatalogue: { Fresh: {}, Pantry: {}, Freezer: {} },
  currentWeekId: getWeekId(),
  weeklyPlan: { weekId: getWeekId(), entries: [] },
  manualAdditions: [],
  checkedGroceryItems: new Set(),
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: null,
  hasUnsavedChanges: false
};

// ============================================
// Reducer
// ============================================

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SAVE_SUCCESS':
      return { ...state, saveSuccess: action.payload };

    case 'SET_RECIPES':
      return { ...state, recipes: action.payload };

    case 'SET_CATALOGUE':
      return { ...state, ingredientsCatalogue: action.payload };

    case 'SET_WEEK_ID':
      return {
        ...state,
        currentWeekId: action.payload,
        weeklyPlan: { weekId: action.payload, entries: [] },
        checkedGroceryItems: new Set(),
        hasUnsavedChanges: false
      };

    case 'SET_WEEKLY_PLAN':
      return {
        ...state,
        weeklyPlan: {
          weekId: state.currentWeekId,
          entries: action.payload
        },
        hasUnsavedChanges: false
      };

    case 'SET_MEAL': {
      const { day, mealSlot, recipeId, servingsOverride } = action.payload;
      const existingIndex = state.weeklyPlan.entries.findIndex(
        e => e.day === day && e.mealSlot === mealSlot
      );

      let newEntries: MealPlanEntry[];

      if (recipeId === null) {
        // Remove the entry
        newEntries = state.weeklyPlan.entries.filter(
          e => !(e.day === day && e.mealSlot === mealSlot)
        );
      } else if (existingIndex >= 0) {
        // Update existing entry
        newEntries = [...state.weeklyPlan.entries];
        newEntries[existingIndex] = {
          ...newEntries[existingIndex],
          recipeId,
          servingsOverride
        };
      } else {
        // Add new entry
        newEntries = [
          ...state.weeklyPlan.entries,
          {
            weekId: state.currentWeekId,
            day,
            mealSlot,
            recipeId,
            servingsOverride
          }
        ];
      }

      return {
        ...state,
        weeklyPlan: { ...state.weeklyPlan, entries: newEntries },
        hasUnsavedChanges: true
      };
    }

    case 'SET_SERVINGS_OVERRIDE': {
      const { day, mealSlot, servings } = action.payload;
      const existingIndex = state.weeklyPlan.entries.findIndex(
        e => e.day === day && e.mealSlot === mealSlot
      );

      if (existingIndex < 0) return state;

      const newEntries = [...state.weeklyPlan.entries];
      newEntries[existingIndex] = {
        ...newEntries[existingIndex],
        servingsOverride: servings
      };

      return {
        ...state,
        weeklyPlan: { ...state.weeklyPlan, entries: newEntries },
        hasUnsavedChanges: true
      };
    }

    case 'SET_MANUAL_ADDITIONS':
      return { ...state, manualAdditions: action.payload };

    case 'ADD_MANUAL_ADDITION':
      return {
        ...state,
        manualAdditions: [...state.manualAdditions, action.payload]
      };

    case 'REMOVE_MANUAL_ADDITION':
      return {
        ...state,
        manualAdditions: state.manualAdditions.filter(a => a.id !== action.payload)
      };

    case 'TOGGLE_GROCERY_ITEM': {
      const newChecked = new Set(state.checkedGroceryItems);
      if (newChecked.has(action.payload)) {
        newChecked.delete(action.payload);
      } else {
        newChecked.add(action.payload);
      }
      return { ...state, checkedGroceryItems: newChecked };
    }

    case 'CLEAR_CHECKED_ITEMS':
      return { ...state, checkedGroceryItems: new Set() };

    case 'MARK_SAVED':
      return { ...state, hasUnsavedChanges: false };

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface AppContextValue {
  state: AppState;
  actions: {
    loadData: (forceRefresh?: boolean) => Promise<void>;
    navigateWeek: (direction: 'prev' | 'next') => void;
    goToWeek: (weekId: string) => void;
    setMeal: (day: DayOfWeek, mealSlot: MealSlot, recipeId: string | null, servingsOverride?: number) => void;
    setServingsOverride: (day: DayOfWeek, mealSlot: MealSlot, servings: number | undefined) => void;
    saveCurrentPlan: () => Promise<boolean>;
    addManualItem: (itemName: string, quantity?: string, catalogueItemId?: string) => void;
    removeManualItem: (id: string) => void;
    toggleGroceryItem: (id: string) => void;
    clearCheckedItems: () => void;
    getRecipeById: (id: string) => Recipe | undefined;
    getMealForSlot: (day: DayOfWeek, mealSlot: MealSlot) => MealPlanEntry | undefined;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load data for current week
  const loadData = useCallback(async (forceRefresh = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      let data;

      if (useMockData()) {
        // Use mock data for development
        data = getMockData(state.currentWeekId);
      } else {
        data = await fetchData(state.currentWeekId, { forceRefresh });
      }

      dispatch({ type: 'SET_RECIPES', payload: data.recipes });
      dispatch({ type: 'SET_CATALOGUE', payload: data.catalogue });
      dispatch({ type: 'SET_WEEKLY_PLAN', payload: data.weeklyPlan });

      // Load manual additions from local storage
      const manual = getManualAdditions(state.currentWeekId);
      dispatch({ type: 'SET_MANUAL_ADDITIONS', payload: manual });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentWeekId]);

  // Navigate weeks
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    const newWeekId = direction === 'prev'
      ? getPreviousWeekId(state.currentWeekId)
      : getNextWeekId(state.currentWeekId);
    dispatch({ type: 'SET_WEEK_ID', payload: newWeekId });
  }, [state.currentWeekId]);

  const goToWeek = useCallback((weekId: string) => {
    dispatch({ type: 'SET_WEEK_ID', payload: weekId });
  }, []);

  // Set meal
  const setMeal = useCallback((
    day: DayOfWeek,
    mealSlot: MealSlot,
    recipeId: string | null,
    servingsOverride?: number
  ) => {
    dispatch({ type: 'SET_MEAL', payload: { day, mealSlot, recipeId, servingsOverride } });
  }, []);

  // Set servings override
  const setServingsOverride = useCallback((
    day: DayOfWeek,
    mealSlot: MealSlot,
    servings: number | undefined
  ) => {
    dispatch({ type: 'SET_SERVINGS_OVERRIDE', payload: { day, mealSlot, servings } });
  }, []);

  // Save plan
  const saveCurrentPlan = useCallback(async (): Promise<boolean> => {
    dispatch({ type: 'SET_SAVING', payload: true });
    dispatch({ type: 'SET_SAVE_SUCCESS', payload: null });

    try {
      if (useMockData()) {
        // Simulate save for mock mode
        await new Promise(resolve => setTimeout(resolve, 500));
        dispatch({ type: 'MARK_SAVED' });
        dispatch({ type: 'SET_SAVE_SUCCESS', payload: true });
        return true;
      }

      const result = await savePlan(state.currentWeekId, state.weeklyPlan.entries);

      if (result.success) {
        dispatch({ type: 'MARK_SAVED' });
        dispatch({ type: 'SET_SAVE_SUCCESS', payload: true });
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.message || 'Failed to save plan' });
        dispatch({ type: 'SET_SAVE_SUCCESS', payload: false });
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save plan';
      dispatch({ type: 'SET_ERROR', payload: message });
      dispatch({ type: 'SET_SAVE_SUCCESS', payload: false });
      return false;
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
      // Clear success message after 3 seconds
      setTimeout(() => {
        dispatch({ type: 'SET_SAVE_SUCCESS', payload: null });
      }, 3000);
    }
  }, [state.currentWeekId, state.weeklyPlan.entries]);

  // Manual additions
  const addManualItem = useCallback((
    itemName: string,
    quantity?: string,
    catalogueItemId?: string
  ) => {
    const addition: ManualGroceryAddition = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      weekId: state.currentWeekId,
      itemName,
      quantity,
      catalogueItemId
    };
    dispatch({ type: 'ADD_MANUAL_ADDITION', payload: addition });

    // Save to local storage
    const updated = [...state.manualAdditions, addition];
    saveManualAdditions(state.currentWeekId, updated);
  }, [state.currentWeekId, state.manualAdditions]);

  const removeManualItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MANUAL_ADDITION', payload: id });

    // Save to local storage
    const updated = state.manualAdditions.filter(a => a.id !== id);
    saveManualAdditions(state.currentWeekId, updated);
  }, [state.currentWeekId, state.manualAdditions]);

  // Grocery item toggling
  const toggleGroceryItem = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_GROCERY_ITEM', payload: id });
  }, []);

  const clearCheckedItems = useCallback(() => {
    dispatch({ type: 'CLEAR_CHECKED_ITEMS' });
  }, []);

  // Helpers
  const getRecipeById = useCallback((id: string): Recipe | undefined => {
    return state.recipes.find(r => r.recipeId === id);
  }, [state.recipes]);

  const getMealForSlot = useCallback((day: DayOfWeek, mealSlot: MealSlot): MealPlanEntry | undefined => {
    return state.weeklyPlan.entries.find(e => e.day === day && e.mealSlot === mealSlot);
  }, [state.weeklyPlan.entries]);

  // Load data when week changes
  useEffect(() => {
    loadData();
  }, [state.currentWeekId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AppContextValue = {
    state,
    actions: {
      loadData,
      navigateWeek,
      goToWeek,
      setMeal,
      setServingsOverride,
      saveCurrentPlan,
      addManualItem,
      removeManualItem,
      toggleGroceryItem,
      clearCheckedItems,
      getRecipeById,
      getMealForSlot
    }
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
