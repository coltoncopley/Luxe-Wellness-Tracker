import { Link, useLocation } from "wouter";
import { User, Calendar, Activity, Utensils, MapPin, Menu, X, Sparkles, Sun, Gift, BadgeCheck, LogOut, HeartPulse } from "lucide-react";
import { useState } from "react";
import { Show, useClerk, useUser } from "@clerk/react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import luxeLogo from "@assets/brand/luxe_logo.jpeg";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useClerk();
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => signOut({ redirectUrl: basePath || "/" })}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign out
    </Button>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isSignedIn } = useUser();
  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn },
  });
  const isStaff = me?.role === "staff";

  const navItems = [
    { href: "/", label: "Dashboard", icon: User },
    { href: "/book", label: "Book", icon: Calendar },
    { href: "/weight", label: "Progress", icon: Activity },
    { href: "/food", label: "Food Log", icon: Utensils },
    { href: "/restaurants", label: "Restaurants", icon: MapPin },
    { href: "/glow", label: "Glow Score", icon: Sun },
    { href: "/bhrt", label: "Hormone Replacement", icon: HeartPulse },
    { href: "/rewards", label: "Rewards", icon: Gift },
    { href: "/luxe-ai", label: "Luxe AI", icon: Sparkles },
    ...(isStaff ? [{ href: "/staff", label: "Staff Portal", icon: BadgeCheck }] : []),
  ];

  const displayName = user?.firstName ?? me?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? null;

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
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-20 px-4 pb-6 flex flex-col gap-2 overflow-y-auto">
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
          <Show when="signed-in">
            <SignOutButton className="justify-start px-4 py-3 h-auto rounded-xl text-muted-foreground" />
          </Show>
          <div className="mt-auto pt-4 text-center text-xs text-muted-foreground space-x-3">
            <Link href="/support" onClick={() => setMobileMenuOpen(false)} className="underline">Support</Link>
            <Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="underline">Privacy</Link>
            <Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="underline">Terms</Link>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <img src={luxeLogo} alt="LUXE Logo" className="w-10 h-10 rounded-full object-cover shadow-sm" />
          <span className="font-serif font-semibold text-xl tracking-tight">LUXE Wellness</span>
        </div>
        <nav className="flex-1 px-4 flex flex-col gap-2 mt-4 overflow-y-auto">
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
        <Show when="signed-in">
          <div className="px-4 pb-2">
            {displayName && (
              <div className="px-4 py-1 text-xs text-muted-foreground truncate">
                Signed in as <span className="font-medium">{displayName}</span>
              </div>
            )}
            <SignOutButton className="w-full justify-start text-muted-foreground" />
          </div>
        </Show>
        <div className="px-6 py-4 text-xs text-muted-foreground space-x-3">
          <Link href="/support" className="underline hover:text-primary">Support</Link>
          <Link href="/privacy" className="underline hover:text-primary">Privacy</Link>
          <Link href="/terms" className="underline hover:text-primary">Terms</Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  );
}
