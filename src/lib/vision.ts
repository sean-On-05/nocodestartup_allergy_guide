import type { Dish } from './types'

export interface FoodCandidate { nameKo: string; nameEn: string }
export class VisionError extends Error {}

export async function preparePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50_000_000) throw new VisionError('invalid_image')
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new VisionError('invalid_image')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // Re-encoding removes embedded metadata; never send the original filename.
    const image = canvas.toDataURL('image/jpeg', 0.75)
    if (image.length > 2_500_000) throw new VisionError('image_too_large')
    return image
  } finally { bitmap.close() }
}

export async function recognizePhoto(file: File, signal: AbortSignal): Promise<FoodCandidate[]> {
  const image = await preparePhoto(file)
  signal.throwIfAborted()
  const response = await fetch('/api/recognize-food', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, consent: true }), signal,
  })
  const data = await response.json().catch(() => { throw new VisionError('recognition_failed') })
  if (!response.ok) throw new VisionError(typeof data.error === 'string' ? data.error : 'recognition_failed')
  if (data.isFood !== true || !Array.isArray(data.candidates) || !data.candidates.length) throw new VisionError('no_food')
  const candidates = data.candidates.slice(0, 3).filter((c: unknown): c is FoodCandidate => !!c && typeof c === 'object' && 'nameKo' in c && typeof c.nameKo === 'string' && 'nameEn' in c && typeof c.nameEn === 'string')
  if (!candidates.length) throw new VisionError('recognition_failed')
  return candidates
}

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '')
export function findRecipeOptions(dishes: Dish[], name: string): Dish[] {
  const key = normalize(name)
  if (key.length < 2) return []
  // These are suggestions only: no fuzzy or partial match is selected automatically.
  return dishes.map(dish => ({ dish, names: [normalize(dish.name_ko), normalize(dish.name_en)] }))
    .filter(({ names }) => names.some(n => n.includes(key)))
    .sort((a, b) => Number(b.names.includes(key)) - Number(a.names.includes(key)))
    .slice(0, 8).map(({ dish }) => dish)
}
