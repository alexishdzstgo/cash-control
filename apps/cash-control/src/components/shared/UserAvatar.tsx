import { generateAvatarSvg, getUserInitials } from "@/lib/avatar";
import type { UserAvatar as UserAvatarModel } from "@/types/user";

type UserAvatarProps = {
  name: string;
  avatar?: UserAvatarModel;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function UserAvatar({
  name,
  avatar,
  size = "md",
  className,
}: UserAvatarProps) {
  const svg = generateAvatarSvg(avatar);
  const baseClass = `${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EFF6FF] font-bold text-[#2563EB] transition ${className ?? ""}`;

  if (!svg) {
    return (
      <div className={baseClass} role="img" aria-label={`Avatar de ${name}`}>
        {getUserInitials(name)}
      </div>
    );
  }

  return (
    <div
      className={baseClass}
      role="img"
      aria-label={`Avatar de ${name}`}
      // DiceBear genera este SVG localmente desde @dicebear/core y @dicebear/styles.
      // No se acepta SVG ingresado por usuarios ni URLs remotas.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG local generado por DiceBear; no acepta entrada HTML/SVG de usuarios.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
