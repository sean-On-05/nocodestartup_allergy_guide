import { useEffect, useState } from 'react'
import { Cloud, LogIn, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { emailAvailable } from '../lib/auth'
import { loadProfile } from '../lib/profile'
import type { AccountState } from '../lib/useAccountProfile'
import type { Language } from '../lib/types'

export function AccountPanel({ account, language, editProfile }: { account: AccountState; language: Language; editProfile: () => void }) {
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [consent, setConsent] = useState(false)
  const [mode, setMode] = useState<'signin'|'signup'|'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(n => n - 1),1000);return () => clearTimeout(timer) }, [cooldown])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const t = (en: string, ko: string) => language === 'ko' ? ko : en
  const guest = loadProfile()
  useEffect(() => {
    const controller = new AbortController()
    setEmailEnabled(null); setCheckFailed(false)
    emailAvailable(controller.signal).then(value => { if (!controller.signal.aborted) setEmailEnabled(value) }).catch(() => { if (!controller.signal.aborted) setCheckFailed(true) })
    return () => controller.abort()
  }, [retry])
  const status = account.cloudStatus === 'saving' ? t('Saving to your account…', '계정에 저장 중…')
    : account.cloudStatus === 'loading' ? t('Loading your saved allergies…', '계정의 알레르기를 불러오는 중…')
    : account.cloudStatus === 'saved' ? t('Saved to your account.', '계정에 저장했어요.')
    : account.cloudStatus === 'error' ? t('Could not sync. Changes on this screen are not saved to your account.', '동기화하지 못했어요. 이 화면의 변경사항은 계정에 저장되지 않았습니다.')
    : t('Your saved account profile is ready.', '계정의 설정을 사용할 수 있어요.')
  return <section className="panel account-panel">
    <div className="section-label"><UserRound size={20}/>{t('YOUR ACCOUNT', '내 계정')}</div>
    {!account.authReady ? <p role="status">{t('Checking login…', '로그인 상태 확인 중…')}</p> : account.user && account.passwordRecovery ? <><h2>{t('Set a new password','새 비밀번호 설정')}</h2><form onSubmit={async e=>{e.preventDefault();if(await account.changePassword(password)){setPassword('');setMessage(t('Password updated.','비밀번호를 변경했어요.'))}}}><label className="field-label" htmlFor="recovery-password">{t('New password','새 비밀번호')}</label><input id="recovery-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="button primary full" disabled={account.authBusy}>{t('Save new password','새 비밀번호 저장')}</button></form></> : account.user ? <>
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
      <div className="account-auth-modes" role="group" aria-label={t('Login options','로그인 방식')}>
        <button type="button" className={'button secondary '+(mode==='signin'?'candidate-selected':'')} disabled={account.authBusy} aria-pressed={mode==='signin'} onClick={()=>{setMode('signin');setPassword('');setMessage('')}}>{t('Log in','로그인')}</button>
        <button type="button" className={'button secondary '+(mode==='signup'?'candidate-selected':'')} disabled={account.authBusy} aria-pressed={mode==='signup'} onClick={()=>{setMode('signup');setPassword('');setMessage('')}}>{t('Create account','회원가입')}</button>
      </div>
      <form onSubmit={async e=>{
        e.preventDefault();setMessage('')
        const result=await account.emailAction(mode,email,password)
        setPassword('')
        if(result==='check_email'){
          setMessage(mode==='reset'?t('If this email has an account, a password reset link will be sent. Check your inbox and spam folder.','가입된 이메일이면 비밀번호 재설정 링크가 발송됩니다. 받은편지함과 스팸함을 확인해 주세요.'):t('Check your inbox and spam folder for a confirmation link. After confirming, return here and log in. If you already have an account, use Log in.','받은편지함과 스팸함에서 확인 링크를 누른 뒤 로그인해 주세요. 이미 가입했다면 로그인을 이용하세요.'))
          setCooldown(60)
        }
      }}>
        <fieldset className="allergy-fieldset" disabled={account.authBusy}>
          <label className="field-label" htmlFor="account-email">{t('Email','이메일')}</label>
          <input id="account-email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
          {mode!=='reset'&&<><label className="field-label" htmlFor="account-password">{t('Password','비밀번호')}</label><input id="account-password" type="password" required minLength={mode==='signup'?8:undefined} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='signup'&&<p className="small muted">{t('Use at least 8 characters. Confirm your email before logging in.','8자 이상 입력하세요. 가입 후 이메일을 확인해야 로그인할 수 있습니다.')}</p>}</>}
          {mode!=='reset'&&<label className="photo-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t('I agree to store my selected allergies and allergy notes in my account when I save them. I can clear them or delete my account.', '저장 버튼을 누르면 선택한 알레르기와 메모가 계정에 저장되는 것에 동의합니다. 설정 삭제와 계정 탈퇴가 가능합니다.')}</span></label>}
          <button className="button primary full" type="submit" disabled={(mode!=='reset'&&!consent)||!emailEnabled||!account.configured||(mode!=='signin'&&cooldown>0)}><LogIn size={18}/>{account.authBusy?t('Please wait…','처리 중…'):mode==='signup'?t('Sign up with email','이메일로 회원가입'):mode==='reset'?t('Send reset link','재설정 링크 보내기'):t('Log in with email','이메일로 로그인')}</button>
        </fieldset>
      </form>
      <div className="account-email-tools">
        <button className="text-button" disabled={account.authBusy} onClick={()=>{setMode(mode==='reset'?'signin':'reset');setPassword('');setMessage('')}}>{mode==='reset'?t('Back to login','로그인으로 돌아가기'):t('Forgot password?','비밀번호를 잊으셨나요?')}</button>
        {mode!=='reset'&&<button className="text-button" disabled={account.authBusy||!emailEnabled||!email||cooldown>0} onClick={async()=>{
          const input=document.querySelector<HTMLInputElement>('#account-email');if(!input?.reportValidity())return
          if(await account.emailAction('resend',email)){setMessage(t('If confirmation is needed, check your email for a new link.','인증이 필요한 계정이면 확인 메일을 다시 받을 수 있어요. 메일함을 확인해 주세요.'));setCooldown(60)}
        }}>{t('Resend confirmation email','가입 확인 메일 다시 보내기')}{cooldown>0?` (${cooldown}s)`:''}</button>}
      </div>
      {message&&<p className="inline-note" role="status">{message}</p>}
      {emailEnabled===false&&<p className="small muted" role="status">{t('Email login is unavailable. Continue as a guest for now.','이메일 로그인을 사용할 수 없어요. 지금은 비로그인으로 이용할 수 있습니다.')}</p>}
      {emailEnabled===null&&!checkFailed&&<p className="small muted" role="status">{t('Checking email login availability…','이메일 로그인 사용 가능 여부 확인 중…')}</p>}
      {checkFailed&&<p className="field-error" role="alert">{t('Could not check the login connection.','로그인 연결을 확인하지 못했어요.')}</p>}
      {(emailEnabled===false||checkFailed)&&<button className="text-button" onClick={()=>setRetry(n=>n+1)}>{t('Check again','다시 확인')}</button>}
      <div className="privacy-note"><ShieldCheck size={17}/><span>{t('Supabase handles authentication. Passwords are not stored in your allergy profile. Guest allergies are not uploaded automatically.','인증은 Supabase에서 처리하며 알레르기 프로필에 비밀번호를 저장하지 않습니다. 비로그인 알레르기는 자동 업로드하지 않습니다.')}</span></div>
    </>}
    {account.authError&&<p className="field-error" role="alert">{({
      invalid_credentials:t('Email or password is incorrect.','이메일 또는 비밀번호가 올바르지 않아요.'),
      email_not_confirmed:t('Confirm your email first, then log in. You can resend the confirmation email below.','먼저 가입 확인 메일의 링크를 눌러주세요. 확인 메일을 다시 보낼 수 있습니다.'),
      weak_password:t('Choose a stronger password with at least 8 characters.','8자 이상의 더 강력한 비밀번호를 사용해 주세요.'),
      email_address_invalid:t('Enter a valid email address.','올바른 이메일 주소를 입력해 주세요.'),
      email_address_not_authorized:t('Email delivery is restricted. Please contact the service administrator.','현재 메일 발송이 제한되어 있어요. 서비스 관리자에게 문의해 주세요.'),
      rate_limited:t('Too many attempts. Wait a while before trying again.','요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'),
      over_email_send_rate_limit:t('Email sending limit reached. Wait before requesting another email.','메일 발송 한도에 도달했어요. 잠시 기다린 뒤 요청해 주세요.'),
      over_request_rate_limit:t('Too many attempts. Please try later.','요청이 너무 많아요. 나중에 다시 시도하세요.'),
      signup_disabled:t('New account registration is unavailable.','현재 새 회원가입을 사용할 수 없어요.'),
      email_provider_disabled:t('Email login is unavailable.','현재 이메일 로그인을 사용할 수 없어요.'),
      delete_failed:t('Account deletion failed. Your account has not been confirmed deleted. Try again.','계정 삭제에 실패했어요. 삭제가 확인되지 않았습니다. 다시 시도해 주세요.'),
    } as Record<string,string>)[account.authError]||t('The account action could not be completed. Check your connection and try again.','계정 작업을 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.')}</p>}
  </section>
}
