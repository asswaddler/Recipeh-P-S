import type { ParsedIngredient } from '../types';

/**
 * Common unit abbreviations and their normalized forms
 */
const UNIT_MAP: Record<string, string> = {
  // Volume
  'tsp': 'tsp',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'tbsp': 'tbsp',
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'cup': 'cup',
  'cups': 'cup',
  'c': 'cup',
  'ml': 'ml',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'l': 'L',
  'liter': 'L',
  'liters': 'L',
  'litre': 'L',
  'litres': 'L',
  'fl oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',

  // Weight
  'g': 'g',
  'gram': 'g',
  'grams': 'g',
  'kg': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'oz': 'oz',
  'ounce': 'oz',
  'ounces': 'oz',
  'lb': 'lb',
  'lbs': 'lb',
  'pound': 'lb',
  'pounds': 'lb',

  // Count/Other
  'piece': 'piece',
  'pieces': 'piece',
  'pc': 'piece',
  'pcs': 'piece',
  'slice': 'slice',
  'slices': 'slice',
  'clove': 'clove',
  'cloves': 'clove',
  'can': 'can',
  'cans': 'can',
  'bunch': 'bunch',
  'bunches': 'bunch',
  'sprig': 'sprig',
  'sprigs': 'sprig',
  'pinch': 'pinch',
  'pinches': 'pinch',
  'head': 'head',
  'heads': 'head',
  'stalk': 'stalk',
  'stalks': 'stalk',
  'package': 'package',
  'packages': 'package',
  'pkg': 'package',
};

/**
 * Fraction map for common fractions
 */
const FRACTION_MAP: Record<string, number> = {
  '½': 0.5,
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 0.167,
  '⅚': 0.833,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/**
 * Parse a quantity string into a number
 */
function parseQuantity(quantityStr: string): number | null {
  if (!quantityStr) return null;

  let str = quantityStr.trim();

  // Handle unicode fractions
  for (const [fraction, value] of Object.entries(FRACTION_MAP)) {
    if (str === fraction) {
      return value;
    }
    // Handle mixed numbers like "1½"
    if (str.includes(fraction)) {
      const whole = str.replace(fraction, '').trim();
      const wholeNum = whole ? parseFloat(whole) : 0;
      if (!isNaN(wholeNum)) {
        return wholeNum + value;
      }
    }
  }

  // Handle text fractions like "1/2"
  const fractionMatch = str.match(/^(\d+)?\s*(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseInt(fractionMatch[1], 10) : 0;
    const numerator = parseInt(fractionMatch[2], 10);
    const denominator = parseInt(fractionMatch[3], 10);
    if (denominator !== 0) {
      return whole + numerator / denominator;
    }
  }

  // Handle ranges like "2-3" - take the average
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2;
  }

  // Handle simple numbers
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normalize a unit string
 */
function normalizeUnit(unit: string): string | null {
  if (!unit) return null;
  const normalized = unit.toLowerCase().trim();
  return UNIT_MAP[normalized] || normalized;
}

/**
 * Parse a single ingredient line
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const original = line.trim();

  if (!original) {
    return { name: '', quantity: null, unit: null, original };
  }

  // Common patterns:
  // "2 cups flour"
  // "1/2 tsp salt"
  // "3 large eggs"
  // "Salt to taste"
  // "1 (14 oz) can tomatoes"

  // Try to match quantity at the start
  const quantityPattern = /^([\d\s\/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞.-]+)/;
  const quantityMatch = original.match(quantityPattern);

  let quantity: number | null = null;
  let remaining = original;

  if (quantityMatch) {
    quantity = parseQuantity(quantityMatch[1]);
    if (quantity !== null) {
      remaining = original.slice(quantityMatch[0].length).trim();
    }
  }

  // Try to match unit
  const unitPattern = /^([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+/;
  const unitMatch = remaining.match(unitPattern);

  let unit: string | null = null;
  let name = remaining;

  if (unitMatch) {
    const potentialUnit = unitMatch[1].toLowerCase();
    // Check if it's a known unit
    if (UNIT_MAP[potentialUnit]) {
      unit = normalizeUnit(potentialUnit);
      name = remaining.slice(unitMatch[0].length).trim();
    }
  }

  // Handle parenthetical notes like "(14 oz)" or "(diced)"
  // Keep them as part of the name for display
  name = name.replace(/\s+/g, ' ').trim();

  return {
    name,
    quantity,
    unit,
    original
  };
}

/**
 * Parse a multi-line ingredients string into individual ingredients
 */
export function parseIngredients(ingredientsText: string): ParsedIngredient[] {
  if (!ingredientsText) return [];

  // Split by newlines, commas (if no newlines), or semicolons
  let lines: string[];

  if (ingredientsText.includes('\n')) {
    lines = ingredientsText.split('\n');
  } else if (ingredientsText.includes(';')) {
    lines = ingredientsText.split(';');
  } else if (ingredientsText.includes(',')) {
    // Be careful with commas - they might be part of ingredient descriptions
    // Only split if it looks like a list
    const commaCount = (ingredientsText.match(/,/g) || []).length;
    if (commaCount >= 2) {
      lines = ingredientsText.split(',');
    } else {
      lines = [ingredientsText];
    }
  } else {
    lines = [ingredientsText];
  }

  return lines
    .map(line => parseIngredientLine(line))
    .filter(ing => ing.name || ing.original);
}

/**
 * Scale ingredient quantity
 */
export function scaleIngredient(
  ingredient: ParsedIngredient,
  originalServings: number,
  targetServings: number
): ParsedIngredient {
  if (ingredient.quantity === null || originalServings === 0) {
    return ingredient;
  }

  const scaleFactor = targetServings / originalServings;
  const scaledQuantity = ingredient.quantity * scaleFactor;

  return {
    ...ingredient,
    quantity: Math.round(scaledQuantity * 100) / 100 // Round to 2 decimal places
  };
}

/**
 * Capitalize the first letter of each word
 */
function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Format an ingredient for display (Name first, then quantity/unit)
 * e.g., "Soy Sauce 1 cup" instead of "1 cup soy sauce"
 */
export function formatIngredient(ingredient: ParsedIngredient): string {
  if (ingredient.quantity === null) {
    return capitalizeWords(ingredient.original || ingredient.name);
  }

  let quantityStr: string;
  // Format nicely - use fractions for common values
  if (ingredient.quantity === 0.25) {
    quantityStr = '¼';
  } else if (ingredient.quantity === 0.5) {
    quantityStr = '½';
  } else if (ingredient.quantity === 0.75) {
    quantityStr = '¾';
  } else if (ingredient.quantity === 0.333 || ingredient.quantity === 0.33) {
    quantityStr = '⅓';
  } else if (ingredient.quantity === 0.667 || ingredient.quantity === 0.67) {
    quantityStr = '⅔';
  } else if (Number.isInteger(ingredient.quantity)) {
    quantityStr = ingredient.quantity.toString();
  } else {
    quantityStr = ingredient.quantity.toFixed(2).replace(/\.?0+$/, '');
  }

  // Build: Name first, then quantity and unit
  const parts = [capitalizeWords(ingredient.name), quantityStr];
  if (ingredient.unit) {
    parts.push(ingredient.unit);
  }

  return parts.join(' ');
}

/**
 * Check if two ingredients can be combined (same name and compatible units)
 */
export function canCombineIngredients(a: ParsedIngredient, b: ParsedIngredient): boolean {
  // Normalize names for comparison
  const nameA = a.name.toLowerCase().trim();
  const nameB = b.name.toLowerCase().trim();

  if (nameA !== nameB) return false;

  // If both have quantities and units, units must match
  if (a.quantity !== null && b.quantity !== null) {
    if (a.unit !== null && b.unit !== null) {
      return a.unit === b.unit;
    }
    // If only one has a unit, can't combine
    if (a.unit !== null || b.unit !== null) {
      return false;
    }
  }

  return true;
}

/**
 * Combine two compatible ingredients
 */
export function combineIngredients(
  a: ParsedIngredient,
  b: ParsedIngredient
): ParsedIngredient {
  if (!canCombineIngredients(a, b)) {
    throw new Error('Cannot combine incompatible ingredients');
  }

  // If either has no quantity, return the one with quantity or keep as is
  if (a.quantity === null && b.quantity === null) {
    return { ...a };
  }

  if (a.quantity === null) return { ...b };
  if (b.quantity === null) return { ...a };

  return {
    name: a.name,
    quantity: a.quantity + b.quantity,
    unit: a.unit,
    original: `${formatIngredient(a)} + ${formatIngredient(b)}`
  };
}
