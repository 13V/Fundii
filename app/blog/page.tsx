import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Australian Government Grants Blog | Grant Base",
  description:
    "Guides, tips, and state-by-state breakdowns to help Australian small businesses find and win government grants. Updated for 2025–26.",
  alternates: { canonical: "https://grantbase.com.au/blog" },
  openGraph: {
    title: "Australian Government Grants Blog | Grant Base",
    description:
      "Guides, tips, and state-by-state breakdowns to help Australian small businesses find and win government grants.",
    url: "https://grantbase.com.au/blog",
    siteName: "Grant Base",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Guides:   "bg-teal-50 text-teal-600",
  "How-to": "bg-blue-50 text-blue-600",
  Industry: "bg-amber-50 text-amber-700",
  State:    "bg-purple-50 text-purple-700",
  General:  "bg-gray-100 text-gray-600",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Nav />

      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold tracking-widest text-[#0F7B6C] uppercase mb-3">Resources</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1A1A2E] leading-tight mb-4">
            Australian Grants Blog
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Practical guides to finding, applying for, and winning government grants for your Australian small business.
          </p>
        </div>

        {/* Posts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {posts.map((post) => {
            const catColor = CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.General;
            const dateStr = new Date(post.date).toLocaleDateString("en-AU", {
              day: "numeric", month: "long", year: "numeric",
            });
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-[#0F7B6C] hover:shadow-md transition-all no-underline flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${catColor}`}>
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{post.readTime} min read</span>
                </div>
                <h2 className="text-base font-bold text-[#1A1A2E] leading-snug mb-2 group-hover:text-[#0F7B6C] transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4">
                  {post.description}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-gray-400">{dateStr}</span>
                  <span className="text-sm font-semibold text-[#0F7B6C]">Read →</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-br from-[#0F7B6C] to-[#0a5c51] rounded-3xl p-10 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-widest mb-3 text-white/70">Ready to find your grants?</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
            Stop reading. Start matching.
          </h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            Answer 5 questions and see every grant your business qualifies for — right now, for free.
          </p>
          <Link
            href="/quiz"
            className="inline-block px-8 py-3.5 rounded-xl bg-white text-[#0F7B6C] font-bold text-sm no-underline hover:bg-[#E6F5F2] transition-colors"
          >
            Find My Grants →
          </Link>
        </div>
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
