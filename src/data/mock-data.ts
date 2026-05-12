export type Feature = {
  id: string;
  title: string;
  image: string;
};

export type Category = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

export type NearbyCard = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

export const keyFeatures: Feature[] = [
  { id: "smart-map", title: "Smart Map", image: "/photos/83ce4478844892bd117ed1ef591d71fc461862e2.png" },
  { id: "ai-search", title: "AI Search", image: "/photos/dc47a43d990bf2cefa93f6a6cb74d1360ca2ef8c.png" },
  { id: "safe-track", title: "Safe Track", image: "/photos/b42424bb69fe85a3a904a433675e34e1ea650213.png" },
  { id: "nfc-qr", title: "NFC / QR", image: "/photos/170670def869b68c698a376f7d6a581a486327f0.png" }
];

export const categories: Category[] = [
  { id: "people", title: "People", subtitle: "Missing children and elderly", image: "/photos/6cc249e563fe624f9febc4bf359f6eb3f618763a.png" },
  { id: "vehicles", title: "Vehicles", subtitle: "Cars and bicycles", image: "/photos/6cc249e563fe624f9febc4bf359f6eb3f618763a.png" },
  { id: "pets", title: "Pets", subtitle: "Dogs, cats and more", image: "/photos/6cc249e563fe624f9febc4bf359f6eb3f618763a.png" },
  { id: "belongings", title: "Personal Belongings", subtitle: "Bags and documents", image: "/photos/6cc249e563fe624f9febc4bf359f6eb3f618763a.png" }
];

export const nearbyResults: NearbyCard[] = [
  { id: "1", title: "Family Reconnected", subtitle: "2.1 km away", image: "/photos/73c09f8d5515d985134559c99f6a4886bb92a6b0.png" },
  { id: "2", title: "Neighborhood Alert", subtitle: "1.4 km away", image: "/photos/b181d86a9345cc2b6d59105dfa3dd28ec38728a1.png" },
  { id: "3", title: "Verified Match", subtitle: "4.8 km away", image: "/photos/c37064bfa605c4314300409244359be3804e37d8.png" }
];

export const splashLogos = {
  symbol: "/photos/5219dbbcc2f780488bc9595ef7c63877a8b75841 (1).png",
  wordmark: "/photos/83d973aa5e838276758a31019e54a43eb15dd739.png"
};

export const authArtwork = "/photos/b42424bb69fe85a3a904a433675e34e1ea650213.png";
export const heroArtwork = "/photos/b181d86a9345cc2b6d59105dfa3dd28ec38728a1.png";
export const heroIllustrationAlt = "/photos/13879a10d2d96c2420f12813b8dbbd74cc4b3855.png";
