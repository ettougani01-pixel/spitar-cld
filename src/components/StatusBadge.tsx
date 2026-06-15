import { cn } from "@/lib/utils";

type StatusVariant = "normal" | "abnormal" | "critical" | "pending" | "approved" | "rejected" | "public" | "private";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const VARIANT_STYLES: Record<StatusVariant, string> = {
  normal: "bg-green-100 text-green-800 border-green-200",
  abnormal: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  public: "bg-sky-100 text-sky-800 border-sky-200",
  private: "bg-violet-100 text-violet-800 border-violet-200",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = (status?.toLowerCase() as StatusVariant) ?? "pending";
  const style = VARIANT_STYLES[variant] ?? "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        style,
        className,
      )}
      data-testid={`status-${status}`}
    >
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}
