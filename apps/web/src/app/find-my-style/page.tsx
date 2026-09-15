import { FindMyStyleWizard } from "./wizard";

export default function FindMyStylePage() {
  return (
    <main className="min-h-screen bg-bk-canvas py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-barlow font-bold text-bk-ink uppercase tracking-tight">
            Find Your <span className="text-bk-lime bg-bk-ink px-2">Style</span>
          </h1>
          <p className="mt-4 text-lg text-neutral-600 max-w-xl mx-auto">
            Answer a few quick questions to help our recommendation engine find
            the perfect hairstyle for you.
          </p>
        </header>

        <FindMyStyleWizard />
      </div>
    </main>
  );
}
