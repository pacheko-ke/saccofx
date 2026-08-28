"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export default function BackButton({
  fallbackHref = "/dashboard",
  label = "Back",
  className = "mb-2",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-1.5 text-sm font-serif text-[#1c2b22] transition-colors hover:bg-[#eee7d6] hover:border-[#c9a24b] ${className}`}
    >
      <ArrowLeft className="h-4 w-4 text-[#c9a24b]" />
      {label}
    </button>
  );
}