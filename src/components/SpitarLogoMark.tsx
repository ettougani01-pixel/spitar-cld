import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
}

export function SpitarLogoMark({ size = 36, className }: Props) {
  return (
    <img
      src="/logo.png"
      alt="SPITAR"
      width={size}
      height={size}
      className={cn("object-contain flex-shrink-0 rounded-full", className)}
      draggable={false}
    />
  );
}
