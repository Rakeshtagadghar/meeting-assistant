interface SignInGateProps {
  onSignIn: () => void;
}

export function SignInGate({ onSignIn }: SignInGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] w-[380px] bg-gradient-to-br from-[#667eea] via-[#6b5ce7] to-[#764ba2] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Golden Minutes</h1>
      <p className="text-white/70 text-sm mb-8 max-w-[260px] leading-relaxed">
        Sign in to detect meetings and start recording with consent.
      </p>

      <button
        onClick={onSignIn}
        className="w-full max-w-[260px] py-3 px-6 bg-gradient-to-r from-[#d4a843] to-[#c49a3a] text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0"
      >
        Sign in with Golden Minutes
      </button>

      <p className="text-white/40 text-xs mt-6 max-w-[240px] leading-relaxed">
        No data is collected until you explicitly start a recording.
      </p>
    </div>
  );
}
