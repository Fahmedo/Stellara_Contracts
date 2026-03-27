import Image from "next/image";
import Link from "next/link";
import FeatureStrip from "./FeatureStrip";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col bg-black pt-24">
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-8 px-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
        <div className="flex flex-col gap-5">
          <h1 className="text-3xl font-light leading-tight tracking-tight text-white sm:text-4xl lg:text-[3.25rem] lg:leading-[1.15]">
            <span className="italic text-primary">Learn</span>. Trade. Connect.
            <br />
            Powered by AI on{" "}
            <span className="italic text-primary">Stellar</span>.
          </h1>

          <p className="text-base leading-relaxed text-white sm:text-lg">
            Stellara AI is an all-in-one Web3 academy combining AI-powered learning, social crypto insights, and real on-chain trading — built on Stellar.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="#get-started"
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
            <Link
              href="#learn-more"
              className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white/5"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center lg:justify-end">
          <Image
            src="/images/heroImage.png"
            alt="Stellara AI assistant"
            width={500}
            height={500}
            className="h-auto w-full max-w-sm object-contain lg:max-w-md xl:max-w-lg"
            priority
            unoptimized
          />
        </div>
      </div>

      <FeatureStrip />
    </section>
  );
}
