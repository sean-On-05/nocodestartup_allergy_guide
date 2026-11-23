import { useEffect, useState } from 'react'
import { Cloud, LogIn, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { googleAvailable } from '../lib/auth'
import { loadProfile } from '../lib/profile'
import type { AccountState } from '../lib/useAccountProfile'
import type { Language } from '../lib/types'

export function AccountPanel({ account, language, editProfile }: { account: AccountState; language: Language; editProfile: () => void }) {
  const [google, setGoogle] = useState<boolean | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [consent, setConsent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const t = (en: string, ko: string) => language === 'ko' ? ko : en
  const guest = loadProfile()
  useEffect(() => {
    const controller = new AbortController()
    setGoogle(null); setCheckFailed(false)
    googleAvailable(controller.signal).then(value => { if (!controller.signal.aborted) setGoogle(value) }).catch(() => { if (!controller.signal.aborted) setCheckFailed(true) })
    return () => controller.abort()
  }, [retry])
  const status = account.cloudStatus === 'saving' ? t('Saving to your account…', '계정에 저장 중…')
    : account.cloudStatus === 'loading' ? t('Loading your saved allergies…', '계정의 알레르기를 불러오는 중…')
    : account.cloudStatus === 'saved' ? t('Saved to your account.', '계정에 저장했어요.')
    : account.cloudStatus === 'error' ? t('Could not sync. Changes on this screen are not saved to your account.', '동기화하지 못했어요. 이 화면의 변경사항은 계정에 저장되지 않았습니다.')
    : t('Your saved account profile is ready.', '계정의 설정을 사용할 수 있어요.')
  return <section className="panel account-panel">
    <div className="section-label"><UserRound size={20}/>{t('YOUR ACCOUNT', '내 계정')}</div>
    {!account.authReady ? <p role="status">{t('Checking login…', '로그인 상태 확인 중…')}</p> : account.user ? <>
      <h2>{t('Your allergies, across devices.', '다른 기기에서도 내 알레르기를.')}</h2>
      <p className="account-email">{account.user.email || t('Signed in', '로그인됨')}</p>
      <div className={'inline-note '+(account.cloudStatus === 'error' ? 'account-sync-error' : '')} role="status"><Cloud size={19}/><p>{status}</p></div>
      {account.cloudStatus === 'error' && <button className="button secondary" onClick={() => account.loaded ? void account.update(account.profile) : account.reload()}>{t('Retry sync', '동기화 다시 시도')}</button>}
      <p>{t('Only you can read and edit your account’s allergy settings. Guest settings stay separate. Photos are not saved to your account.', '계정의 알레르기 설정은 본인만 조회·수정할 수 있어요. 비로그인 설정과는 별도로 관리하며 사진은 계정에 저장하지 않습니다.')}</p>
      <button className="button primary full" disabled={!account.canEdit || account.cloudStatus === 'saving'} onClick={editProfile}>{t('Edit my allergy settings', '내 알레르기 설정 수정')}</button>
      {(guest.allergens.length > 0 || guest.other) && <div className="account-import">
        {!confirmImport ? <button className="text-button" disabled={!account.canEdit || account.cloudStatus === 'saving'} onClick={() => setConfirmImport(true)}>{t('Import this browser’s guest settings', '이 브라우저의 비로그인 설정 가져오기')}</button> : <>
          <p>{t('Replace the account’s current allergies with this browser’s guest settings? This uploads those allergy details to your account.', '현재 계정의 알레르기를 이 브라우저의 비로그인 설정으로 바꿀까요? 해당 알레르기 정보가 계정으로 업로드됩니다.')}</p>
          <button className="button secondary" disabled={!account.canEdit || account.cloudStatus === 'saving'} onClick={async () => { if (await account.update({ ...guest, language, completed: true })) setConfirmImport(false) }}>{t('Import & replace', '가져와서 바꾸기')}</button>
          <button className="text-button" onClick={() => setConfirmImport(false)}>{t('Cancel', '취소')}</button>
        </>}
      </div>}
      <div className="account-actions"><button className="button secondary" disabled={account.authBusy} onClick={account.signOut}><LogOut size={17}/>{t('Log out on this device', '이 기기에서 로그아웃')}</button></div>
      <div className="account-delete">
        {!confirmDelete ? <button className="text-button danger" disabled={account.authBusy} onClick={() => setConfirmDelete(true)}><Trash2 size={16}/>{t('Delete account', '계정 탈퇴')}</button> : <>
          <p>{t('Permanently delete your account and saved allergy settings? This cannot be undone. Guest settings in this browser will remain.', '계정과 계정에 저장한 알레르기를 영구 삭제할까요? 되돌릴 수 없습니다. 이 브라우저의 비로그인 설정은 유지됩니다.')}</p>
          <button className="button danger-button" disabled={account.authBusy || account.cloudStatus === 'saving'} onClick={account.deleteAccount}>{t('Delete my account permanently', '계정 영구 삭제')}</button>
          <button className="text-button" disabled={account.authBusy} onClick={() => setConfirmDelete(false)}>{t('Cancel', '취소')}</button>
        </>}
      </div>
    </> : <>
      <h2>{t('Keep your allergy settings with you.', '내 알레르기 설정을 어디서나.')}</h2>
      <p>{t('Log in to save allergy settings to your account and load them on another device. Food search and photo recognition are available without an account.', '로그인하면 알레르기 설정을 계정에 저장하고 다른 기기에서도 불러올 수 있어요. 음식 검색과 사진 인식은 로그인 없이 이용할 수 있습니다.')}</p>
      <label className="photo-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{t('I agree to store my selected allergies and allergy notes in my account when I save them. I can clear them or delete my account.', '저장 버튼을 누르면 선택한 알레르기와 메모가 계정에 저장되는 것에 동의합니다. 설정 삭제와 계정 탈퇴가 가능합니다.')}</span></label>
      <button className="button primary full" disabled={!consent || !google || !account.configured || account.authBusy} onClick={account.signIn}><LogIn size={18}/>{t('Continue with Google', 'Google로 로그인')}</button>
      {google === false && <p className="small muted" role="status">{t('Google login is being set up. Continue as a guest for now.', 'Google 로그인 설정을 준비 중이에요. 지금은 비로그인으로 이용할 수 있습니다.')}</p>}
      {google === null && !checkFailed && <p className="small muted" role="status">{t('Checking Google login availability…', 'Google 로그인 사용 가능 여부 확인 중…')}</p>}
      {checkFailed && <p className="field-error" role="alert">{t('Could not check the login connection.', '로그인 연결을 확인하지 못했어요.')}</p>}
      {(google === false || checkFailed) && <button className="text-button" onClick={() => setRetry(n => n + 1)}>{t('Check again', '다시 확인')}</button>}
      <div className="privacy-note"><ShieldCheck size={17}/><span>{t('Google handles your login. We do not receive your Google password. Guest allergies are not uploaded automatically.', 'Google에서 로그인하며 비밀번호를 받지 않습니다. 비로그인 알레르기는 자동 업로드하지 않습니다.')}</span></div>
    </>}
    {account.authError && <p className="field-error" role="alert">{account.authError === 'delete_failed' ? t('Account deletion failed. Your account has not been confirmed deleted. Try again or contact support.', '계정 삭제에 실패했어요. 삭제가 확인되지 않았습니다. 다시 시도해 주세요.') : t('The account action could not be completed. Check your connection and try again.', '계정 작업을 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.')}</p>}
  </section>
}
