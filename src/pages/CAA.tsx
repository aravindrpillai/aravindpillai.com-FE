import { MessageCircle } from "lucide-react";

const CAA = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Header */}
      <header className="bg-[#003DA5] text-white py-4 px-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">CAA</h1>
        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <span className="hover:underline cursor-pointer">Auto Insurance</span>
          <span className="hover:underline cursor-pointer">Home Insurance</span>
          <span className="hover:underline cursor-pointer">Travel</span>
          <span className="hover:underline cursor-pointer">Membership</span>
          <span className="hover:underline cursor-pointer">Contact</span>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-[#003DA5] text-white py-20 px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">Insurance You Can Trust</h2>
        <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
          Protect what matters most with CAA Insurance. Auto, home, and travel coverage designed for you.
        </p>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto py-16 px-6 grid md:grid-cols-3 gap-8">
        {["Auto Insurance", "Home Insurance", "Travel Insurance"].map((title) => (
          <div key={title} className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600 text-sm">Get a quote and save on your {title.toLowerCase()} today.</p>
          </div>
        ))}
      </section>

      <center><div id="claim-ai-popup"></div></center>

      {/* Footer */}
      <footer className="bg-gray-100 text-gray-500 text-center py-6 text-sm">
        © 2026 CAA. All rights reserved.
      </footer>

      {/* GFT AI : import:  <script src="https://ai.aravindpillai.com/claimplugin.js"></script> */}
      <button
        className="fixed bottom-6 right-6 bg-[#003DA5] hover:bg-[#002d7a] text-white rounded-full h-14 w-14 flex items-center justify-center shadow-lg transition-colors"
        onClick={() => {window.MyWidget.initiateHandler({ company: "caa", email: "david@gmail.com", name:"David Ben", policynumber : "CAA123456", mobile:"8880006565" }) }}
      >
        Claim
      </button>


    </div>
  );
};

export default CAA;
