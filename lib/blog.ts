import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

// Manually curated metadata for each post
const POST_META: Record<string, { description: string; date: string; category: string }> = {
  "government-grants-small-business-australia-guide": {
    description:
      "The complete guide to Australian government grants for small businesses in 2025–26. Types, timelines, top federal programs, and how to maximise your chances.",
    date: "2025-05-08",
    category: "Guides",
  },
  "how-to-apply-government-grant-australia": {
    description:
      "Step-by-step guide to applying for an Australian government grant. From eligibility checks to writing a winning application — with real examples.",
    date: "2025-05-10",
    category: "How-to",
  },
  "why-grant-application-rejected": {
    description:
      "The 5 most common reasons Australian grant applications are rejected — and exactly how to fix each one before you submit.",
    date: "2025-05-12",
    category: "How-to",
  },
  "tech-startup-grants-australia": {
    description:
      "Best grants for Australian tech startups in 2025–26: R&D Tax Incentive, CSIRO Kick-Start, Industry Growth Program, and more non-dilutive funding sources.",
    date: "2025-05-15",
    category: "Industry",
  },
  "agriculture-grants-australia": {
    description:
      "Government grants for Australian farmers and agribusinesses in 2025–26. Federal and state programs covering drought, innovation, water, and export.",
    date: "2025-05-17",
    category: "Industry",
  },
  "grants-for-tradies-construction-australia": {
    description:
      "Government grants available to Australian tradies and construction businesses in 2025–26: apprenticeships, equipment, energy efficiency, and more.",
    date: "2025-05-19",
    category: "Industry",
  },
  "export-grants-australia": {
    description:
      "Australian export grants and programs for 2025–26, including EMDG, Austrade support, and state export assistance. How to access non-dilutive funding to go global.",
    date: "2025-05-21",
    category: "Industry",
  },
  "nsw-government-grants-small-business": {
    description:
      "NSW government grants for small businesses in 2025–26. State and council programs for hiring, equipment, digital transformation, and energy efficiency.",
    date: "2025-05-23",
    category: "State",
  },
  "queensland-small-business-grants": {
    description:
      "Queensland government grants for small businesses in 2025–26. Advance Queensland, regional programs, apprenticeship incentives, and how to apply.",
    date: "2025-05-25",
    category: "State",
  },
  "victorian-government-grants-small-business": {
    description:
      "Victorian government grants for small businesses in 2025–26. Business Victoria programs, LaunchVic, energy grants, and regional funding opportunities.",
    date: "2025-05-27",
    category: "State",
  },
};

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readTime: number;
}

export interface BlogPostWithHtml extends BlogPost {
  contentHtml: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  return files
    .map((filename) => {
      const slug = filename.replace(".md", "");
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
      const { content } = matter(raw);

      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : slug;
      const wordCount = content.split(/\s+/).length;
      const readTime = Math.max(1, Math.round(wordCount / 200));

      const meta = POST_META[slug] ?? {
        description: title,
        date: "2025-05-01",
        category: "General",
      };

      return { slug, title, readTime, ...meta };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPostBySlug(slug: string): Promise<BlogPostWithHtml | null> {
  const filepath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, "utf8");
  const { content } = matter(raw);

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  const wordCount = content.split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const meta = POST_META[slug] ?? {
    description: title,
    date: "2025-05-01",
    category: "General",
  };

  const processedContent = await remark().use(remarkHtml).process(content);
  const contentHtml = processedContent.toString();

  return { slug, title, readTime, contentHtml, ...meta };
}
