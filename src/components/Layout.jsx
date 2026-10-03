import { Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta"
});

export default function Layout({ children }) {
  return (
    <div className={`${jakarta.variable} min-h-screen bg-surface flex flex-col font-sans text-text-primary`}>
      <Navbar />
      <div className="flex flex-1 pt-16">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-[240px] p-6 lg:p-8 transition-all duration-300">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
