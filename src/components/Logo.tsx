"use client";

import Link from "next/link";
import Image from "next/image";

type Props = {
  className?: string;
  width?: number;
  height?: number;
  invert?: boolean;
  priority?: boolean;
  href?: string;
};

export function Logo({ className, width = 120, height = 36, invert = false, priority = false, href = "/" }: Props) {
  const classes = ["inline-block", className || "", invert ? "brightness-0 invert" : ""].filter(Boolean).join(" ");

  return (
    <Link href={href} className={classes} aria-label="RETURN home">
      <Image src="/photos/8.png" alt="RETURN" width={width} height={height} className="object-contain" priority={priority} />
    </Link>
  );
}
