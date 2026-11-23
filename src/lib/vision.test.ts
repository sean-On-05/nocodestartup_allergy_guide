import test from 'node:test'
import assert from 'node:assert/strict'
import { findRecipeOptions } from './vision'
import type { Dish } from './types'

test('reference options preserve distinct recipes and rank exact names first', () => {
  const dishes = [
    { id: 'a', name_ko: '참치김치찌개', name_en: 'Tuna stew' },
    { id: 'b', name_ko: '김치찌개', name_en: 'Kimchi jjigae' },
    { id: 'c', name_ko: '김치찌개', name_en: 'Kimchi stew' },
    { id: 'd', name_ko: '된장찌개', name_en: 'Soybean stew' },
  ] as Dish[]
  assert.deepEqual(findRecipeOptions(dishes, '김치 찌개').map(d=>d.id), ['b','c','a'])
  assert.deepEqual(findRecipeOptions(dishes, 'KIMCHI JJIGAE').map(d=>d.id), ['b'])
  assert.deepEqual(findRecipeOptions(dishes, 'zzzz'), [])
  assert.deepEqual(findRecipeOptions(dishes, ''), [])
})
