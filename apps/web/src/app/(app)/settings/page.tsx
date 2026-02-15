import type { Metadata } from "next";
import { AnalyticsSettings } from "@/features/settings/components/AnalyticsSettings";
import { IntegrationsSettings } from "@/features/settings/components/IntegrationsSettings";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold gradient-text mb-8">Settings</h1>

        {/* Account section */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-heading mb-4">
            Account
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-text-heading">Email</p>
                <p className="text-sm text-text-muted">
                  Manage your email preferences
                </p>
              </div>
              <button className="text-sm text-primary font-medium hover:underline">
                Edit
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-text-heading">Password</p>
                <p className="text-sm text-text-muted">Change your password</p>
              </div>
              <button className="text-sm text-primary font-medium hover:underline">
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Preferences section */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-heading mb-4">
            Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-text-heading">
                  Email notifications
                </p>
                <p className="text-sm text-text-muted">
                  Receive email updates about your notes
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-text-heading">
                  Desktop notifications
                </p>
                <p className="text-sm text-text-muted">
                  Show desktop alerts for reminders
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  defaultChecked
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Analytics section */}
        <AnalyticsSettings />

        {/* Integrations section */}
        <IntegrationsSettings />

        {/* Danger zone */}
        <div className="glass-card rounded-2xl p-6 border border-red-100">
          <h2 className="text-lg font-semibold text-red-600 mb-4">
            Danger Zone
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-heading">Delete account</p>
              <p className="text-sm text-text-muted">
                Permanently delete your account and all data
              </p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
