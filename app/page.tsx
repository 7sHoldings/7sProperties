import Link from "next/link";
import {
  Building2,
  Users,
  DollarSign,
  Wrench,
  ChevronRight,
  Bed,
  Bath,
  Square,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  single_family: "Single family",
  duplex: "Duplex",
  triplex: "Triplex",
  fourplex: "Fourplex",
  condo: "Condo",
  apartment: "Apartment",
  townhouse: "Townhouse",
  other: "Other",
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: listings } = await supabase.rpc("public_listings");
  const featured = (listings || []).slice(0, 6) as any[];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-teal-700 text-white flex items-center justify-center font-bold tracking-tight">
              7s
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-stone-900">7s Rental</div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500">
                Property manager
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="#listings"
              className="hidden sm:inline-block px-3 py-1.5 text-sm text-stone-700 hover:text-teal-700"
            >
              Available rentals
            </Link>
            <Link
              href="/tenant/login"
              className="px-3 py-1.5 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
            >
              Tenant sign in
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
            >
              Owner sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            Built for small landlords
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-stone-900 leading-tight">
            Rental property management,
            <span className="bg-gradient-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent">
              {" "}
              done simply.
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-stone-600 max-w-2xl mx-auto">
            Track rent, expenses, maintenance, and tenants in one place. Generate tax-ready
            reports. Give tenants their own portal. All without the bloat of enterprise software.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 text-white text-sm font-medium rounded-md hover:bg-teal-800"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-stone-200 text-stone-700 text-sm font-medium rounded-md hover:bg-stone-50"
            >
              See features
            </Link>
          </div>
        </div>
      </section>

      {/* Login picker */}
      <section className="px-4 sm:px-6 pb-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LoginCard
            href="/login"
            title="I'm a property owner"
            description="Manage your portfolio, collect rent, track expenses, and generate reports."
            iconBg="bg-teal-100"
            iconColor="text-teal-700"
            icon={<Building2 className="w-5 h-5" />}
          />
          <LoginCard
            href="/tenant/login"
            title="I'm a tenant"
            description="View your lease, payment history, submit maintenance requests, and access documents."
            iconBg="bg-blue-100"
            iconColor="text-blue-700"
            icon={<Users className="w-5 h-5" />}
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 sm:px-6 py-16 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-medium text-stone-900">
              Everything you need to run your rentals
            </h2>
            <p className="mt-2 text-stone-600">No spreadsheets, no fragmented tools.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Feature
              icon={<Building2 className="w-5 h-5" />}
              title="Properties & units"
              text="Track every property's vacancy, monthly cashflow, and mortgage in one place."
            />
            <Feature
              icon={<DollarSign className="w-5 h-5" />}
              title="Rent collection"
              text="Record payments, see who's paid, who's late, with running tenant ledgers and late fees."
            />
            <Feature
              icon={<Wrench className="w-5 h-5" />}
              title="Maintenance"
              text="Tenants submit requests, you assign contractors and track costs per property."
            />
            <Feature
              icon={<Users className="w-5 h-5" />}
              title="Tenant portal"
              text="Each tenant gets their own login. View lease, payments, documents, submit issues."
            />
          </div>
        </div>
      </section>

      {/* Listings */}
      <section id="listings" className="px-4 sm:px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-3xl font-medium text-stone-900">Available rentals</h2>
              <p className="mt-1 text-stone-600">
                {featured.length > 0
                  ? `${featured.length} ${featured.length === 1 ? "property" : "properties"} with vacancies`
                  : "Listings appear here automatically when units become vacant."}
              </p>
            </div>
          </div>

          {featured.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <p className="text-stone-600">No vacant units available right now.</p>
              <p className="text-sm text-stone-500 mt-1">Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featured.map((p) => (
                <ListingCard key={p.property_id} listing={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-teal-700 to-emerald-700 rounded-2xl p-8 sm:p-10 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-medium">Ready to manage smarter?</h2>
          <p className="mt-2 text-teal-50">
            Start tracking your rentals today — no setup fees, no per-unit pricing.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 bg-white text-teal-800 text-sm font-medium rounded-md hover:bg-teal-50"
          >
            Get started
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-teal-700 text-white flex items-center justify-center text-xs font-bold">
              7s
            </div>
            <span>© {new Date().getFullYear()} 7s Rental</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-teal-700">
              Owner sign in
            </Link>
            <Link href="/tenant/login" className="hover:text-teal-700">
              Tenant sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoginCard({
  href,
  title,
  description,
  icon,
  iconBg,
  iconColor,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-stone-200 rounded-xl p-5 hover:border-teal-400 hover:shadow-md transition flex items-start gap-4"
    >
      <div className={`${iconBg} ${iconColor} rounded-lg p-2.5 flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-stone-900 flex items-center gap-1">
          {title}
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition" />
        </h3>
        <p className="text-sm text-stone-600 mt-1">{description}</p>
      </div>
    </Link>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
      <div className="w-9 h-9 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-medium text-stone-900">{title}</h3>
      <p className="text-sm text-stone-600 mt-1">{text}</p>
    </div>
  );
}

function ListingCard({ listing }: { listing: any }) {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-sm transition">
      <div className="h-40 bg-gradient-to-br from-stone-100 via-teal-50 to-stone-200 flex items-center justify-center">
        <Building2 className="w-12 h-12 text-stone-400" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-stone-900 truncate">{listing.property_name}</h3>
          <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-800 font-medium whitespace-nowrap">
            Available
          </span>
        </div>
        {location && (
          <p className="text-sm text-stone-500 flex items-center gap-1 mb-3">
            <MapPin className="w-3.5 h-3.5" />
            {location}
          </p>
        )}
        <div className="flex items-center gap-3 text-sm text-stone-600 border-t border-stone-100 pt-3">
          {listing.bedrooms && (
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" /> {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" /> {listing.bathrooms}
            </span>
          )}
          {listing.square_feet && (
            <span className="flex items-center gap-1">
              <Square className="w-3.5 h-3.5" />
              {Number(listing.square_feet).toLocaleString()} sq ft
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-stone-500 capitalize">
            {PROPERTY_TYPE_LABEL[listing.property_type] || listing.property_type}
          </span>
          {listing.asking_rent && (
            <span className="text-sm font-semibold text-stone-900">
              ${Number(listing.asking_rent).toLocaleString()}
              <span className="text-xs font-normal text-stone-500">/mo</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
