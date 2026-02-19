interface SignInGateProps {
  onSignIn: () => void;
}

export function SignInGate({ onSignIn }: SignInGateProps) {
  return (
    <div className="bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 rounded-2xl p-6 border border-[#667eea]/20 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Sign in required
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Sign in to Golden Minutes to manage your extension settings.
      </p>
      <button
        onClick={onSignIn}
        className="px-6 py-2.5 bg-gradient-to-r from-[#d4a843] to-[#c49a3a] text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-200"
      >
        Sign in with Golden Minutes
      </button>
    </div>
  );
}
