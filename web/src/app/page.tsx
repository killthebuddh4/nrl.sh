"use client";

import { useCallback, useEffect, useState } from "react";

const BASE_TEXT = "ssh rabbit@nrl.sh";

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("ssh rabbit@nrl.sh");

  const shuffleText = useCallback(() => {
    if (text !== BASE_TEXT) {
      setText(BASE_TEXT);
      return;
    }

    const shuffled = [...BASE_TEXT].map((c) => {
      if (Math.random() > 0.1) return c;
      const i = Math.floor(Math.random() * chars.length);
      return chars[i];
    });
    setText(shuffled.join(""));
  }, [text]);

  useEffect(() => {
    const interval = setInterval(shuffleText, 50);
    return () => clearInterval(interval);
  }, [shuffleText]);

  return (
    <main className="bg-gray-900 p-4 font-mono text-white h-screen w-screen flex flex-col">
      <header className="flex justify-end">
        <a
          href="https://github.com/killthebuddh4/nrl.sh"
          rel="noreferrer"
          target="_blank"
        >
          gh
        </a>
      </header>
      <div className="flex flex-grow justify-center items-center">
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
          }}
          className="hover:underline cursor-pointer"
        >
          {copied ? "Copied!" : text}
        </button>
      </div>
    </main>
  );
}

type CopiedValue = string | null;
type CopyFn = (text: string) => Promise<boolean>; // Return success

const useCopyToClipboard = (): [CopiedValue, CopyFn] => {
  const [copiedText, setCopiedText] = useState<CopiedValue>(null);

  const copy: CopyFn = async (text) => {
    if (!navigator?.clipboard) {
      console.warn("Clipboard not supported");
      return false;
    }

    // Try to save to clipboard then save it in the state if worked
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch (error) {
      console.warn("Copy failed", error);
      setCopiedText(null);
      return false;
    }
  };

  return [copiedText, copy];
};
