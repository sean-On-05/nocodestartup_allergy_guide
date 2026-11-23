export type Language = 'en' | 'ko'
export type VerificationStatus = 'verified' | 'needs_review' | 'unknown'
export interface Allergen { id: string; name_en: string; name_ko: string }
export interface Ingredient {
  id: string; ingredient_name: string; ingredient_name_en?: string;
  global_allergens: string[]; vegan_level: string; diet_categories: string[];
  hidden_warning_en: string; staff_request_ko: string; user_notice_en: string;
  verification_status: VerificationStatus; source_note: string;
}
export interface IngredientAllergenMapping { ingredient_id: string; allergen_id: string; evidence_status: VerificationStatus }
export interface ExternalIngredientMapping { external_id: string; external_name: string; ingredient_id: string | null; match_status: 'matched' | 'manually_matched' | 'needs_review' }
export interface Dish {
  id: string; name_en: string; name_ko: string; description_en: string; description_ko: string;
  category: 'rice' | 'stew' | 'noodles' | 'street'; ingredient_ids: string[];
  external_ingredient_ids: string[]; ingredients_complete: boolean;
  nutrition?: { kcal: number; protein_g: number; carbs_g: number; source: string };
  source_note: string;
  cuisine?: string;
  source_kind?: 'public' | 'reference' | 'demo'; source_url?: string;
  raw_ingredients?: string; unmapped_ingredients?: string[];
  reference_ingredients?: { name: string; quantity: string; mapped: boolean }[];
}
export interface Catalog {
  recipe_data_origin?: 'bundled-public' | 'supabase'; recipe_load_issue?: boolean;
  ingredient_master: Ingredient[]; allergen_master: Allergen[];
  ingredient_allergen_mapping: IngredientAllergenMapping[];
  external_ingredient_master_mapping: ExternalIngredientMapping[]; dishes: Dish[];
}
export interface Profile { language: Language; allergens: string[]; other: string; completed: boolean }
