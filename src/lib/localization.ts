import ingredientNames from '../../data/translations/ingredient-names.en.json'
import recipeNames from '../../data/translations/recipe-names.en.json'

export const hasKorean = (text: string) => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
function index(entries: Record<string, string>) {
  const result = new Map<string, string>()
  for (const [ko, en] of Object.entries(entries)) result.set(normalize(ko), en)
  return result
}
const ingredients = index(ingredientNames)
const recipes = index(recipeNames)
export function ingredientEnglish(name: string, supplied?: string): string {
  if (supplied?.trim() && !hasKorean(supplied)) return supplied
  return ingredients.get(normalize(name)) || (!hasKorean(name) ? name : 'Ingredient name awaiting translation')
}
export function recipeEnglish(name: string, supplied?: string): string {
  if (supplied?.trim() && !hasKorean(supplied)) return supplied
  return recipes.get(normalize(name)) || (!hasKorean(name) ? name : 'Recipe name awaiting translation')
}
const cuisines: Record<string, string> = { 한식:'Korean cuisine', 일식:'Japanese cuisine', 일본:'Japanese cuisine', 중식:'Chinese cuisine', 중국:'Chinese cuisine', 양식:'Western cuisine', 퓨전:'Fusion cuisine', 이탈리아:'Italian cuisine', 동남아시아:'Southeast Asian cuisine', 서양:'Western cuisine' }
export const cuisineEnglish = (name: string) => cuisines[name] || (!hasKorean(name) ? name : 'International cuisine')

const amountTerms: Record<string, string> = {
  '만드는법 참조':'see preparation instructions', 레서피참조:'see source recipe', 레시피참조:'see source recipe',
  '작은토막':'small piece', 작은거:'small item', 적당량:'as needed', 적량:'as needed', 약간:'a little', 조금:'a little',
  작은술:'tsp', 큰술:'tbsp', 덩어리:'chunk', 봉지:'bag', 줄기:'stem', 인분:'serving',
  공기:'rice bowl', 그릇:'bowl', 토막:'piece', 조각:'piece', 포기:'head', 묶음:'bunch', 뿌리:'root',
  마리:'whole', 큐브:'cube', 컵:'cup', 모:'block', 단:'bunch', 대:'stalk', 봉:'bag', 장:'sheet',
  쪽:'piece', 캔:'can', 통:'whole', 팩:'pack', 톨:'piece', 알:'piece', 잎:'leaf', 줄:'strip', 줌:'handful', 개:'item',
  되:'doe (source measure)', 관:'gwan (source measure)', 근:'geun (source measure)', 말:'mal (source measure)',
  각각:'each', 각:'each', 씩:'each', 한:'1', 반:'1/2', 약:'about', 大:'large',
}
const termPattern = new RegExp(Object.keys(amountTerms).sort((a,b)=>b.length-a.length).join('|'), 'g')
export function quantityEnglish(source: string): string {
  if (!source) return ''
  // Preserve source numbers and units; never guess conversions or repair source typos.
  const value = source.replace(/(\d)(과|와)(?=\s*\d|\s*½)/g,'$1 + ').replace(termPattern, word=>' '+amountTerms[word]+' ').replace(/\s+/g,' ').trim()
  return hasKorean(value) || /大/.test(value) ? 'See original amount' : value
}
export function guidanceEnglish(text: string): string {
  return text.replaceAll('밀떡','wheat-flour tteok').replaceAll('젓갈/액젓','fermented seafood / fish sauce')
}
