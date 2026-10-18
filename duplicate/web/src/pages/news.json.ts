import { articles } from '../lib/content';
export async function GET() {
  const posts = (await articles()).slice(0,500).map(a => ({ id: a.legacyId || a._id, title: a.title,
    category: a.category.title, publishedAt: a.publishedAt, url: '/article/' + a.slug.current }));
  return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json' } });
}
