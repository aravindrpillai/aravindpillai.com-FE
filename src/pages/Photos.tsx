import { motion } from "framer-motion";
import { ArrowLeft, Camera, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const photos = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
    title: "Mountain Sunrise",
    location: "Canadian Rockies",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&h=400&fit=crop",
    title: "Kerala Backwaters",
    location: "Kerala, India",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=400&fit=crop",
    title: "Forest Trail",
    location: "British Columbia",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=600&h=400&fit=crop",
    title: "Coastal Sunset",
    location: "Vancouver Island",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&h=400&fit=crop",
    title: "Morning Mist",
    location: "Lake Louise",
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&h=400&fit=crop",
    title: "Hidden Waterfall",
    location: "Banff National Park",
  },
];

const Photos = () => {
  return (
    <main className="min-h-screen bg-gradient-subtle py-20 px-6">
      <div className="max-w-6xl mx-auto">
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

          <div className="flex items-center gap-3 mb-4">
            <Camera className="text-primary" size={32} />
            <h1 className="text-4xl md:text-6xl font-display font-bold">
              Photo <span className="text-gradient">Gallery</span>
            </h1>
          </div>
          <p className="text-lg text-muted-foreground mb-12">
            Capturing moments from my travels around the world. Hit or miss, but always with love!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index, duration: 0.5 }}
                className="group relative overflow-hidden rounded-2xl shadow-soft hover:shadow-glow transition-all duration-500 cursor-pointer"
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="font-display font-semibold text-lg text-background">
                    {photo.title}
                  </h3>
                  <p className="flex items-center gap-1 text-sm text-background/80">
                    <MapPin size={14} />
                    {photo.location}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-12 text-center p-8 bg-card rounded-2xl border border-dashed border-border"
          >
            <p className="text-muted-foreground">
              More photos from my adventures coming soon!
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
};

export default Photos;
