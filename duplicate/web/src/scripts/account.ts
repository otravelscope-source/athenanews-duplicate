import { supabase } from '../lib/supabase';
const notice = document.querySelector<HTMLElement>('#notice')!;
const say = (message: string) => { notice.textContent = message; };
const checked = (error: {message: string} | null) => { if (error) throw new Error(error.message); };
const run = async (task: () => Promise<void>) => { try { await task(); } catch(e) { say(e instanceof Error ? e.message : 'Please try again.'); } };
const redirectTo = location.origin + '/account';
async function refresh() {
  const { data, error } = await supabase.auth.getUser();
  const user = !error ? data.user : null;
  document.querySelector<HTMLElement>('#signed-in')!.hidden = !user;
  document.querySelector<HTMLElement>('#signed-out')!.hidden = !!user;
  if (!user) return;
  document.querySelector<HTMLElement>('#identity')!.textContent = user.email || '';
  const profile = await supabase.from('profiles').select('sections').eq('id', user.id).single();
  checked(profile.error);
  document.querySelector<HTMLInputElement>('#preferences input')!.value = profile.data!.sections.join(', ');
  const response = await fetch('/news.json');
  if (!response.ok) throw new Error('Unable to load your news feed');
  const posts = (await response.json()).slice(0,500);
  const history = await supabase.rpc('read_articles', { article_ids: posts.map((x: any) => x.id) });
  checked(history.error);
  document.querySelector<HTMLElement>('#history-count')!.textContent = String(history.data?.length || 0) + ' stories in the current feed marked as read.';
  const seen = new Set((history.data || []).map((x: any) => x.article_id));
  const feed = document.querySelector<HTMLElement>('#reader-feed')!;
  feed.replaceChildren();
  for (const post of posts) {
    if (!profile.data!.sections.includes(post.category) || !/^\/article\/[a-zA-Z0-9_-]+$/.test(post.url)) continue;
    const row = document.createElement('li');
    const link = document.createElement('a'); link.href = post.url; link.textContent = post.title; row.append(link);
    if (!seen.has(post.id)) {
      const button = document.createElement('button'); button.textContent = 'Mark as read';
      button.addEventListener('click', () => void run(async () => {
        checked((await supabase.from('reader_reads').upsert({ user_id: user.id, article_id: post.id }, { onConflict: 'user_id,article_id', ignoreDuplicates: true })).error);
        await refresh();
      })); row.append(' ',button);
    }
    feed.append(row);
  }
}
document.querySelector('#credentials')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const action = ((event as SubmitEvent).submitter as HTMLButtonElement)?.value;
  const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
  const password = (form.elements.namedItem('password') as HTMLInputElement).value;
  void run(async () => {
    if (action === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
      checked(error); say('Check your email to confirm your account.');
    } else if (action === 'recover') {
      if (!email) throw new Error('Enter your email address first.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      checked(error); say('If this account exists, a password-reset email has been requested.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      checked(error); say('Signed in.');
    }
    await refresh();
  });
});
document.querySelector('#google')?.addEventListener('click', () => void run(async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }); checked(error);
}));
document.querySelector('#logout')?.addEventListener('click', () => void run(async () => { checked((await supabase.auth.signOut()).error); await refresh(); say('Signed out.'); }));
document.querySelector('#preferences')?.addEventListener('submit', event => {
  event.preventDefault();
  void run(async () => {
    const { data, error } = await supabase.auth.getUser(); checked(error);
    const sections = [...new Set(document.querySelector<HTMLInputElement>('#preferences input')!.value.split(',').map(x => x.trim()).filter(Boolean))];
    checked((await supabase.from('profiles').update({sections}).eq('id', data.user!.id)).error); say('Preferences saved.');
  });
});
document.querySelector('#claim')?.addEventListener('submit', event => {
  event.preventDefault();
  void run(async () => { const recovery_code = document.querySelector<HTMLInputElement>('#claim input')!.value.trim();
    checked((await supabase.rpc('claim_legacy_reader', { recovery_code })).error);
    document.querySelector<HTMLInputElement>('#claim input')!.value = ''; say('Your reader data has been restored.'); await refresh();
  });
});
document.querySelector('#password')?.addEventListener('submit', event => {
  event.preventDefault(); void run(async () => {
    const password = document.querySelector<HTMLInputElement>('#password input')!.value;
    checked((await supabase.auth.updateUser({ password })).error); say('Password saved.');
    document.querySelector<HTMLInputElement>('#password input')!.value = '';
  });
});
document.querySelector('#delete-account')?.addEventListener('click', () => {
  if (!confirm('Permanently delete your ATHENA reader account and reading history?')) return;
  void run(async () => { checked((await supabase.rpc('delete_my_reader_account')).error); await supabase.auth.signOut(); await refresh(); say('Reader account deleted.'); });
});
supabase.auth.onAuthStateChange(() => { setTimeout(() => void run(refresh), 0); });
void run(refresh);
