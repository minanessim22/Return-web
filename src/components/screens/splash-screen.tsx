import Image from "next/image";

import { MobileShell } from "@/components/screens/mobile-shell";
import { ScreenNav } from "@/components/screens/screen-nav";
import { splashLogos } from "@/data/mock-data";
import { cn } from "@/lib/utils";

type SplashScreenProps = {
  current: string;
  variant: "empty" | "logo-large" | "logo-small" | "wordmark";
};

export function SplashScreen({ current, variant }: SplashScreenProps) {
  return (
    <MobileShell>
      <ScreenNav current={current} />
      <section className="relative flex min-h-[480px] items-center justify-center bg-white sm:min-h-[600px] md:min-h-[700px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(96,193,15,0.1),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(1,76,179,0.1),transparent_42%)]" />

        {variant === "empty" ? (
          <div className="h-4 w-4 animate-pulse rounded-full bg-brand-blue/30" />
        ) : null}

        {variant === "logo-large" ? (
          <Image src={splashLogos.symbol} alt="Return symbol" width={86} height={86} className="relative" priority />
        ) : null}

        {variant === "logo-small" ? (
          <Image
            src={splashLogos.symbol}
            alt="Return symbol"
            width={34}
            height={34}
            className={cn("relative", current === "splash-4" ? "opacity-90" : "")}
            priority
          />
        ) : null}

        {variant === "wordmark" ? (
          <Image src={splashLogos.wordmark} alt="Return wordmark" width={170} height={64} className="relative" priority />
        ) : null}
      </section>
    </MobileShell>
  );
}
