import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { recognizePhoto, VisionError } from '../lib/vision'
import type { FoodCandidate } from '../lib/vision'

export function PhotoRecognition({ photo, language, onRecognized }: { photo: File; language: 'en' | 'ko'; onRecognized: (candidates: FoodCandidate[]) => void }) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const t = (en: string, ko: string) => language === 'ko' ? ko : en
  useEffect(() => () => { active.current?.abort() }, [])
  const start = async () => {
    if (active.current || !consent) return
    const controller = new AbortController(); active.current = controller
    setBusy(true); setError('')
    const timeout = window.setTimeout(() => controller.abort('timeout'), 40_000)
    try {
      const candidates = await recognizePhoto(photo, controller.signal)
      if (!controller.signal.aborted) onRecognized(candidates)
    } catch (e) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return
      setError(controller.signal.aborted ? 'timeout' : e instanceof VisionError ? e.message : 'recognition_failed')
    } finally {
      clearTimeout(timeout)
      if (active.current === controller) { active.current = null; setBusy(false) }
    }
  }
  const errors: Record<string, string> = {
    quota_exceeded: t('The AI usage limit has been reached. No automatic retry or paid fallback. Enter the food name manually or try later.', 'AI 사용 한도에 도달했어요. 자동 재시도나 유료 모델 전환 없이 중단합니다. 음식명을 직접 입력하거나 나중에 다시 시도하세요.'),
    not_configured: t('Photo AI is not configured on this deployment. You can enter a food name manually.', '이 배포 환경에는 사진 AI가 설정되지 않았어요. 음식명을 직접 입력할 수 있어요.'),
    provider_configuration: t('The AI connection is unavailable. Please enter a food name manually.', 'AI 연결을 사용할 수 없어요. 음식명을 직접 입력해 주세요.'),
    no_food: t('No food name could be identified. Try a clear photo of one dish, or enter its name.', '음식명을 찾지 못했어요. 음식 하나가 잘 보이는 사진을 사용하거나 직접 입력해 주세요.'),
    timeout: t('Recognition took too long. Enter the name or try again later.', '인식 시간이 초과됐어요. 직접 입력하거나 나중에 다시 시도하세요.'),
    image_too_large: t('The photo is too large. Choose a smaller image.', '사진이 너무 커요. 더 작은 이미지를 선택해 주세요.'),
    invalid_image: t('This image could not be read. Choose another JPG, PNG or WEBP.', '이미지를 읽을 수 없어요. 다른 JPG, PNG, WEBP 사진을 선택해 주세요.'),
  }
  return <div className="photo-recognition" aria-busy={busy}>
    <label className="photo-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/><span>{t('Send this photo to Google Gemini to suggest food names.', '음식명 후보를 찾기 위해 이 사진을 Google Gemini로 전송합니다.')}</span></label>
    <p className="small muted">{t('Avoid photos with faces or personal information. Free-tier submissions may be used by Google to improve its products.', '얼굴이나 개인정보가 포함된 사진은 피해주세요. 무료 등급의 전송 내용은 Google 제품 개선에 사용될 수 있어요.')} <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">{t('Google terms', 'Google 이용 조건')}</a></p>
    <button className="button primary full" disabled={!consent || busy} onClick={start}>{busy ? <LoaderCircle size={18} className="spin"/> : <Sparkles size={18}/>} {busy ? t('Finding food names…', '음식명 후보를 찾는 중…') : t('Identify food with AI', 'AI로 음식명 찾기')}</button>
    {busy && <button className="text-button skip" onClick={() => { active.current?.abort(); active.current = null; setBusy(false) }}>{t('Cancel recognition', '인식 취소')}</button>}
    {error && <p className="field-error" role="alert">{errors[error] || t('Recognition failed. Try another photo or enter the name manually.', '인식하지 못했어요. 다른 사진을 사용하거나 음식명을 직접 입력해 주세요.')}</p>}
    <p className="small muted">{t('AI suggests names only. Confirm the dish before choosing a reference recipe.', 'AI는 음식명만 제안해요. 직접 확인한 후 참고 레시피를 선택하세요.')}</p>
  </div>
}
