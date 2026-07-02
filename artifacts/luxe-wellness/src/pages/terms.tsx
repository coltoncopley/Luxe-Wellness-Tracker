import { Link } from "wouter";
import { ScrollText } from "lucide-react";

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
        <ScrollText className="h-8 w-8" /> Terms of Use
      </h1>
      <p className="text-muted-foreground mb-8">Effective date: July 2, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed [&_h2]:text-xl [&_h2]:font-serif [&_h2]:text-primary [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <section>
          <h2>Acceptance</h2>
          <p>
            By using the LUXE Wellness &amp; Aesthetics app ("the app"), you agree to these terms.
            If you do not agree, please do not use the app. The app is provided by LUXE Wellness
            and Aesthetics, 501 Washington Ave, South Point, Ohio.
          </p>
        </section>

        <section>
          <h2>Not medical advice</h2>
          <p>
            The app is a wellness companion for tracking lifestyle habits. Nothing in the app —
            including nutrition estimates, Glow Scores, tips, and Luxe AI responses — is medical
            advice, diagnosis, or treatment. Always consult a qualified healthcare provider about
            medical questions, medications (including GLP-1 medications), and before changing your
            diet or exercise. If you have a medical emergency, call 911.
          </p>
        </section>

        <section>
          <h2>AI features and estimates</h2>
          <p>
            Meal photo analysis and the Luxe AI assistant use artificial intelligence. AI-generated
            estimates and responses can be inaccurate or incomplete. Nutrition estimates are
            approximations, not measurements. You are responsible for verifying any information you
            rely on.
          </p>
        </section>

        <section>
          <h2>Your data and honest use</h2>
          <p>
            You are responsible for the accuracy of the information you enter. You agree not to
            misuse the app, including attempting to manipulate reward points, guess redemption
            codes, interfere with the service, or use the app for any unlawful purpose.
          </p>
        </section>

        <section>
          <h2>Rewards program</h2>
          <ul>
            <li>Points have no cash value and cannot be transferred or sold.</li>
            <li>Redemption codes are single-use and verified by LUXE staff at the front desk.</li>
            <li>
              LUXE may modify reward values, the catalog, or discontinue the program at any time.
              Points earned through error or misuse may be removed.
            </li>
            <li>Rewards cannot be combined with other offers unless LUXE says otherwise.</li>
          </ul>
        </section>

        <section>
          <h2>Booking and services</h2>
          <p>
            Appointment booking is handled by Aesthetic Record, a separate service with its own
            terms. All treatments and services are subject to LUXE's in-office policies, pricing,
            and provider evaluation of candidacy.
          </p>
        </section>

        <section>
          <h2>Intellectual property</h2>
          <p>
            The app, its design, and its content belong to LUXE Wellness and Aesthetics or its
            licensors. You may not copy, modify, or redistribute the app.
          </p>
        </section>

        <section>
          <h2>Disclaimer and limitation of liability</h2>
          <p>
            The app is provided "as is" without warranties of any kind. To the fullest extent
            permitted by law, LUXE Wellness and Aesthetics is not liable for any indirect,
            incidental, or consequential damages arising from your use of the app.
          </p>
        </section>

        <section>
          <h2>Changes and termination</h2>
          <p>
            We may update the app and these terms from time to time. Material changes will be
            reflected in the effective date above. We may suspend or discontinue the app at any
            time.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about these terms? Visit our{" "}
            <Link href="/support" className="text-primary underline">Support page</Link> or call
            (740) 377-8037.
          </p>
        </section>
      </div>
    </div>
  );
}
