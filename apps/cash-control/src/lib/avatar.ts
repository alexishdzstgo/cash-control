import { Avatar } from "@dicebear/core";
import avataaarsNeutral from "@dicebear/styles/avataaars-neutral.json";
import shapes from "@dicebear/styles/shapes.json";
import type { UserAvatar } from "@/types/user";

export const DEFAULT_AVATAR_STYLE = "avataaars-neutral" as const;
type GeneratedAvatarStyle = Extract<UserAvatar, { type: "generated" }>["style"];

const avatarStyles = {
  "avataaars-neutral": avataaarsNeutral,
  shapes,
};

export function generateAvatarSvg(
  avatar: UserAvatar | undefined,
): string | null {
  if (!avatar || avatar.type !== "generated") return null;

  try {
    return new Avatar(avatarStyles[avatar.style], {
      seed: avatar.seed,
    }).toString();
  } catch {
    return null;
  }
}

export function generateAvatarOptions({
  userId,
  style = DEFAULT_AVATAR_STYLE,
  count = 12,
}: {
  userId: string;
  style?: GeneratedAvatarStyle;
  count?: number;
}): UserAvatar[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "generated",
    style,
    seed: `${userId}-avatar-${String(index + 1).padStart(2, "0")}`,
  }));
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function areSameAvatar(
  first: UserAvatar | undefined,
  second: UserAvatar | undefined,
): boolean {
  if (!first && !second) return true;
  if (!first || !second) return false;
  if (first.type !== second.type) return false;
  if (first.type === "initials" && second.type === "initials") return true;
  if (first.type !== "generated" || second.type !== "generated") return false;

  return first.style === second.style && first.seed === second.seed;
}
