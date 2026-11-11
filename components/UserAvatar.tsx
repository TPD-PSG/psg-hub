"use client";

import Image from "next/image";

type Props = {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
};

export default function UserAvatar({ name, avatarUrl, size = 24 }: Props) {
  const initials = name
    ? name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: avatarUrl ? undefined : "var(--psg-blue)",
        color: "white",
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name ?? ""} fill className="object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
