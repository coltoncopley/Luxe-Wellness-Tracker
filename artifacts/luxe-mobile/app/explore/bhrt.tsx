import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Card, LuxeButton, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { BOOKING_URL } from "@/lib/luxe";

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

const hormones: { name: string; detail: string }[] = [
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

const benefits: { icon: keyof typeof Feather.glyphMap; title: string; text: string }[] = [
  { icon: "shield", title: "Bone Support", text: "Research suggests hormone therapy may help protect against age-related bone loss. Ask your provider what the evidence means for you." },
  { icon: "zap", title: "Brain Function", text: "Some studies associate healthy hormone levels with memory and focus. Individual results vary." },
  { icon: "heart", title: "Heart Health", text: "Cardiovascular effects of hormone therapy are an active area of research — your provider can walk you through the evidence." },
  { icon: "activity", title: "Metabolic Wellness", text: "Balanced hormones may support body composition and energy metabolism as part of an overall wellness plan." },
  { icon: "moon", title: "Sleep & Mood", text: "Many patients report improvements in sleep and mood; responses differ from person to person." },
  { icon: "trending-up", title: "Vitality", text: "Energy, strength, libido, and quality of life — the goal is feeling and functioning at your best." },
];

const steps: { icon: keyof typeof Feather.glyphMap; title: string; text: string }[] = [
  { icon: "user", title: "1. Consultation", text: "A one-on-one visit to review your symptoms, history, and goals." },
  { icon: "clipboard", title: "2. Comprehensive Labs", text: "Full hormone panel — because you can't optimize what you don't measure." },
  { icon: "file-text", title: "3. Personalized Protocol", text: "An individualized, evidence-based plan using bioidentical hormones — never one-size-fits-all." },
  { icon: "refresh-cw", title: "4. Follow-Up & Fine-Tuning", text: "Regular retesting and symptom reviews to keep you at your optimal level, safely." },
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

function SymptomList({ items }: { items: string[] }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      {items.map((s) => (
        <View key={s} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ color: c.tint, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>•</Text>
          <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, lineHeight: 20 }}>
            {s}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 }}
      >
        <Text style={{ flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
          {q}
        </Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
      </Pressable>
      {open ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: c.mutedForeground,
            lineHeight: 21,
            paddingBottom: 14,
          }}
        >
          {a}
        </Text>
      ) : null}
    </View>
  );
}

export default function BhrtScreen() {
  const c = useColors();
  const book = () => void Linking.openURL(BOOKING_URL);

  return (
    <StackScreen>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 26,
          color: c.foreground,
          lineHeight: 34,
        }}
      >
        Bioidentical Hormone Replacement Therapy
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          color: c.mutedForeground,
          lineHeight: 22,
          marginTop: 10,
        }}
      >
        Evidence-based hormone optimization for women and men, following the protocols taught by
        Neal Rouzier, MD and WorldLink Medical — the leading evidence-based BHRT training program
        for physicians.
      </Text>
      <View style={{ marginTop: 16 }}>
        <LuxeButton label="Book a Hormone Consultation" icon="external-link" onPress={book} />
      </View>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 12,
          color: c.mutedForeground,
          lineHeight: 18,
          marginTop: 12,
        }}
      >
        This page is for education only — it is not medical advice, a diagnosis, or a promise of
        results. Whether hormone therapy is right for you is decided with a licensed provider after
        an individual evaluation and lab work.
      </Text>

      <Card style={{ marginTop: 20 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Feather name="book-open" size={22} color={c.tint} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.foreground }}>
              "Normal Isn't Optimal"
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: c.mutedForeground,
                lineHeight: 21,
                marginTop: 8,
              }}
            >
              Standard lab ranges tell you whether you're average — not whether you're well. The
              philosophy pioneered by Neal Rouzier, MD holds that hormone levels should be guided by
              the peer-reviewed medical literature and by how you actually feel and function — not
              just by falling "within normal limits." Every protocol is individualized,
              literature-informed, and monitored with regular lab work, and your provider will
              discuss what the evidence does and doesn't show for your situation.
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Who May Benefit</SectionTitle>
      <Card>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 17, color: c.foreground }}>For Women</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
          Perimenopause, menopause, post-menopause, and PMS
        </Text>
        <SymptomList items={womenSymptoms} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 17, color: c.foreground }}>For Men</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
          Andropause and age-related testosterone decline
        </Text>
        <SymptomList items={menSymptoms} />
      </Card>

      <SectionTitle>Hormones We Evaluate & Optimize</SectionTitle>
      {hormones.map((h) => (
        <Card key={h.name} style={{ marginBottom: 12 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground, marginBottom: 6 }}>
            {h.name}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, lineHeight: 21 }}>
            {h.detail}
          </Text>
        </Card>
      ))}

      <SectionTitle>Potential Benefits to Discuss With Your Provider</SectionTitle>
      {benefits.map((b) => (
        <Card key={b.title} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Feather name={b.icon} size={20} color={c.tint} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground, marginBottom: 4 }}>
                {b.title}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, lineHeight: 21 }}>
                {b.text}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      <SectionTitle>What to Expect</SectionTitle>
      {steps.map((s) => (
        <Card key={s.title} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Feather name={s.icon} size={20} color={c.tint} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground, marginBottom: 4 }}>
                {s.title}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, lineHeight: 21 }}>
                {s.text}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      <SectionTitle>Frequently Asked Questions</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        {faqs.map((f, i) => (
          <View key={f.q} style={i === 0 ? { marginTop: -1 } : undefined}>
            <Faq q={f.q} a={f.a} />
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 20, backgroundColor: c.primary }}>
        <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.primaryForeground }}>
          Ready to feel like yourself again?
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: c.primaryForeground,
            opacity: 0.8,
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          Start with a hormone consultation and comprehensive lab panel with Dr. Copley.
        </Text>
        <LuxeButton label="Book Now" icon="external-link" variant="gold" onPress={book} />
      </Card>

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: c.mutedForeground,
          lineHeight: 17,
          marginTop: 20,
        }}
      >
        This page is educational and is not medical advice, diagnosis, or a guarantee of treatment
        outcomes. Bioidentical hormone therapy is prescribed only after an individual evaluation,
        lab work, and medical review by a licensed provider. Whether BHRT is appropriate for you —
        and at what doses — is a decision made with your provider based on your personal history.
      </Text>
    </StackScreen>
  );
}
