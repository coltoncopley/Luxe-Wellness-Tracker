import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Phone, MapPin, Clock, Calendar, Facebook } from "lucide-react";

const FAQS = [
  {
    q: "How do I book an appointment?",
    a: 'Tap "Book" in the menu, browse our services, and tap "Book Now" — you\'ll be taken to our secure online booking site (Aesthetic Record) to pick a time.',
  },
  {
    q: "How do reward points work?",
    a: "You earn points automatically: +20 for your daily Glow check-in, +10 for a daily weigh-in, +5 per logged meal (up to 3 a day), and +50 every time your Glow streak hits a 7-day milestone. Redeem points on the Rewards page and show the code at the front desk.",
  },
  {
    q: "How accurate is the meal scanner?",
    a: "It gives an AI estimate of calories and macros from your photo — a helpful guide, not an exact measurement. You can always adjust or log a custom entry instead.",
  },
  {
    q: "Is my information private?",
    a: "Your entries are for your own tracking. We don't sell your data or show ads. See our Privacy Policy for full details.",
  },
  {
    q: "Is this medical advice?",
    a: "No. The app, including Luxe AI, offers general wellness information only. For medical questions — including GLP-1 medication questions — talk to your provider at your appointment.",
  },
  {
    q: "How do I delete my data?",
    a: "You can delete individual entries in the app. To remove everything, call us at (740) 377-8037 and we'll take care of it.",
  },
];

export default function Support() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <LifeBuoy className="h-8 w-8" /> Support
        </h1>
        <p className="text-muted-foreground text-lg">
          We're happy to help — reach us any of these ways.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Call or text</div>
                <a href="tel:+17403778037" className="text-sm text-primary underline">
                  (740) 377-8037
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Hours</div>
                <div className="text-sm text-muted-foreground">Monday–Friday, 9 AM – 5 PM</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Visit us</div>
                <div className="text-sm text-muted-foreground">
                  501 Washington Ave
                  <br />
                  South Point, OH
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Facebook className="h-5 w-5 text-primary shrink-0" />
              <a
                href="https://www.facebook.com/p/LUXE-Wellness-and-Aesthetics-61557221444967/"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline"
              >
                Message us on Facebook
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-serif text-xl">Ready to book?</div>
            <div className="text-sm opacity-90">Schedule online in under a minute.</div>
          </div>
          <Button asChild variant="secondary" className="rounded-full">
            <a
              href="https://hklqy.myaestheticrecord.com/online-booking"
              target="_blank"
              rel="noreferrer"
            >
              <Calendar className="w-4 h-4 mr-2" /> Book Online
            </a>
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-serif text-primary mb-4">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <Card key={faq.q}>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">{faq.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{faq.a}</CardContent>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        <Link href="/privacy" className="underline">Privacy Policy</Link>
        {" · "}
        <Link href="/terms" className="underline">Terms of Use</Link>
      </p>
    </div>
  );
}
