import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import AISection from "@/components/AISection";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main id="top" className="min-h-screen scroll-smooth">
      <Navbar />
      <Hero />
      <About />
      <AISection />
      <Contact />
      <Footer />
    </main>
  );
};

export default Index;
