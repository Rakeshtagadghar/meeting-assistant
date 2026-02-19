"use client";

import { useEffect, useState } from "react";

interface Props {
  token: string;
  email: string | null;
  extId: string;
  expiresAt: number;
}

type ExtensionMessage = {
  type: "GM_AUTH_TOKEN";
  token: string;
  email: string | null;
  expiresAt: number;
};

type ExtensionResponse = {
  success?: boolean;
};

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: ExtensionMessage,
  ) => Promise<ExtensionResponse | undefined>;
};

type ChromeApi = {
  runtime?: ChromeRuntime;
};

export function ExtensionAuthClient({ token, email, extId, expiresAt }: Props) {
  const [status, setStatus] = useState<"sending" | "success" | "error">(
    "sending",
  );

  useEffect(() => {
    async function sendToExtension() {
      try {
        const runtime = (globalThis as { chrome?: ChromeApi }).chrome?.runtime;
        if (!runtime?.sendMessage) {
          setStatus("error");
          return;
        }

        const response = await runtime.sendMessage(extId, {
          type: "GM_AUTH_TOKEN",
          token,
          email,
          expiresAt,
        });

        if (response?.success) {
          setStatus("success");
          setTimeout(() => window.close(), 2000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }

    void sendToExtension();
  }, [token, email, extId, expiresAt]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 text-center border border-white/50">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 6v6l4 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {status === "sending" && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting to Extension...
              </h1>
              <p className="text-gray-500 text-sm mb-4">
                Sending authentication to Golden Minutes extension.
              </p>
              <div className="w-8 h-8 mx-auto border-2 border-[#667eea] border-t-transparent rounded-full animate-spin" />
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Connected!
              </h1>
              <p className="text-gray-500 text-sm mb-2">
                Signed in as{" "}
                <span className="font-medium text-gray-700">
                  {email ?? "user"}
                </span>
              </p>
              <p className="text-gray-400 text-xs">
                This tab will close automatically...
              </p>
              <div className="mt-4 w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-emerald-500"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h1>
              <p className="text-gray-500 text-sm mb-4">
                Could not send authentication to the extension. Make sure the
                Golden Minutes extension is installed and enabled.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
