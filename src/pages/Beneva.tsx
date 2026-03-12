import { MessageCircle } from "lucide-react";

const Beneva = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Header */}
      <header className="bg-[#00B140] text-white py-4 px-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">Beneva</h1>
        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <span className="hover:underline cursor-pointer">Insurance</span>
          <span className="hover:underline cursor-pointer">Financial Services</span>
          <span className="hover:underline cursor-pointer">Group Benefits</span>
          <span className="hover:underline cursor-pointer">Claims</span>
          <span className="hover:underline cursor-pointer">Contact</span>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-[#00B140] text-white py-20 px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">Good for You. Good for Everyone.</h2>
        <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
          Insurance and financial services built on a mutual model — because your well-being comes first.
        </p>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto py-16 px-6 grid md:grid-cols-3 gap-8">
        {["Auto & Property", "Life & Health", "Group Benefits"].map((title) => (
          <div key={title} className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600 text-sm">Explore our {title.toLowerCase()} solutions tailored to your needs.</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 text-gray-500 text-center py-6 text-sm">
        © 2026 Beneva. All rights reserved.
      </footer>

      {/* Chat Button */}
      <button
        className="fixed bottom-6 right-6 bg-[#00B140] hover:bg-[#009532] text-white rounded-full h-14 w-14 flex items-center justify-center shadow-lg transition-colors"
        onClick={() => {}}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Beneva;
