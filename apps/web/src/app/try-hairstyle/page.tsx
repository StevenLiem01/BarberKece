import { TryOnPrototype } from "../../components/try-on/TryOnPrototype";

export const metadata = {
  title: "Virtual Try-On Prototype | BarberKece",
};

export default function TryHairstylePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-lg py-8">
        <TryOnPrototype />
      </div>
    </main>
  );
}
