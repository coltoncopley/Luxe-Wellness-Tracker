import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HeartPulse,
  Brain,
  Bone,
  Flame,
  Moon,
  Activity,
  FlaskConical,
  ClipboardList,
  RefreshCw,
  Stethoscope,
  ExternalLink,
  BookOpen,
} from "lucide-react";

const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

const womenSymptoms = [
  "Hot flashes and night sweats",
  "Fatigue and low energy",
  "Brain fog and memory changes",
  "Mood swings, anxiety, or low mood",
  "Weight gain and bloating",
  "Sleep disturbances",
  "Low libido and vaginal dryness",
  "PMS and irregular cycles",
  "Thinning hair and skin changes",
];

const menSymptoms = [
  "Low energy and motivation",
  "Decreased muscle mass and strength",
  "Increased body fat",
  "Brain fog and poor concentration",
  "Low mood or irritability",
  "Reduced libido and performance",
  "Poor sleep and recovery",
];

const hormones = [
  {
    name: "Estradiol",
    detail:
      "The primary estrogen, studied for its role in bone density, brain function, and relief of menopausal symptoms. Your provider can review what replacement may offer in your case.",
  },
  {
    name: "Progesterone",
    detail:
      "Supports sleep, mood, and calm; balances estrogen. Micronized (bioidentical) progesterone is favored in the literature over synthetic progestins.",
  },
  {
    name: "Testosterone",
    detail:
      "Important for both men and women: muscle, bone, energy, mood, cognition, and libido. Optimization targets how you feel and function, not just a lab reference range.",
  },
  {
    name: "Thyroid",
    detail:
      "Governs metabolism, energy, and temperature regulation. Fatigue, weight struggles, and brain fog that persist despite \u201cnormal\u201d labs may warrant a closer look at thyroid function.",
  },
  {
    name: "DHEA",
    detail:
      "An adrenal hormone and building block for other hormones; levels decline steadily with age. Supports energy, immunity, and well-being.",
  },
];

const benefits = [
  { icon: Bone, title: "Bone Support", text: "Research suggests hormone therapy may help protect against age-related bone loss. Ask your provider what the evidence means for you." },
  { icon: Brain, title: "Brain Function", text: "Some studies associate healthy hormone levels with memory and focus. Individual results vary." },
  { icon: HeartPulse, title: "Heart Health", text: "Cardiovascular effects of hormone therapy are an active area of research — your provider can walk you through the evidence." },
  { icon: Flame, title: "Metabolic Wellness", text: "Balanced hormones may support body composition and energy metabolism as part of an overall wellness plan." },
  { icon: Moon, title: "Sleep & Mood", text: "Many patients report improvements in sleep and mood; responses differ from person to person." },
  { icon: Activity, title: "Vitality", text: "Energy, strength, libido, and quality of life — the goal is feeling and functioning at your best." },
];

const steps = [
  {
    icon: Stethoscope,
    title: "1. Consultation",
    text: "A one-on-one visit to review your symptoms, history, and goals.",
  },
  {
    icon: FlaskConical,
    title: "2. Comprehensive Labs",
    text: "Full hormone panel — because you can't optimize what you don't measure.",
  },
  {
    icon: ClipboardList,
    title: "3. Personalized Protocol",
    text: "An individualized, evidence-based plan using bioidentical hormones — never one-size-fits-all.",
  },
  {
    icon: RefreshCw,
    title: "4. Follow-Up & Fine-Tuning",
    text: "Regular retesting and symptom reviews to keep you at your optimal level, safely.",
  },
];

const faqs = [
  {
    q: "What are bioidentical hormones?",
    a: "Bioidentical hormones are molecularly identical to the hormones your body makes naturally — estradiol, progesterone, and testosterone — as opposed to synthetic look-alikes. The peer-reviewed literature this approach is built on distinguishes carefully between the two.",
  },
  {
    q: "What does \u201cNormal isn't optimal\u201d mean?",
    a: "Standard lab ranges describe the average population — including people who feel terrible. The optimization approach taught by Neal Rouzier, MD through WorldLink Medical treats to the level where the medical literature shows benefit and where you feel your best, rather than settling for \u201cwithin normal limits.\u201d",
  },
  {
    q: "Is BHRT only for women in menopause?",
    a: "No. Women in perimenopause, women with PMS, and men with declining testosterone (andropause) may all be candidates. Hormone decline is gradual, so symptoms can appear years before \u201cofficial\u201d menopause or a flagged lab value — a consultation and labs can clarify whether therapy makes sense for you.",
  },
  {
    q: "Is hormone therapy safe?",
    a: "Safety depends on the individual. The approach followed here emphasizes peer-reviewed literature, individualized dosing, and ongoing lab monitoring. Hormone therapy is not appropriate for everyone — your provider will review your personal history, risks, and any contraindications with you before any treatment decision.",
  },
  {
    q: "How soon will I feel a difference?",
    a: "It varies. Some people report changes in sleep, energy, or mood within weeks, while others take longer — and responses differ from person to person. Dosing is fine-tuned at follow-ups based on labs and how you feel.",
  },
  {
    q: "How do I get started?",
    a: "Book a consultation with Dr. Copley. You'll review your symptoms and goals, get comprehensive lab work, and receive a personalized plan.",
  },
];

export default function Bhrt() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl text-primary" data-testid="text-bhrt-title">
          Bioidentical Hormone Replacement Therapy
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
          Evidence-based hormone optimization for women and men, following the protocols taught by
          Neal Rouzier, MD and WorldLink Medical — the leading evidence-based BHRT training program
          for physicians.
        </p>
        <Button asChild size="lg" className="rounded-full" data-testid="button-bhrt-book-hero">
          <a href={BOOKING_URL} target="_blank" rel="noreferrer">
            Book a Hormone Consultation
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-bhrt-disclaimer-top">
          This page is for education only — it is not medical advice, a diagnosis, or a promise of
          results. Whether hormone therapy is right for you is decided with a licensed provider
          after an individual evaluation and lab work.
        </p>
      </div>

      {/* Philosophy */}
      <Card className="bg-gradient-to-br from-primary/5 via-card to-accent/5 border-border shadow-sm">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-serif">"Normal Isn't Optimal"</h2>
            <p className="text-muted-foreground leading-relaxed">
              Standard lab ranges tell you whether you're average — not whether you're well. The
              philosophy pioneered by Neal Rouzier, MD holds that hormone levels should be guided by
              the peer-reviewed medical literature and by how you actually feel and function — not
              just by falling "within normal limits." Every protocol is individualized,
              literature-informed, and monitored with regular lab work, and your provider will
              discuss what the evidence does and doesn't show for your situation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Who it helps */}
      <div className="space-y-4">
        <h2 className="text-2xl">Who May Benefit</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="font-serif text-xl">For Women</CardTitle>
              <p className="text-sm text-muted-foreground">
                Perimenopause, menopause, post-menopause, and PMS
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {womenSymptoms.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-primary">•</span> {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="font-serif text-xl">For Men</CardTitle>
              <p className="text-sm text-muted-foreground">
                Andropause and age-related testosterone decline
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {menSymptoms.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-primary">•</span> {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hormones optimized */}
      <div className="space-y-4">
        <h2 className="text-2xl">Hormones We Evaluate & Optimize</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hormones.map((h) => (
            <Card key={h.name} className="shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">{h.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{h.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Evidence-based benefits */}
      <div className="space-y-4">
        <h2 className="text-2xl">Potential Benefits to Discuss With Your Provider</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b) => (
            <Card key={b.title} className="shadow-sm border-border">
              <CardContent className="p-5 space-y-2">
                <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Process */}
      <div className="space-y-4">
        <h2 className="text-2xl">What to Expect</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <Card key={s.title} className="shadow-sm border-border">
              <CardContent className="p-5 space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-2xl">Frequently Asked Questions</h2>
        <Card className="shadow-sm border-border">
          <CardContent className="p-2 md:p-4">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <Card className="bg-primary text-primary-foreground shadow-md">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif mb-1">Ready to feel like yourself again?</h2>
            <p className="opacity-80">
              Start with a hormone consultation and comprehensive lab panel with Dr. Copley.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="rounded-full shrink-0"
            data-testid="button-bhrt-book-cta"
          >
            <a href={BOOKING_URL} target="_blank" rel="noreferrer">
              Book Now
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
        This page is educational and is not medical advice, diagnosis, or a guarantee of treatment
        outcomes. Bioidentical hormone therapy is prescribed only after an individual evaluation,
        lab work, and medical review by a licensed provider. Whether BHRT is appropriate for you —
        and at what doses — is a decision made with your provider based on your personal history.
      </p>
    </div>
  );
}
