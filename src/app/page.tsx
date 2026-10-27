export default function HomePage() {
  return (
    <div className="bg-brand-cream text-brand-ink flex min-h-screen flex-col">
      {/* Navigation Header */}
      <header className="border-brand-peach/60 border-b bg-white/70 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="bg-brand-tomato font-heading flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white shadow-xs">
              R
            </div>
            <div>
              <span className="font-heading text-brand-ink text-xl font-bold tracking-tight">
                Retell
              </span>
              <span className="text-brand-secondary ml-2 hidden text-xs font-medium sm:inline">
                Meta Global AI Developer Hackathon
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-brand-peach/60 text-brand-ink inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
              Scaffold Initialized
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* Hero Section */}
          <section className="space-y-4 text-center sm:text-left">
            <div className="bg-brand-butter text-brand-ink inline-block rounded-xl px-3 py-1 text-xs font-semibold tracking-wider uppercase">
              Know it. Say it. Improve it.
            </div>
            <h1 className="font-heading text-brand-ink text-4xl font-extrabold tracking-tight sm:text-5xl">
              Master exam recall through spoken explanation
            </h1>
            <p className="text-brand-secondary max-w-2xl text-base leading-relaxed sm:text-lg">
              Retell helps students practice explaining complex exam concepts
              aloud, identifies missing essential terminology and semantic gaps,
              and guides improvement across repeated attempts without keyword
              penalization.
            </p>
          </section>

          {/* Design Token Preview & Foundation Card */}
          <section className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs sm:p-8">
            <h2 className="font-heading text-brand-ink text-xl font-bold">
              Design System &amp; Brand Tokens
            </h2>
            <p className="text-brand-secondary mt-1 text-sm">
              Warm, accessible, learning-centered aesthetic configured for
              responsive viewports (390px, 768px, 1440px).
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border-brand-peach/60 bg-brand-cream rounded-xl border p-3 text-center">
                <div className="text-brand-ink text-xs font-semibold">
                  Warm Cream
                </div>
                <div className="text-brand-secondary font-mono text-xs">
                  #FFF8EB
                </div>
              </div>
              <div className="bg-brand-tomato rounded-xl p-3 text-center text-white">
                <div className="text-xs font-semibold">Tomato</div>
                <div className="font-mono text-xs opacity-90">#E6533D</div>
              </div>
              <div className="bg-brand-butter text-brand-ink rounded-xl p-3 text-center">
                <div className="text-xs font-semibold">Butter Yellow</div>
                <div className="font-mono text-xs opacity-90">#F5D96B</div>
              </div>
              <div className="bg-brand-peach text-brand-ink rounded-xl p-3 text-center">
                <div className="text-xs font-semibold">Peach</div>
                <div className="font-mono text-xs opacity-90">#FFE2D7</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="bg-brand-tomato hover:bg-brand-tomato-hover focus-visible:outline-brand-tomato inline-flex h-11 items-center justify-center rounded-xl px-5 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Primary Button
              </button>
              <button
                type="button"
                className="border-brand-peach bg-brand-cream text-brand-ink hover:bg-brand-peach/40 inline-flex h-11 items-center justify-center rounded-xl border px-5 font-semibold transition-colors"
              >
                Secondary Action
              </button>
              <span className="text-brand-secondary text-xs">
                16px card radius • 12px button radius • 8px grid system
              </span>
            </div>
          </section>

          {/* Project Foundation Status Card */}
          <section className="border-brand-peach/80 space-y-4 rounded-2xl border bg-white p-6 shadow-xs sm:p-8">
            <h2 className="font-heading text-brand-ink text-xl font-bold">
              Task 1 Foundation Status
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border-brand-peach/40 bg-brand-cream/50 rounded-xl border p-4">
                <h3 className="font-heading text-brand-ink text-sm font-semibold">
                  Application Stack
                </h3>
                <ul className="text-brand-secondary mt-2 space-y-1 text-xs">
                  <li>• Next.js App Router (v16.4.3)</li>
                  <li>• React (v19.3.0) &amp; TypeScript (v5.9.3)</li>
                  <li>• Tailwind CSS (v4) with custom theme tokens</li>
                  <li>• Zod runtime schema validation</li>
                  <li>• Strict TypeScript settings &amp; ESLint flat config</li>
                </ul>
              </div>

              <div className="border-brand-peach/40 bg-brand-cream/50 rounded-xl border p-4">
                <h3 className="font-heading text-brand-ink text-sm font-semibold">
                  Planned Architecture (Pending Implementation)
                </h3>
                <ul className="text-brand-secondary mt-2 space-y-1 text-xs">
                  <li>• Meta Model API (muse-spark-1.3) reasoning</li>
                  <li>• Meta Voice Transcribe (muse-voice-transcribe-1.0)</li>
                  <li>• Baseten (muse-spark-open-1026) fallback reasoning</li>
                  <li>• Local-first IndexedDB browser storage</li>
                  <li>• Source-grounded semantic rubric evaluation</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-brand-peach/60 text-brand-secondary border-t bg-white/60 py-6 text-center text-xs">
        <p>
          Retell — Meta Global AI Developer Hackathon • Local-first privacy
          architecture
        </p>
      </footer>
    </div>
  );
}
