import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { accountProfileSchema, authRedirect, authErrorCode } from './auth'

const migration = await readFile(new URL('../../supabase/migrations/202611230001_account_profiles.sql', import.meta.url), 'utf8')
const a = '00000000-0000-0000-0000-000000000001'
const b = '00000000-0000-0000-0000-000000000002'
test('account profile schema rejects oversized or malformed allergy data; callback stays on origin', () => {
  assert.equal(accountProfileSchema.safeParse({ language: 'ko', allergens: ['Shrimp'], other: '', completed: true }).success, true)
  assert.equal(accountProfileSchema.safeParse({ language: 'ko', allergens: Array(101).fill('Shrimp'), other: '', completed: true }).success, false)
  assert.equal(accountProfileSchema.safeParse({ language: 'ko', allergens: [], other: 'a'.repeat(121), completed: true }).success, false)
  assert.equal(authRedirect('https://kfood-allergy-guide.vercel.app'), 'https://kfood-allergy-guide.vercel.app/?auth=callback')
})
test('private profile RLS isolates two users; anonymous access denied; self-deletion cascades only own data', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users values ('${a}'),('${b}');
    `)
    await db.exec(migration); await db.exec(migration)
    await db.exec(`set role anon`)
    await assert.rejects(db.query('select * from public.kfood_user_profiles'), /permission denied/)
    await assert.rejects(db.query('select public.kfood_delete_my_account()'), /permission denied/)
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${a}'`)
    await db.query(`insert into public.kfood_user_profiles(user_id,allergens) values ($1,array['Shrimp'])`, [a])
    await assert.rejects(db.query(`insert into public.kfood_user_profiles(user_id) values ($1)`, [b]), /row-level security/)
    await assert.rejects(db.query(`update public.kfood_user_profiles set user_id=$1 where user_id=$2`, [b,a]), /row-level security/)
    await db.exec(`set request.jwt.claim.sub='${b}'`)
    assert.equal((await db.query('select * from public.kfood_user_profiles')).rows.length, 0)
    await db.query(`insert into public.kfood_user_profiles(user_id,allergens) values ($1,array['Milk'])`, [b])
    assert.equal((await db.query('update public.kfood_user_profiles set allergens=array[]::text[] where user_id=$1 returning user_id', [a])).rows.length, 0)
    assert.equal((await db.query('delete from public.kfood_user_profiles where user_id=$1 returning user_id', [a])).rows.length, 0)
    await assert.rejects(db.query('delete from auth.users where id=$1', [a]), /permission denied/)
    await db.exec(`set request.jwt.claim.sub=''`)
    await assert.rejects(db.query('select public.kfood_delete_my_account()'), /Authentication required/)
    await db.exec(`set request.jwt.claim.sub='${a}'`)
    await db.query('select public.kfood_delete_my_account()')
    await db.exec('reset role')
    assert.deepEqual((await db.query('select id from auth.users')).rows, [{ id: b }])
    assert.deepEqual((await db.query('select user_id from public.kfood_user_profiles')).rows, [{ user_id: b }])
  } finally { await db.close() }
})

test('email authentication errors are normalized without exposing raw provider details',()=>{
  assert.equal(authErrorCode({code:'invalid_credentials',message:'private detail'}),'invalid_credentials')
  assert.equal(authErrorCode({status:429,message:'private detail'}),'rate_limited')
  assert.equal(authErrorCode({code:'internal_code',message:'private detail'}),'auth_failed')
  assert.equal(authErrorCode(null),'auth_failed')
})
