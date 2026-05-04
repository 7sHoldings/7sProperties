"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, startOfMonth, addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { Zap } from "lucide-react";

/**
 * Generates expenses for any recurring template that's due in a given month.
 * Idempotent — won't double-generate (uses last_generated_for to track).
 */
export default function GenerateRecurringButton() {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setBusy(false);
      return;
    }

    const { data: templates } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("active", true);

    if (!templates || templates.length === 0) {
      toast.info("No active recurring templates");
      setBusy(false);
      return;
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    let created = 0;
    let skipped = 0;

    for (const t of templates as any[]) {
      // Determine due months between (last_generated_for + 1) and now
      const start = new Date(t.start_date);
      const end = t.end_date ? new Date(t.end_date) : null;
      const lastGen = t.last_generated_for ? new Date(t.last_generated_for) : null;

      // Step from start (or month after lastGen) up to current month
      let cursor = lastGen ? addMonths(startOfMonth(lastGen), 1) : startOfMonth(start);
      const stepMonths = t.frequency === "monthly" ? 1 : t.frequency === "quarterly" ? 3 : 12;

      while (cursor <= thisMonthStart) {
        if (cursor < startOfMonth(start)) {
          cursor = addMonths(cursor, stepMonths);
          continue;
        }
        if (end && cursor > end) break;

        const expenseDate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(t.day_of_month || 1, 28));

        const { error } = await supabase.from("expenses").insert({
          owner_id: user.id,
          property_id: t.property_id,
          expense_date: format(expenseDate, "yyyy-MM-dd"),
          amount: t.amount,
          category: t.category,
          description: `${t.description} (auto-generated)`,
          vendor: t.vendor,
          notes: t.notes,
        });

        if (error) {
          toast.error(error.message);
          setBusy(false);
          return;
        }
        created++;

        await supabase
          .from("recurring_expenses")
          .update({ last_generated_for: format(cursor, "yyyy-MM-dd") })
          .eq("id", t.id);

        cursor = addMonths(cursor, stepMonths);
      }

      if (lastGen && format(thisMonthStart, "yyyy-MM") <= format(addMonths(lastGen, stepMonths - 1), "yyyy-MM")) {
        skipped++;
      }
    }

    setBusy(false);
    if (created === 0 && skipped > 0) {
      toast.info("Already up to date — nothing to generate");
    } else if (created === 0) {
      toast.info("Nothing due to generate yet");
    } else {
      toast.success(`Created ${created} expense${created === 1 ? "" : "s"}`);
    }
    router.refresh();
  }

  return (
    <Button onClick={generate} loading={busy} variant="primary">
      <Zap className="w-3.5 h-3.5" />
      Generate due expenses
    </Button>
  );
}
