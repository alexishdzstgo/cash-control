export type AlertTone = "success" | "warning" | "critical" | "review";

export const alertToneStyles: Record<
  AlertTone,
  {
    accentBorder: string;
    badge: string;
    border: string;
    icon: string;
    progress: string;
    softPanel: string;
    text: string;
  }
> = {
  success: {
    accentBorder: "border-l-[#047857]",
    badge: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
    border: "border-[#A7F3D0]",
    icon: "bg-[#ECFDF5] text-[#047857]",
    progress: "bg-[#047857]",
    softPanel: "border-[#A7F3D0] bg-[#ECFDF5]",
    text: "text-[#047857]",
  },
  warning: {
    accentBorder: "border-l-[#C2410C]",
    badge: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
    border: "border-[#FED7AA]",
    icon: "bg-[#FFF7ED] text-[#C2410C]",
    progress: "bg-[#C2410C]",
    softPanel: "border-[#FED7AA] bg-[#FFF7ED]",
    text: "text-[#C2410C]",
  },
  critical: {
    accentBorder: "border-l-[#B91C1C]",
    badge: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
    border: "border-[#FECACA]",
    icon: "bg-[#FEF2F2] text-[#B91C1C]",
    progress: "bg-[#B91C1C]",
    softPanel: "border-[#FECACA] bg-[#FEF2F2]",
    text: "text-[#B91C1C]",
  },
  review: {
    accentBorder: "border-l-[#4338CA]",
    badge: "border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]",
    border: "border-[#C7D2FE]",
    icon: "bg-[#EEF2FF] text-[#4338CA]",
    progress: "bg-[#4338CA]",
    softPanel: "border-[#C7D2FE] bg-[#EEF2FF]",
    text: "text-[#4338CA]",
  },
};
