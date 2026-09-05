import { z } from "zod";

// Coerce empty string -> undefined for optional fields
const optionalStr = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

const optionalNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional()
);

// US ZIP: 5 digits or 5+4
const zipRegex = /^\d{5}(-\d{4})?$/;
// Loose phone validation: 7+ digits with separators
const phoneRegex = /^[\d\s().+-]{7,}$/;

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Too long"),
  address: z.string().trim().min(1, "Address is required").max(200, "Too long"),
  city: optionalStr,
  state: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(40).optional()
  ),
  zip: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(zipRegex, "Use 12345 or 12345-6789").optional()
  ),
  property_type: z.string().min(1, "Select a type"),
  square_feet: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().positive("Must be positive").max(1_000_000).optional()
  ),
  bedrooms: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().nonnegative().max(50).optional()
  ),
  bathrooms: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().max(50).optional()
  ),
  purchase_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative("Cannot be negative").optional()
  ),
  purchase_date: optionalStr,
  notes: optionalStr,
});
export type PropertyValues = z.input<typeof propertySchema>;
export type PropertyInput = z.output<typeof propertySchema>;

export const tenantSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().email("Invalid email").optional()
  ),
  phone: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(phoneRegex, "Invalid phone number").optional()
  ),
  emergency_contact_name: optionalStr,
  emergency_contact_phone: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(phoneRegex, "Invalid phone number").optional()
  ),
  notes: optionalStr,
  // Optional lease fields (only validated together)
  unit_id: optionalStr,
  start_date: optionalStr,
  end_date: optionalStr,
  monthly_rent: optionalNum,
  security_deposit: optionalNum,
  rent_due_day: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1, "Day must be 1-31").max(31, "Day must be 1-31").optional()
  ),
}).refine(
  (data) => {
    if (!data.unit_id) return true;
    return Boolean(data.start_date && data.end_date && data.monthly_rent && data.monthly_rent > 0);
  },
  { message: "Lease requires start, end, and rent", path: ["unit_id"] }
).refine(
  (data) => {
    if (!data.start_date || !data.end_date) return true;
    return new Date(data.end_date) >= new Date(data.start_date);
  },
  { message: "End date must be after start", path: ["end_date"] }
);
export type TenantValues = z.input<typeof tenantSchema>;
export type TenantInput = z.output<typeof tenantSchema>;

const today = () => new Date().toISOString().slice(0, 10);

export const paymentSchema = z.object({
  lease_id: z.string().min(1, "Select a lease"),
  payment_type: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? "rent" : v),
    z.enum(["rent", "deposit"])
  ),
  payment_date: z
    .string()
    .min(1, "Date is required")
    .refine((d) => d <= today(), "Date cannot be in the future"),
  for_month: z
    .string()
    .min(1, "Month is required")
    .refine((d) => /^\d{4}-\d{2}$/.test(d), "Pick a month"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Amount must be greater than 0")
  ),
  payment_method: optionalStr,
  reference_number: optionalStr,
  notes: optionalStr,
});
export type PaymentValues = z.input<typeof paymentSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;

export const expenseSchema = z.object({
  property_id: z.string().min(1, "Select a property"),
  expense_date: z
    .string()
    .min(1, "Date is required")
    .refine((d) => d <= today(), "Date cannot be in the future"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Amount must be greater than 0")
  ),
  category: z.string().min(1, "Category required"),
  description: z.string().trim().min(1, "Description required").max(200),
  vendor: optionalStr,
  notes: optionalStr,
});
export type ExpenseValues = z.input<typeof expenseSchema>;
export type ExpenseInput = z.output<typeof expenseSchema>;

export const maintenanceSchema = z.object({
  property_id: z.string().min(1, "Select a property"),
  title: z.string().trim().min(1, "Title required").max(150),
  description: optionalStr,
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]),
  reported_date: z
    .string()
    .min(1, "Date required")
    .refine((d) => d <= today(), "Date cannot be in the future"),
  completed_date: optionalStr,
  contractor: optionalStr,
  cost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative("Cannot be negative").optional()
  ),
  notes: optionalStr,
});
export type MaintenanceValues = z.input<typeof maintenanceSchema>;
export type MaintenanceInput = z.output<typeof maintenanceSchema>;

export const distributionSchema = z.object({
  property_id: optionalStr,
  distribution_date: z
    .string()
    .min(1, "Date is required")
    .refine((d) => d <= today(), "Date cannot be in the future"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Amount must be greater than 0")
  ),
  destination: z.string().trim().min(1, "Where did the money go?").max(150),
  payment_method: optionalStr,
  type: z.enum(["distribution", "contribution"]).default("distribution"),
  notes: optionalStr,
});
export type DistributionValues = z.input<typeof distributionSchema>;
export type DistributionInput = z.output<typeof distributionSchema>;

export const recurringExpenseSchema = z.object({
  property_id: optionalStr,
  category: z.string().min(1, "Category required"),
  description: z.string().trim().min(1, "Description required").max(200),
  vendor: optionalStr,
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Amount must be greater than 0")
  ),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  start_date: z.string().min(1, "Start date required"),
  end_date: optionalStr,
  day_of_month: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
    z.number().int().min(1, "1-28").max(28, "1-28")
  ),
  active: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean().default(true)),
  notes: optionalStr,
});
export type RecurringExpenseValues = z.input<typeof recurringExpenseSchema>;
export type RecurringExpenseInput = z.output<typeof recurringExpenseSchema>;

export const mileageSchema = z.object({
  property_id: optionalStr,
  trip_date: z
    .string()
    .min(1, "Date required")
    .refine((d) => d <= today(), "Date cannot be in the future"),
  miles: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Miles required" }).positive("Must be greater than 0")
  ),
  purpose: z.string().trim().min(1, "What was the trip for?").max(200),
  notes: optionalStr,
});
export type MileageValues = z.input<typeof mileageSchema>;
export type MileageInput = z.output<typeof mileageSchema>;

export const mortgageSchema = z.object({
  lender: optionalStr,
  original_principal: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().optional()
  ),
  current_balance: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().optional()
  ),
  interest_rate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(99).optional()
  ),
  monthly_payment: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().optional()
  ),
  term_months: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().positive().optional()
  ),
  start_date: optionalStr,
  notes: optionalStr,
});
export type MortgageValues = z.input<typeof mortgageSchema>;
export type MortgageInput = z.output<typeof mortgageSchema>;

export const lateFeeSchema = z.object({
  charge_date: z.string().min(1, "Date required"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Must be greater than 0")
  ),
  description: z.string().trim().min(1, "Reason required").max(200),
});
export type LateFeeValues = z.input<typeof lateFeeSchema>;
export type LateFeeInput = z.output<typeof lateFeeSchema>;

export const depositTxSchema = z.object({
  transaction_date: z.string().min(1, "Date required"),
  transaction_type: z.enum(["refund", "deduction"]),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Must be greater than 0")
  ),
  description: z.string().trim().min(1, "Reason required").max(200),
  notes: optionalStr,
});
export type DepositTxValues = z.input<typeof depositTxSchema>;
export type DepositTxInput = z.output<typeof depositTxSchema>;

export const constructionProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  address: optionalStr,
  city: optionalStr,
  state: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(40).optional()
  ),
  zip: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(zipRegex, "Use 12345 or 12345-6789").optional()
  ),
  property_type: optionalStr,
  status: z.enum(["planning", "in_progress", "on_hold", "completed"]),
  start_date: optionalStr,
  expected_completion_date: optionalStr,
  actual_completion_date: optionalStr,
  budget: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative("Cannot be negative").optional()
  ),
  bedrooms: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().nonnegative().max(50).optional()
  ),
  bathrooms: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().max(50).optional()
  ),
  square_feet: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().positive("Must be positive").max(1_000_000).optional()
  ),
  notes: optionalStr,
});
export type ConstructionProjectValues = z.input<typeof constructionProjectSchema>;
export type ConstructionProjectInput = z.output<typeof constructionProjectSchema>;

export const constructionExpenseSchema = z.object({
  project_id: z.string().min(1, "Select a project"),
  expense_date: z.string().min(1, "Date is required"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Amount required" }).positive("Amount must be greater than 0")
  ),
  category: z.string().min(1, "Category required"),
  description: z.string().trim().min(1, "Description required").max(200),
  vendor: optionalStr,
  notes: optionalStr,
});
export type ConstructionExpenseValues = z.input<typeof constructionExpenseSchema>;
export type ConstructionExpenseInput = z.output<typeof constructionExpenseSchema>;

export const leaseSchema = z.object({
  tenant_id: z.string().min(1, "Select a tenant"),
  unit_id: z.string().min(1, "Select a unit"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  monthly_rent: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: "Rent required" }).positive("Must be greater than 0")
  ),
  security_deposit: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().optional()
  ),
  rent_due_day: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
    z.number().int().min(1, "1-31").max(31, "1-31")
  ),
  notes: optionalStr,
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  { message: "End date must be after start", path: ["end_date"] }
);
export type LeaseValues = z.input<typeof leaseSchema>;
export type LeaseInput = z.output<typeof leaseSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;
