import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Activity,
  Utensils,
  Sun,
  Gift,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import luxeLogo from "@assets/brand/luxe_logo.jpeg";

const features = [
  {
    icon: Activity,
    title: "Weight Loss Progress Tracking",
    description: "Daily weigh-ins, body measurements, and goal tracking designed for your weight-loss journey.",
  },
  {
    icon: Utensils,
    title: "Food & Meal Scanner",
    description: "Log meals, snap a photo for instant AI nutrition estimates, and find healthy picks at local restaurants.",
  },
  {
    icon: Sparkles,
    title: "Luxe AI Assistant",
    description: "24/7 answers on treatments, skincare, and weight loss support — grounded in LUXE's real services.",
  },
  {
    icon: Sun,
    title: "Glow Score",
    description: "One daily habit check-in — water, sleep, protein, skincare — rolled into a single 0-100 score.",
  },
  {
    icon: Gift,
    title: "Rewards",
    description: "Earn points for healthy habits and redeem them for real LUXE treatment perks.",
  },
  {
    icon: Calendar,
    title: "Easy Booking",
    description: "Browse services and the LUXE team, then book online in seconds.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <img src={luxeLogo} alt="LUXE Logo" className="w-10 h-10 rounded-full object-cover shadow-sm" />
          <span className="font-serif font-semibold text-xl tracking-tight">LUXE Wellness</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-4xl mx-auto text-center px-6 pt-16 pb-12">
          <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-4">
            Physician-owned med spa · South Point, OH
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-6">
            Your wellness journey,
            <br />
            <span className="italic">beautifully</span> supported.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            The LUXE Wellness &amp; Aesthetics patient companion — track your weight loss progress,
            build glowing habits, earn rewards, and get expert answers any time of day.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="px-8">Create your account</Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="px-8">Sign in</Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Your tracking data is private to you — LUXE staff and our office have no access to it.{" "}
            <Link href="/privacy" className="underline hover:text-primary">Learn more</Link>
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="border-border">
                <CardContent className="pt-6">
                  <f.icon className="h-7 w-7 text-primary mb-3" />
                  <h3 className="font-medium mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground space-x-4">
        <Link href="/support" className="underline hover:text-primary">Support</Link>
        <Link href="/privacy" className="underline hover:text-primary">Privacy</Link>
        <Link href="/terms" className="underline hover:text-primary">Terms</Link>
      </footer>
    </div>
  );
}
