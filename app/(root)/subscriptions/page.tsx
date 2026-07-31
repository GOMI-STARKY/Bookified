import { PLAN_LIMITS, PLANS } from "@/lib/subscription-constants";

export default function SubscriptionsPage() {
  const plans = [
    { key: PLANS.FREE, label: "Free", price: "$0", description: "Get started with basic features" },
    { key: PLANS.STANDARD, label: "Standard", price: "$9", description: "For regular readers", popular: true },
    { key: PLANS.PRO, label: "Pro", price: "$19", description: "For avid readers" },
  ];

  return (
    <div className="container wrapper py-10">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl font-bold font-serif mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl">
          Upgrade to unlock more books, longer sessions, and advanced features.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map(({ key, label, price, description, popular }) => {
          const limits = PLAN_LIMITS[key];

          return (
            <div
              key={key}
              className={`border rounded-xl p-6 flex flex-col relative shadow-soft-sm ${
                popular ? "border-2 border-[var(--color-brand)] shadow-soft-md" : ""
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-brand)] text-white text-xs px-3 py-1 rounded-full shadow-soft-sm">
                  Popular
                </span>
              )}
              <h2 className="text-xl font-bold mb-2">{label}</h2>
              <p className="text-muted-foreground text-sm mb-4">{description}</p>
              <p className="text-3xl font-bold mb-6">
                {price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="space-y-2 text-sm mb-6 flex-1">
                <li>{limits.maxBooks} {limits.maxBooks === 1 ? "book" : "books"}</li>
                <li>{limits.maxSessionsPerMonth} sessions/mo</li>
                <li>{limits.maxDurationPerSession} min sessions</li>
                <li>{limits.hasSessionHistory ? "Session history" : "No session history"}</li>
              </ul>
              <button
                className={`w-full py-2 rounded-lg font-medium transition-all duration-200 ${
                  key === PLANS.FREE
                    ? "border border-[var(--border-medium)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-60 cursor-not-allowed"
                }`}
                disabled={key !== PLANS.FREE}
              >
                {key === PLANS.FREE ? "Current Plan" : "Coming Soon"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
