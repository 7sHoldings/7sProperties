// Shared rental P&L calculation. Dashboard and Reports both call this so
// the numbers always agree.
//
// Formula:
//   Rent income
//    − Operating expenses (everything except category = "mortgage")
//    = Net Operating Income (NOI)
//    − Debt service (category = "mortgage")
//    = Actual profit (cash flow)
//    − Profit taken out (distributions, excluding type = "contribution")
//    = Available to distribute

export type PnLInputs = {
  payments: { amount: number | string }[];
  expenses: { amount: number | string; category?: string | null }[];
  distributions?: { amount: number | string; type?: string | null }[];
};

export type PnL = {
  rentIncome: number;
  opEx: number;
  debtService: number;
  noi: number;
  actualProfit: number;
  profitTakenOut: number;
  availableToDistribute: number;
  margin: number; // NOI / rentIncome, as %
};

export function computePnL(inputs: PnLInputs): PnL {
  const rentIncome = (inputs.payments || []).reduce(
    (s, p) => s + Number(p.amount),
    0
  );
  let opEx = 0;
  let debtService = 0;
  for (const e of inputs.expenses || []) {
    const amt = Number(e.amount);
    if (e.category === "mortgage") debtService += amt;
    else opEx += amt;
  }
  const profitTakenOut = (inputs.distributions || [])
    .filter((d) => d.type !== "contribution")
    .reduce((s, d) => s + Number(d.amount), 0);

  const noi = rentIncome - opEx;
  const actualProfit = noi - debtService;
  const availableToDistribute = actualProfit - profitTakenOut;
  const margin = rentIncome > 0 ? Math.round((noi / rentIncome) * 100) : 0;

  return {
    rentIncome,
    opEx,
    debtService,
    noi,
    actualProfit,
    profitTakenOut,
    availableToDistribute,
    margin,
  };
}
