import Image from "next/image";

const FEATURES = [
  {
    icon: "/images/aiPoweredCryptoEdu.png",
    label: "AI-Powered Crypto Education",
  },
  {
    icon: "/images/stellar.png",
    label: "Stellar Blockchain",
  },
  {
    icon: "/images/communitynscoial.png",
    label: "Community & Social",
  },
  {
    icon: "/images/tradingnwallet.png",
    label: "Trading & Wallet",
  },
] as const;

export default function FeatureStrip() {
  return (
    <div className="bg-black py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6">
        {FEATURES.map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-lg font-medium text-white"
          >
            <Image
              src={icon}
              alt={label}
              width={36}
              height={36}
              className="h-9 w-9"
              unoptimized
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
