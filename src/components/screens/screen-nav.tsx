import Link from "next/link";

const routes = [
  "splash-1",
  "splash-2",
  "splash-3",
  "splash-4",
  "splash-7",
  "guest-homepage",
  "illustration-2",
  "illustration-3",
  "login",
  "sign-in",
  "missing-finder"
];

type ScreenNavProps = {
  current: string;
};

export function ScreenNav({ current }: ScreenNavProps) {
  return (
    <div className="border-b border-brand-blue/10 bg-brand-blue px-3 py-2 text-[10px] text-white">
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap">
        {routes.map((route) => (
          <Link
            key={route}
            href={`/${route}`}
            className={
              route === current
                ? "rounded-full bg-white px-2 py-1 font-semibold text-brand-blue"
                : "rounded-full bg-white/20 px-2 py-1 text-white/95"
            }
          >
            {route}
          </Link>
        ))}
      </div>
    </div>
  );
}
