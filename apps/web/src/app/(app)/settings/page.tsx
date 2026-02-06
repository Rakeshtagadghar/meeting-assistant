import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
    </main>
  );
}
