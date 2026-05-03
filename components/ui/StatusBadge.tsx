type Tone = "green" | "red" | "amber" | "stone" | "blue";

const tones: Record<Tone, string> = {
  green: "bg-green-50 text-green-800",
  red: "bg-red-50 text-red-800",
  amber: "bg-amber-50 text-amber-800",
  stone: "bg-stone-100 text-stone-700",
  blue: "bg-blue-50 text-blue-800",
};

export default function StatusBadge({
  tone = "stone",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-md font-medium capitalize ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
