/** FinanceAI questionnaire: types, steps, currencies, goal ideas and the city list. */
export type EmploymentStatus = "employed" | "self-employed" | "unemployed" | "student" | "retired";
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface FinanceIntake {
  // About you
  name: string;
  age: number;
  location: string;
  currency: string;
  dependents: number;
  employmentStatus: EmploymentStatus;

  // Income (monthly, after tax)
  primaryIncome: number;
  secondaryIncome: number;

  // Spending (monthly)
  rent: number;
  insurance: number;
  subscriptions: number;
  loanPayments: number;
  variableExpenses: number;

  // What you own and owe (balances)
  savingsBalance: number;
  emergencyFund: number;
  investments: number;
  propertyValue: number;
  totalOutstandingLoan: number;

  // Goals (free-form)
  goalSummary: string;
}

export const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string; emoji: string }[] = [
  { value: "employed", label: "Employed", emoji: "💼" },
  { value: "self-employed", label: "Self-employed", emoji: "🚀" },
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "unemployed", label: "Between jobs", emoji: "🔎" },
  { value: "retired", label: "Retired", emoji: "🌴" },
];

export const STEPS: Record<WizardStep, { title: string; subtitle: string; emoji: string }> = {
  1: { title: "About you", subtitle: "So the advice fits your life stage and city.", emoji: "👋" },
  2: { title: "Money coming in", subtitle: "Monthly, after tax. Rough numbers are fine.", emoji: "💰" },
  3: { title: "Money going out", subtitle: "A typical month. Skip anything that doesn't apply.", emoji: "🧾" },
  4: { title: "What you own & owe", subtitle: "Today's balances. Estimates are fine.", emoji: "🏦" },
  5: { title: "What you're working towards", subtitle: "Pick a few, or describe them in your own words.", emoji: "🎯" },
};

export const defaultIntake: FinanceIntake = {
  name: "", age: 30, location: "", currency: "USD", dependents: 0, employmentStatus: "employed",
  primaryIncome: 0, secondaryIncome: 0,
  rent: 0, insurance: 0, subscriptions: 0, loanPayments: 0, variableExpenses: 0,
  savingsBalance: 0, emergencyFund: 0, investments: 0, propertyValue: 0, totalOutstandingLoan: 0,
  goalSummary: "",
};

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "US Dollar" }, { code: "EUR", label: "Euro" }, { code: "GBP", label: "British Pound" },
  { code: "INR", label: "Indian Rupee" }, { code: "AED", label: "UAE Dirham" }, { code: "SAR", label: "Saudi Riyal" },
  { code: "QAR", label: "Qatari Riyal" }, { code: "KWD", label: "Kuwaiti Dinar" }, { code: "OMR", label: "Omani Rial" },
  { code: "CAD", label: "Canadian Dollar" }, { code: "AUD", label: "Australian Dollar" },
  { code: "NZD", label: "New Zealand Dollar" }, { code: "SGD", label: "Singapore Dollar" },
  { code: "MYR", label: "Malaysian Ringgit" }, { code: "JPY", label: "Japanese Yen" }, { code: "CNY", label: "Chinese Yuan" },
  { code: "HKD", label: "Hong Kong Dollar" }, { code: "KRW", label: "South Korean Won" }, { code: "CHF", label: "Swiss Franc" },
  { code: "SEK", label: "Swedish Krona" }, { code: "NOK", label: "Norwegian Krone" }, { code: "DKK", label: "Danish Krone" },
  { code: "PLN", label: "Polish Złoty" }, { code: "ZAR", label: "South African Rand" }, { code: "NGN", label: "Nigerian Naira" },
  { code: "KES", label: "Kenyan Shilling" }, { code: "EGP", label: "Egyptian Pound" }, { code: "BRL", label: "Brazilian Real" },
  { code: "MXN", label: "Mexican Peso" }, { code: "PKR", label: "Pakistani Rupee" }, { code: "BDT", label: "Bangladeshi Taka" },
  { code: "LKR", label: "Sri Lankan Rupee" }, { code: "THB", label: "Thai Baht" }, { code: "IDR", label: "Indonesian Rupiah" },
  { code: "PHP", label: "Philippine Peso" }, { code: "VND", label: "Vietnamese Dong" }, { code: "TRY", label: "Turkish Lira" },
];

const CURRENCY_CITIES: Record<string, string[]> = {
  USD: ["Atlanta", "Austin", "Baltimore", "Boston", "Charlotte", "Chicago", "Columbus", "Dallas", "Denver", "Detroit",
    "Houston", "Indianapolis", "Jacksonville", "Las Vegas", "Los Angeles", "Miami", "Minneapolis", "Nashville",
    "New York", "Philadelphia", "Phoenix", "Portland", "Quito", "Raleigh", "Salt Lake City", "San Antonio", "San Diego",
    "San Francisco", "San Jose", "Seattle", "Tampa", "Washington DC"],
  EUR: ["Amsterdam", "Athens", "Barcelona", "Berlin", "Brussels", "Dublin", "Düsseldorf", "Frankfurt", "Hamburg",
    "Helsinki", "Lisbon", "Luxembourg", "Lyon", "Madrid", "Marseille", "Milan", "Munich", "Paris", "Rome", "Rotterdam",
    "Stuttgart", "The Hague", "Vienna"],
  GBP: ["Edinburgh", "Glasgow", "London", "Manchester"],
  INR: ["Ahmedabad", "Bangalore", "Chennai", "Delhi", "Hyderabad", "Kochi", "Kolkata", "Mumbai", "Pune",
    "Thiruvananthapuram"],
  AED: ["Abu Dhabi", "Dubai"], SAR: ["Jeddah", "Mecca", "Riyadh"], QAR: ["Doha"], KWD: ["Kuwait City"], OMR: ["Muscat"],
  CAD: ["Calgary", "Montréal", "Ottawa", "Toronto", "Vancouver"], AUD: ["Brisbane", "Melbourne", "Perth", "Sydney"],
  NZD: ["Auckland"], SGD: ["Singapore"], MYR: ["Kuala Lumpur"], JPY: ["Osaka", "Tokyo"],
  CNY: ["Beijing", "Guangzhou", "Shanghai", "Shenzhen"], HKD: ["Hong Kong"], KRW: ["Seoul"], CHF: ["Geneva", "Zurich"],
  SEK: ["Stockholm"], NOK: ["Oslo"], DKK: ["Copenhagen"], PLN: ["Warsaw"], ZAR: ["Cape Town", "Durban", "Johannesburg"],
  NGN: ["Lagos"], KES: ["Nairobi"], EGP: ["Cairo"], BRL: ["São Paulo"], MXN: ["Mexico City", "Monterrey"],
  PKR: ["Karachi", "Lahore"], BDT: ["Dhaka"], LKR: ["Colombo"], THB: ["Bangkok"], IDR: ["Jakarta", "Surabaya"],
  PHP: ["Manila"], VND: ["Hanoi", "Ho Chi Minh City"], TRY: ["Ankara", "Istanbul"],
};

const CITY_CURRENCY: Record<string, string> = Object.fromEntries(
  Object.entries(CURRENCY_CITIES).flatMap(([code, cities]) => cities.map((c) => [c, code]))
);

export const currencyForCity = (city: string): string | undefined => CITY_CURRENCY[city];

/** Best guess from the browser locale, e.g. en-IN -> INR. */
export function guessCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const map: Record<string, string> = {
      US: "USD", GB: "GBP", IN: "INR", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", OM: "OMR", CA: "CAD", AU: "AUD",
      NZ: "NZD", SG: "SGD", MY: "MYR", JP: "JPY", CN: "CNY", HK: "HKD", KR: "KRW", CH: "CHF", SE: "SEK", NO: "NOK",
      DK: "DKK", PL: "PLN", ZA: "ZAR", NG: "NGN", KE: "KES", EG: "EGP", BR: "BRL", MX: "MXN", PK: "PKR", BD: "BDT",
      LK: "LKR", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", TR: "TRY",
      DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR",
    };
    return (region && map[region]) || "USD";
  } catch {
    return "USD";
  }
}

export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat(undefined, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value || code;
  } catch {
    return code;
  }
}

/** 12345.6 -> "$12,346"; compact -> "$12.3K". */
export function money(value: number | null | undefined, code: string, compact = false): string {
  const v = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact && Math.abs(v) >= 100000 ? "compact" : "standard",
    }).format(v);
  } catch {
    return `${code} ${Math.round(v).toLocaleString()}`;
  }
}

export const GOAL_IDEAS: { emoji: string; label: string; text: string }[] = [
  { emoji: "🛟", label: "Emergency fund", text: "Build a solid emergency fund" },
  { emoji: "🏠", label: "Buy a home", text: "Save a deposit to buy a home" },
  { emoji: "💳", label: "Clear debt", text: "Pay off my loans / credit cards faster" },
  { emoji: "📈", label: "Start investing", text: "Start investing regularly" },
  { emoji: "🧓", label: "Retirement", text: "Be on track for a comfortable retirement" },
  { emoji: "🎓", label: "Kids' education", text: "Save for my children's education" },
  { emoji: "🚗", label: "Buy a car", text: "Buy a car" },
  { emoji: "✈️", label: "Travel", text: "Save for travel" },
  { emoji: "🧑‍💼", label: "Start a business", text: "Save enough to start my own business" },
  { emoji: "🕊️", label: "Financial freedom", text: "Reach financial independence early" },
];

export const CITIES: string[] = [
  "Abu Dhabi", "Accra", "Addis Ababa", "Ahmedabad", "Algiers", "Amman", "Amsterdam",
  "Ankara", "Athens", "Atlanta", "Auckland", "Austin", "Baghdad", "Baku", "Baltimore",
  "Bangalore", "Bangkok", "Barcelona", "Beijing", "Beirut", "Belgrade", "Berlin", "Bogotá",
  "Boston", "Brisbane", "Brussels", "Bucharest", "Budapest", "Buenos Aires", "Cairo",
  "Calgary", "Cape Town", "Casablanca", "Charlotte", "Chennai", "Chicago", "Colombo",
  "Columbus", "Copenhagen", "Dallas", "Dar es Salaam", "Delhi", "Denver", "Detroit",
  "Dhaka", "Doha", "Dubai", "Dublin", "Durban", "Düsseldorf", "Edinburgh", "Frankfurt",
  "Geneva", "Glasgow", "Guangzhou", "Hamburg", "Hanoi", "Helsinki", "Ho Chi Minh City",
  "Hong Kong", "Houston", "Hyderabad", "Indianapolis", "Istanbul", "Jacksonville",
  "Jakarta", "Jeddah", "Johannesburg", "Karachi", "Kathmandu", "Kiev", "Kinshasa",
  "Kochi", "Kolkata", "Kuala Lumpur", "Kuwait City", "Lagos", "Lahore", "Las Vegas", "Lima",
  "Lisbon", "London", "Los Angeles", "Luanda", "Lusaka", "Luxembourg", "Lyon", "Madrid",
  "Manchester", "Manila", "Marseille", "Mecca", "Medellín", "Melbourne", "Mexico City",
  "Miami", "Milan", "Minneapolis", "Monterrey", "Montréal", "Moscow", "Mumbai", "Munich",
  "Muscat", "Nairobi", "Nashville", "New York", "Osaka", "Oslo", "Ottawa", "Paris",
  "Perth", "Philadelphia", "Phoenix", "Portland", "Prague", "Pune", "Quito", "Raleigh",
  "Riyadh", "Rome", "Rotterdam", "Salt Lake City", "San Antonio", "San Diego",
  "San Francisco", "San Jose", "Santiago", "São Paulo", "Seattle", "Seoul", "Shanghai",
  "Shenzhen", "Singapore", "Sofia", "Stockholm", "Stuttgart", "Surabaya", "Sydney",
  "Taipei", "Tampa", "Tehran", "Tel Aviv", "The Hague", "Thiruvananthapuram", "Tokyo", "Toronto", "Tunis",
  "Vancouver", "Vienna", "Warsaw", "Washington DC", "Zurich",
];
