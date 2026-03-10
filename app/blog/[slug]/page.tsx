import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  const url = `https://grantbase.com.au/blog/${post.slug}`;
  return {
    title: `${post.title} | Grant Base`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: "Grant Base",
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const related = allPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  const dateStr = new Date(post.date).toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "Grant Base",
      url: "https://grantbase.com.au",
    },
    publisher: {
      "@type": "Organization",
      name: "Grant Base",
      url: "https://grantbase.com.au",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://grantbase.com.au/blog/${post.slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Nav />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#0F7B6C] no-underline transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-[#0F7B6C] no-underline transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{post.title}</span>
        </nav>

        {/* Article header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4 text-sm text-gray-400">
            <span className="bg-teal-50 text-[#0F7B6C] text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {post.category}
            </span>
            <span>{dateStr}</span>
            <span>·</span>
            <span>{post.readTime} min read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E] leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">{post.description}</p>
        </header>

        {/* Inline CTA */}
        <div className="bg-[#E6F5F2] border border-[#A7D7D0] rounded-2xl px-6 py-4 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#0F7B6C] text-sm">Find grants matched to your business</p>
            <p className="text-gray-600 text-xs mt-0.5">Answer 5 questions — see every grant you qualify for, instantly.</p>
          </div>
          <Link
            href="/quiz"
            className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-[#0F7B6C] text-white font-bold text-sm no-underline hover:bg-[#0a6159] transition-colors"
          >
            Take the Quiz →
          </Link>
        </div>

        {/* Article body */}
        <article
          className="prose prose-lg prose-headings:text-[#1A1A2E] prose-h1:hidden prose-a:text-[#0F7B6C] prose-a:no-underline hover:prose-a:underline prose-strong:text-[#1A1A2E] prose-code:text-[#0F7B6C] prose-hr:border-gray-200 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* Bottom CTA */}
        <div className="mt-14 bg-gradient-to-br from-[#0F7B6C] to-[#0a5c51] rounded-3xl p-10 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-widest mb-3 text-white/70">
            Your next step
          </p>
          <h2 className="text-2xl font-extrabold mb-3">
            See which grants match your business right now
          </h2>
          <p className="text-white/80 mb-6 max-w-sm mx-auto text-sm">
            3,900+ Australian grants. 5 questions. Free to use — takes 2 minutes.
          </p>
          <Link
            href="/quiz"
            className="inline-block px-8 py-3.5 rounded-xl bg-white text-[#0F7B6C] font-bold text-sm no-underline hover:bg-[#E6F5F2] transition-colors"
          >
            Find My Grants →
          </Link>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-14">
            <h3 className="text-lg font-bold text-[#1A1A2E] mb-5">More guides</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-[#0F7B6C] transition-colors no-underline"
                >
                  <p className="text-xs text-gray-400 mb-1">{p.category} · {p.readTime} min</p>
                  <p className="text-sm font-semibold text-[#1A1A2E] leading-snug group-hover:text-[#0F7B6C] transition-colors">
                    {p.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="text-center py-10 text-sm text-gray-400">
        <Link href="/" className="font-bold text-[#1A1A2E] no-underline">Grant<span className="text-[#0F7B6C]">Base</span></Link>
        {" · "}
        <Link href="/blog" className="no-underline hover:underline">Blog</Link>
        {" · "}
        <Link href="/quiz" className="no-underline hover:underline">Find Grants</Link>
      </footer>
    </div>
  );
}
