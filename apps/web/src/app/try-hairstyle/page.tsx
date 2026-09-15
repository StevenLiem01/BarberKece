import { VirtualTryOn } from "../../components/try-on/VirtualTryOn";

export const metadata = {
  title: "Virtual Try-On | BarberKece",
};

export default function TryHairstylePage() {
  return (
    <main className="min-h-screen bg-bk-canvas py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="font-barlow font-bold text-3xl text-bk-ink mb-2">
            VIRTUAL TRY-ON
          </h1>
          <p className="font-inter text-bk-ink/70">
            See how you look with a fresh cut.
          </p>
        </div>
        <VirtualTryOn />
      </div>
    </main>
  );
}
