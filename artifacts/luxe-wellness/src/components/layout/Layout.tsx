import { Link, useLocation } from "wouter";
import { User, Calendar, Activity, Utensils, MapPin, Menu, X, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import luxeLogo from "@assets/brand/luxe_logo.jpeg";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: User },
    { href: "/book", label: "Book", icon: Calendar },
    { href: "/weight", label: "Progress", icon: Activity },
    { href: "/food", label: "Food Log", icon: Utensils },
    { href: "/restaurants", label: "Restaurants", icon: MapPin },
    { href: "/glow", label: "Glow Score", icon: Sun },
    { href: "/luxe-ai", label: "Luxe AI", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <img src={luxeLogo} alt="LUXE Logo" className="w-8 h-8 rounded-full object-cover" />
          <span className="font-serif font-semibold text-lg">LUXE Wellness</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-20 px-4 pb-6 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div 
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  location === item.href 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <img src={luxeLogo} alt="LUXE Logo" className="w-10 h-10 rounded-full object-cover shadow-sm" />
          <span className="font-serif font-semibold text-xl tracking-tight">LUXE Wellness</span>
        </div>
        <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                location === item.href 
                  ? "bg-primary text-primary-foreground shadow-md scale-105" 
                  : "hover:bg-muted text-muted-foreground hover:scale-105"
              }`}>
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  );
}
