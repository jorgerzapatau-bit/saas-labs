// app/pacientes/page.tsx
import AppShell from "@/components/AppShell";
import PacientesClient from "@/components/PacientesClient";

export default function PacientesPage() {
  return (
    <AppShell>
      <PacientesClient />
    </AppShell>
  );
}
