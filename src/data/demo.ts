import type { Catalog, Ingredient } from '../lib/types'
const ingredient = (id: string, ko: string, en: string, allergens: string[], vegan: string, warning: string, request: string): Ingredient => ({
  id, ingredient_name: ko, ingredient_name_en: en, global_allergens: allergens,
  vegan_level: vegan, diet_categories: [], hidden_warning_en: warning,
  staff_request_ko: request, user_notice_en: warning,
  verification_status: 'needs_review', source_note: 'Illustrative fixture created for this prototype; not imported from the production database.'
})
export const demoCatalog: Catalog = {
  allergen_master: [
    { id: 'shrimp', name_en: 'Shrimp', name_ko: '새우' }, { id: 'peanut', name_en: 'Peanut', name_ko: '땅콩' },
    { id: 'milk', name_en: 'Milk', name_ko: '우유' }, { id: 'egg', name_en: 'Egg', name_ko: '달걀' },
    { id: 'soy', name_en: 'Soy', name_ko: '대두' }, { id: 'wheat', name_en: 'Wheat', name_ko: '밀' },
    { id: 'fish', name_en: 'Fish', name_ko: '생선' }, { id: 'shellfish', name_en: 'Shellfish', name_ko: '조개류' },
    { id: 'sesame', name_en: 'Sesame', name_ko: '참깨' }, { id: 'tree-nuts', name_en: 'Tree nuts', name_ko: '견과류' },
  ],
  ingredient_master: [
    ingredient('rice','쌀밥','Steamed rice',[],'Vegan','Seasonings and preparation must be confirmed.','밥에 첨가된 재료나 양념을 확인해 주세요.'),
    ingredient('vegetables','채소','Vegetables',[],'Vegan','Vegetables may be seasoned with sauces or sesame oil.','채소에 사용한 양념과 기름을 확인해 주세요.'),
    ingredient('egg','달걀','Egg',['egg'],'Lacto-Ovo','An egg may be served as a topping.','달걀 및 달걀 고명을 사용하는지 확인해 주세요.'),
    ingredient('gochujang','고추장','Gochujang',['wheat','soy'],'Vegan','Gochujang may contain wheat and soy; check the product label.','고추장 제품의 밀과 대두 성분을 확인해 주세요.'),
    ingredient('sesame-oil','참기름','Sesame oil',['sesame'],'Vegan','Sesame oil or sesame seeds may be added.','참기름이나 참깨를 사용하는지 확인해 주세요.'),
    ingredient('kimchi','김치','Kimchi',['shrimp','fish'],'Pesco','Kimchi may contain salted shrimp or fish sauce.','김치에 새우젓이나 액젓이 들어가는지 확인해 주세요.'),
    ingredient('tofu','두부','Tofu',['soy'],'Vegan','Tofu is typically made from soybeans.','두부 및 대두 유래 성분을 확인해 주세요.'),
    ingredient('broth','육수','Broth',['fish','shellfish'],'Pesco','Broth may be made with anchovies or shellfish.','육수에 멸치나 조개류가 들어가는지 확인해 주세요.'),
    ingredient('pork','돼지고기','Pork',[],'Non-Vegan','Marinades may introduce additional ingredients.','고기 양념의 원재료를 확인해 주세요.'),
    ingredient('soy-sauce','간장','Soy sauce',['soy','wheat'],'Vegan','Soy sauce commonly contains soy and may contain wheat.','간장에 대두와 밀이 들어가는지 확인해 주세요.'),
    ingredient('beef','소고기','Beef',[],'Non-Vegan','Marinade ingredients depend on the recipe.','고기 양념과 조리 도구를 확인해 주세요.'),
    ingredient('noodles','당면','Glass noodles',[],'Vegan','Check the starch and the seasoning used.','당면의 원재료와 양념을 확인해 주세요.'),
    ingredient('rice-cake','떡','Rice cakes',['wheat'],'Vegan','Some rice cakes contain wheat or are made from wheat.','떡의 원재료에 밀이 들어가는지 확인해 주세요.'),
    ingredient('fish-cake','어묵','Fish cakes',['fish','wheat','egg','soy'],'Pesco','Fish cakes may contain fish, wheat, egg and soy.','어묵의 생선, 밀, 달걀, 대두 성분을 확인해 주세요.'),
  ],
  ingredient_allergen_mapping: [],
  external_ingredient_master_mapping: [{ external_id: 'demo-kimchi', external_name: '배추김치', ingredient_id: 'kimchi', match_status: 'needs_review' }],
  dishes: [
    { id: 'bibimbap', name_en: 'Bibimbap', name_ko: '비빔밥', description_en: 'A colorful rice bowl with vegetables and gochujang.', description_ko: '채소와 고추장을 곁들인 밥 요리예요.', category: 'rice', ingredient_ids: ['rice','vegetables','egg','gochujang','sesame-oil'], external_ingredient_ids: [], ingredients_complete: false, source_note: 'Example recipe. Toppings and sauce vary by restaurant.' },
    { id: 'kimchi-jjigae', name_en: 'Kimchi jjigae', name_ko: '김치찌개', description_en: 'A warming kimchi stew with tofu and savory broth.', description_ko: '김치와 두부를 넣고 끓인 찌개예요.', category: 'stew', ingredient_ids: ['tofu','broth','pork'], external_ingredient_ids: ['demo-kimchi'], ingredients_complete: false, source_note: 'Example recipe. Kimchi, broth and proteins vary by restaurant.' },
    { id: 'bulgogi', name_en: 'Bulgogi', name_ko: '불고기', description_en: 'Thinly sliced beef in a sweet and savory marinade.', description_ko: '얇게 썬 소고기를 양념한 요리예요.', category: 'rice', ingredient_ids: ['beef','soy-sauce','sesame-oil','vegetables'], external_ingredient_ids: [], ingredients_complete: false, source_note: 'Example recipe. Marinade ingredients vary.' },
    { id: 'tteokbokki', name_en: 'Tteokbokki', name_ko: '떡볶이', description_en: 'Chewy rice cakes in a rich, spicy sauce.', description_ko: '떡과 어묵을 매콤한 양념에 조린 음식이에요.', category: 'street', ingredient_ids: ['rice-cake','fish-cake','gochujang','broth'], external_ingredient_ids: [], ingredients_complete: false, source_note: 'Example recipe. Rice cakes, broth and toppings vary.' },
    { id: 'japchae', name_en: 'Japchae', name_ko: '잡채', description_en: 'Glass noodles tossed with vegetables and sesame oil.', description_ko: '당면과 채소를 양념해 볶은 음식이에요.', category: 'noodles', ingredient_ids: ['noodles','vegetables','soy-sauce','sesame-oil','egg'], external_ingredient_ids: [], ingredients_complete: false, source_note: 'Example recipe. Egg and meat may be added.' },
    { id: 'vegetable-rice', name_en: 'Vegetable rice', name_ko: '채소밥', description_en: 'Rice and vegetables. Ask about seasonings and sides.', description_ko: '밥과 채소 요리예요. 양념과 반찬도 확인하세요.', category: 'rice', ingredient_ids: ['rice','vegetables'], external_ingredient_ids: [], ingredients_complete: false, source_note: 'Example recipe. Seasonings, sides and preparation are unknown.' },
  ],
}
demoCatalog.ingredient_allergen_mapping = demoCatalog.ingredient_master.flatMap(i => i.global_allergens.map(allergen_id => ({ ingredient_id: i.id, allergen_id, evidence_status: 'needs_review' as const })))
