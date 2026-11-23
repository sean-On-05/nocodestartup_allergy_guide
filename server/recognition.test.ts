import test from 'node:test'
import assert from 'node:assert/strict'
import { APICallError } from 'ai'
import { handleRecognition, MODEL } from './recognition'

const image = 'data:image/jpeg;base64,' + Buffer.from([255,216,255,...Array(20).fill(0)]).toString('base64')
const request = (body: unknown = { image, consent: true }) => new Request('https://food.test/api/recognize-food', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://food.test' }, body: JSON.stringify(body) })
test('rejects missing consent, remote URLs and forged MIME signatures before invoking AI', async () => {
  let calls = 0
  const run = async () => { calls++; return { isFood: true, candidates: [] } }
  for (const body of [{ image }, { image, consent: false }, { image: 'https://private.test/image.jpg', consent: true }, { image: image.replace('jpeg','png'), consent: true }]) assert.equal((await handleRecognition(request(body), run, true)).status, 400)
  assert.equal(calls, 0)
})
test('rejects cross-origin and oversized requests without provider calls', async () => {
  const cross = request(); cross.headers.set('origin', 'https://other.test')
  assert.equal((await handleRecognition(cross, undefined, true)).status, 403)
  const large = request(); large.headers.set('content-length', '3000000')
  assert.equal((await handleRecognition(large, undefined, true)).status, 413)
})
test('configuration probe is private-cache-free and exposes no credentials', async () => {
  const res = await handleRecognition(new Request('https://food.test/api/recognize-food'), undefined, false)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await res.json(), { configured: false, model: MODEL })
  assert.equal((await handleRecognition(request(), undefined, false)).status, 503)
})
test('returns only validated names, and strips candidates when image is not food', async () => {
  const res = await handleRecognition(request(), async () => ({ isFood: true, candidates: [{ nameKo: '비빔밥', nameEn: 'Bibimbap', allergens: ['egg'] } as never] }), true)
  assert.deepEqual(await res.json(), { isFood: true, candidates: [{ nameKo: '비빔밥', nameEn: 'Bibimbap' }], model: MODEL })
  const other = await handleRecognition(request(), async () => ({ isFood: false, candidates: [{ nameKo: '비빔밥', nameEn: 'Bibimbap' }] }), true)
  assert.deepEqual((await other.json()).candidates, [])
})
test('quota errors stop after one call, never disclose provider error text', async () => {
  let calls = 0
  const res = await handleRecognition(request(), async () => {
    calls++
    throw new APICallError({ message: 'private-provider-detail', url: 'https://provider.test', requestBodyValues: {}, statusCode: 429, responseBody: 'private' })
  }, true)
  assert.equal(calls, 1); assert.equal(res.status, 429)
  assert.deepEqual(await res.json(), { error: 'quota_exceeded' })
})
test('malformed or excessive model candidates fail closed', async () => {
  const res = await handleRecognition(request(), async () => ({ isFood: true, candidates: Array(4).fill({ nameKo: '밥', nameEn: 'Rice' }) }), true)
  assert.equal(res.status, 502)
})
test('real SDK serializes an inline image to direct Google provider; retries stay disabled', async () => {
  const original = globalThis.fetch
  const originalKey = process.env.GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'test-only-placeholder'
  let calls = 0
  try {
    globalThis.fetch = async (url, init) => {
      calls++
      assert.match(String(url), /generativelanguage\.googleapis\.com/)
      assert.ok(String(url).includes(MODEL))
      const sent = JSON.parse(String(init?.body))
      assert.ok(sent.contents[0].parts.some((p: { inlineData?: unknown }) => p.inlineData))
      return Response.json({ error: { code: 429, message: 'quota exceeded' } }, { status: 429 })
    }
    assert.equal((await handleRecognition(request())).status, 429)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = original
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey
  }
})
