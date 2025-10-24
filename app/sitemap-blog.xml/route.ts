// /app/sitemap-blog.xml/route.ts
import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/actions/setting.actions';
import Blog from '@/lib/db/models/blog.model';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    await connectToDatabase();
    const { site: { url } } = await getSetting();
    const baseUrl = url && url.startsWith('https://hager-zon.vercel.app')
      ? url.replace(/\/+$/, '')
      : 'https://hager-zon.vercel.app';

    const blogs = await Blog.find({ isPublished: true })
      .select('slug updatedAt')
      .lean();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${blogs
    .map(
      (blog) => `
    <url>
      <loc>${baseUrl}/blog/${blog.slug}</loc>
      <lastmod>${blog.updatedAt ? new Date(blog.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.7</priority>
    </url>`
    )
    .join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error generating blog sitemap:', error);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}