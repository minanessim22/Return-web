import Image from "next/image";
import Link from "next/link";

import { MobileShell } from "@/components/screens/mobile-shell";
import { ScreenNav } from "@/components/screens/screen-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { heroArtwork, heroIllustrationAlt, keyFeatures } from "@/data/mock-data";

type IllustrationScreenProps = {
  current: "illustration-2" | "illustration-3";
};

export function IllustrationScreen({ current }: IllustrationScreenProps) {
  const isSecond = current === "illustration-2";

  return (
    <MobileShell>
      <ScreenNav current={current} />
      <section className="space-y-4 bg-white p-3">
        <header className="rounded-2xl border border-brand-blue/10 bg-[linear-gradient(120deg,#ECF6FF_0%,#F6FFE8_100%)] p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {isSecond ? (
                <>
                  <h1 className="text-2xl font-semibold leading-tight text-brand-blue">Be the Reason</h1>
                  <h2 className="text-2xl font-semibold leading-tight text-brand-green">Someone Gets</h2>
                  <h2 className="text-2xl font-semibold leading-tight text-brand-green">Home</h2>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold leading-tight text-brand-blue">Simple Steps</h1>
                  <h2 className="text-2xl font-bold leading-tight text-brand-blue">Smart Technology</h2>
                  <h2 className="text-2xl font-bold leading-tight text-brand-green">Safe Reunions</h2>
                </>
              )}
            </div>
            <Image
              src={isSecond ? heroArtwork : heroIllustrationAlt}
              alt="illustration"
              width={120}
              height={104}
              className="h-24 w-28 rounded-xl object-cover"
              priority
            />
          </div>
        </header>

        <Card className="border-brand-blue/10 p-3">
          <p className="text-[11px] font-semibold text-brand-dark">Key Features</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {keyFeatures.map((feature) => (
              <div key={feature.id} className="rounded-2xl border border-brand-blue/10 bg-brand-light p-2 text-center">
                <Image src={feature.image} alt={feature.title} width={40} height={40} className="mx-auto h-10 w-10 rounded-full object-cover" />
                <p className="mt-1 text-[10px] text-brand-dark">{feature.title}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/guest-homepage">
            <Button variant="outline" className="h-10 w-full text-xs">
              Back to Home
            </Button>
          </Link>
          <Link href={isSecond ? "/illustration-3" : "/login"}>
            <Button className="h-10 w-full text-xs">{isSecond ? "Next Illustration" : "Continue"}</Button>
          </Link>
        </div>
      </section>
    </MobileShell>
  );
}
