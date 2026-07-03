import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
        <ShieldCheck className="h-8 w-8" /> Privacy Policy
      </h1>
      <p className="text-muted-foreground mb-8">Effective date: July 2, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed [&_h2]:text-xl [&_h2]:font-serif [&_h2]:text-primary [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <section>
          <h2>Who we are</h2>
          <p>
            This app is provided by LUXE Wellness and Aesthetics, 501 Washington Ave, South Point,
            Ohio ("LUXE," "we," "us"). It is a wellness companion app that helps you track your
            personal wellness habits and learn about our services. Questions? Call us at (740)
            377-8037 or visit our <Link href="/support" className="text-primary underline">Support page</Link>.
          </p>
        </section>

        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2>Our office cannot see your app data</h2>
          <p>
            Everything you track in this app — weight entries, measurements, meals, meal and
            progress photos, habit check-ins, skin scans, wellness scores, and Luxe AI
            conversations — is <strong>private to you</strong>. LUXE Wellness and Aesthetics staff,
            providers, and front-desk team members have <strong>no access</strong> to this
            information, and it is never shared with our office or added to any medical record.
          </p>
          <p className="mt-2">
            The only app information our staff can ever see is reward and account related: reward
            redemption codes you generate (with the reward name, your name, and your email so we
            can honor them at the front desk), and your email if we set up free membership access
            for you. Nothing about your health, habits, photos, or progress is ever visible to us.
          </p>
          <p className="mt-2">
            You acknowledge this notice the first time you sign in to your account.
          </p>
        </section>

        <section>
          <h2>Important: this is a wellness app, not a medical record</h2>
          <p>
            The information you enter in this app (weight, meals, habits, chat messages) is
            self-reported lifestyle data that you choose to track for your own benefit. This app is
            not connected to your medical chart, and because LUXE staff cannot see it, it is never
            used to make medical decisions. Please do not enter medical information such as
            diagnoses, medications, or treatment details.
          </p>
        </section>

        <section>
          <h2>Information the app stores</h2>
          <ul>
            <li>Wellness data you enter: weight entries, body measurements, goals, food logs, and daily habit check-ins (water, sleep, stress, activity, protein, skincare)</li>
            <li>Appointments you choose to track manually</li>
            <li>Messages you send to the Luxe AI assistant, so your conversation history is available to you</li>
            <li>Reward points earned in the app and redemption codes you generate</li>
          </ul>
          <p className="mt-2">
            The app does not collect your location, contacts, advertising identifiers, or browsing
            activity, and it contains no third-party advertising or analytics trackers.
          </p>
        </section>

        <section>
          <h2>Meal photos</h2>
          <p>
            When you use the meal scanner, your photo is sent securely to an AI service to estimate
            nutrition information, and the estimate is returned to you. The photo itself is not
            saved by the app after analysis. Only the nutrition estimate you choose to log is
            stored.
          </p>
        </section>

        <section>
          <h2>AI features</h2>
          <p>
            The Luxe AI assistant and meal scanner are powered by a third-party AI provider that
            processes your messages and photos to generate responses. AI responses are for general
            wellness information only and are not medical advice. We ask that you avoid including
            personal identifiers or medical details in chat messages.
          </p>
        </section>

        <section>
          <h2>How we use your information</h2>
          <ul>
            <li>To show you your own progress, summaries, and streaks</li>
            <li>To calculate reward points and process redemptions</li>
            <li>To respond to your questions through the Luxe AI assistant</li>
          </ul>
          <p className="mt-2">
            We do not sell your information, share it with advertisers, or use it for marketing
            without your consent.
          </p>
        </section>

        <section>
          <h2>Booking</h2>
          <p>
            Appointment booking happens on Aesthetic Record, a separate scheduling service with its
            own privacy policy. When you tap "Book," you leave this app.
          </p>
        </section>

        <section>
          <h2>Data retention and deletion</h2>
          <p>
            Your wellness data is kept so the app can show your history and progress. You can
            delete individual entries in the app at any time. To request deletion of all your data,
            contact us at (740) 377-8037 or through the <Link href="/support" className="text-primary underline">Support page</Link> and
            we will remove it.
          </p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            Data is transmitted over encrypted connections (HTTPS) and stored in a managed
            database. No system is perfectly secure, so please use good judgment about what you
            enter.
          </p>
          <p className="mt-2">
            Your data is protected by your personal account: you sign in with your email or Google
            account, and only you can view the information in your account. Keep your sign-in
            credentials private, and sign out on shared devices.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            This app is intended for adults 18 and older and is not directed to children. We do not
            knowingly collect information from children.
          </p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>
            If we make material changes, we will update the effective date above and note the
            change in the app.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            LUXE Wellness and Aesthetics
            <br />
            501 Washington Ave, South Point, OH
            <br />
            (740) 377-8037
          </p>
        </section>
      </div>
    </div>
  );
}
