import { motion } from "framer-motion";
import { ArrowLeft, Play, Clock, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const videos = [
  {
    id: 1,
    title: "Exploring the Canadian Rockies",
    description: "A breathtaking journey through the majestic mountains of Alberta.",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=340&fit=crop",
    duration: "12:34",
    views: "1.2K",
    category: "Travel",
  },
  {
    id: 2,
    title: "Coding Setup Tour 2024",
    description: "A peek into my development workspace and the tools I use daily.",
    thumbnail: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=340&fit=crop",
    duration: "8:45",
    views: "856",
    category: "Tech",
  },
  {
    id: 3,
    title: "Kerala Backwaters Documentary",
    description: "Revisiting my homeland and its beautiful waterways.",
    thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&h=340&fit=crop",
    duration: "15:20",
    views: "2.1K",
    category: "Travel",
  },
];

const Videos = () => {
  return (
    <main className="min-h-screen bg-gradient-subtle py-20 px-6">
      <div className="max-w-5xl mx-auto">
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
            My <span className="text-gradient">Videos</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            Travel vlogs, tech content, and stories from around the world.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video, index) => (
              <motion.article
                key={video.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.6 }}
                className="group bg-card rounded-2xl border border-border shadow-soft hover:shadow-glow transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-foreground/20 group-hover:bg-foreground/40 transition-colors flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={24} className="text-primary-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 px-2 py-1 bg-foreground/80 text-background text-xs font-medium rounded">
                    {video.duration}
                  </span>
                  <span className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
                    {video.category}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-display font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
                    {video.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {video.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {video.views} views
                    </span>
                  </div>
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
              More videos coming soon! Subscribe to stay updated.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
};

export default Videos;
