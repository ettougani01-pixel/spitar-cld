import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SpitarIdBadgeProps {
  id: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SpitarIdBadge({ id, className, size = "md" }: SpitarIdBadgeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      data-testid="button-copy-spitar-id"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono font-semibold transition-all hover:bg-primary/20 cursor-pointer",
        size === "sm" && "px-2 py-0.5 text-xs gap-1",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-2 text-base",
        className,
      )}
    >
      {id}
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-60" />}
    </button>
  );
}
