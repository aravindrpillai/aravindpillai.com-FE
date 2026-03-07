import Hero from "@/components/Hero";
import About from "@/components/About";
import AISection from "@/components/AISection";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <Hero />
      <About />
      <AISection />
      <Contact />
      <Footer />
    </main>
  );
};

export default Index;
