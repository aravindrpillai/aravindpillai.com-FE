import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const blogPosts = [
  {
    id: 1,
    title: "My Journey from Kerala to Canada",
    excerpt: "A tale of wanderlust, code, and finding home in unexpected places...",
    date: "2024-01-15",
    readTime: "5 min read",
    category: "Life",
  },
  {
    id: 2,
    title: "Why I Choose Science Over Faith",
    excerpt: "Exploring the beauty of the scientific method and rational thinking...",
    date: "2024-01-10",
    readTime: "8 min read",
    category: "Philosophy",
  },
  {
    id: 3,
    title: "Photography Tips from a Self-Proclaimed Amateur",
    excerpt: "What I've learned from years of 'hit or miss' photography adventures...",
    date: "2024-01-05",
    readTime: "6 min read",
    category: "Photography",
  },
];

const Blog = () => {
  return (
    <main className="min-h-screen bg-gradient-subtle py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>

          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">
            Blog & <span className="text-gradient">Articles</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            Thoughts, stories, and insights from my journey through code and life.
          </p>

          <div className="space-y-6">
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.6 }}
                className="group p-6 bg-card rounded-2xl border border-border shadow-soft hover:shadow-glow transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-3">
                      {post.category}
                    </span>
                    <h2 className="text-xl md:text-2xl font-display font-semibold mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    size={24}
                    className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
                  />
                </div>
              </motion.article>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-12 text-center p-8 bg-card rounded-2xl border border-dashed border-border"
          >
            <p className="text-muted-foreground">
              More articles coming soon! Stay tuned for updates.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
};

export default Blog;
