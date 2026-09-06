// Payment type helpers.
//
// `payments.payment_type` is added by supabase/v13-payment-type.sql. The app
// must keep working whether or not that migration has been run yet: a query
// that names a column the database doesn't have fails outright, and silently
// turning that failure into an empty list makes real payment history look
// deleted. Everything here exists so that never happens again.

export type PaymentType = "rent" | "deposit";

/** Rows written before v13 have no payment_type — those are all rent. */
export function paymentTypeOf(row: any): PaymentType {
  return row?.payment_type === "deposit" ? "deposit" : "rent";
}

export function isDepositPayment(row: any): boolean {
  return paymentTypeOf(row) === "deposit";
}

/** Rent only — what counts toward rent collection, income, and cashflow. */
export function rentOnly<T>(rows: T[]): T[] {
  return rows.filter((r) => !isDepositPayment(r));
}

/**
 * True when a query failed *only* because payments.payment_type isn't there
 * yet — the migration hasn't been run, or PostgREST's schema cache is stale.
 * Any other error is a real error and is never swallowed.
 */
export function isMissingPaymentTypeColumn(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const text = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
  if (!/payment_type/i.test(text)) return false;
  // 42703 = undefined_column, PGRST204 = column missing from the schema cache
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(text)
  );
}

// The Supabase client infers a row type from the literal select string, and a
// select that varies with `withType` defeats that inference. Rows come back as
// `any` here; callers read them through paymentTypeOf() and the page's own
// types, exactly as they did before.
type QueryResult = { data: any; error: any };

/**
 * Run a payments query that mentions payment_type, retrying without the column
 * if the database doesn't have it yet. Pre-v13 every payment is rent, so the
 * fallback rows are complete and correct — callers classify with
 * paymentTypeOf(), which reads a missing value as rent.
 *
 * Returns the rows plus `missingColumn` so a page can tell the user the
 * migration is outstanding instead of just showing less.
 */
export async function selectPaymentsWithStatus<T = any>(
  build: (withType: boolean) => PromiseLike<QueryResult>
): Promise<{ rows: T[]; missingColumn: boolean; error: any }> {
  const res = await build(true);
  if (!res.error) return { rows: res.data || [], missingColumn: false, error: null };

  if (isMissingPaymentTypeColumn(res.error)) {
    const fallback = await build(false);
    if (fallback.error) {
      console.error("[payments] query failed", fallback.error);
      return { rows: [], missingColumn: true, error: fallback.error };
    }
    return { rows: fallback.data || [], missingColumn: true, error: null };
  }

  // Never hide a real failure behind an empty list.
  console.error("[payments] query failed", res.error);
  return { rows: [], missingColumn: false, error: res.error };
}

/** selectPaymentsWithStatus, when the caller only needs the rows. */
export async function selectPayments<T = any>(
  build: (withType: boolean) => PromiseLike<QueryResult>
): Promise<T[]> {
  const { rows } = await selectPaymentsWithStatus<T>(build);
  return rows;
}

/**
 * Insert/update a payments row that carries payment_type, retrying without the
 * field if the column isn't there yet. Rent behaves exactly as it did before
 * the field existed. A deposit is NOT silently downgraded to rent — that would
 * corrupt rent totals — so the caller gets `missingColumn` and can say so.
 */
export async function writePaymentRow<T = any>(
  build: (withType: boolean) => PromiseLike<{ data: any; error: any }>,
  paymentType: PaymentType
): Promise<{ data: T | null; error: any; missingColumn: boolean }> {
  const res = await build(true);
  if (!res.error) return { ...res, missingColumn: false };
  if (!isMissingPaymentTypeColumn(res.error)) return { ...res, missingColumn: false };
  if (paymentType === "deposit") {
    return { data: null, error: res.error, missingColumn: true };
  }
  const fallback = await build(false);
  return { ...fallback, missingColumn: true };
}

export const PAYMENT_TYPE_MIGRATION = "supabase/v13-payment-type.sql";
