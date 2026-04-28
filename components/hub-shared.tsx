"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

let browserSupabaseClient: SupabaseClient | null = null;

export function createClient() {
  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  browserSupabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserSupabaseClient;
}

export type Account = {
  id: string;
  account_key: string;
  long_name: string | null;
  retailer: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string | null;
  suppliers: string | null;
  office_phone: string | null;
  created_at?: string | null;
};

export type Contact = {
  id: string;
  account_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  stage: string | null;
  notes: string | null;
  created_at?: string | null;
};

export type Person = Contact;

export type Interaction = {
  id: string;
  user_id?: string | null;
  person_id?: string | null;
  contact_id?: string | null;
  date?: string | null;
  type?: string | null;
  summary?: string | null;
  details?: string | null;
  outcome?: string | null;
  follow_up_date?: string | null;
  created_at?: string | null;
  stage?: string | null;
  account_id?: string | null;
  interaction_type?: string | null;
};

export type NotableQuotable = {
  id: string;
  quote_text: string;
  source_name: string | null;
  source_company: string | null;
  category: string | null;
  sentiment: "negative" | "neutral" | "positive";
  notes: string | null;
  created_at?: string | null;
};

type HubUser = {
  id: string | null;
  email: string | null;
};

type ThemeMode = "light" | "dark";

type HubUserContextValue = {
  user: HubUser | null;
  isLoadingUser: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  theme: ThemeMode;
  toggleTheme: () => void;
};

const HubUserContext = createContext<HubUserContextValue | undefined>(undefined);

const INTERACTION_STAGE_OPTIONS = [
  { label: "Intro/Touch Base", value: "Introduction", color: "bg-red-600" },
  { label: "Technical Training", value: "Technical Training", color: "bg-blue-600" },
  { label: "Field Evaluation", value: "Field Evaluation", color: "bg-yellow-500 text-black" },
  { label: "Adoption", value: "Adoption", color: "bg-green-600" },
] as const;

export function useHubUser(): HubUserContextValue {
  const context = useContext(HubUserContext);

  if (!context) {
    throw new Error("useHubUser must be used inside a HubShell.");
  }

  return context;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeDisplayValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function cleanPhoneForTel(value: string | null | undefined): string {
  const raw = normalizeDisplayValue(value);
  if (!raw) return "";

  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  return cleaned.replace(/\D/g, "");
}

export function formatInteractionType(value: string | null | undefined): string {
  const normalized = normalizeDisplayValue(value);

  if (!normalized) {
    return "General Note";
  }

  const lower = normalized.toLowerCase();

  const explicitMap: Record<string, string> = {
    call: "Call",
    email: "Email",
    visit: "In-Person Visit",
    in_person_visit: "In-Person Visit",
    meeting: "In-Person Meeting",
    in_person_meeting: "In-Person Meeting",
    in_person: "In-Person Meeting",
    virtual_meeting: "Virtual Meeting",
    virtual: "Virtual Meeting",
    trial: "Trial / Evaluation",
    trial_evaluation: "Trial / Evaluation",
    note: "General Note",
    general_note: "General Note",
  };

  if (explicitMap[lower]) {
    return explicitMap[lower];
  }

  return lower
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function generateAccountKey(_input?: {
  retailer?: string | null;
  name?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `acct_${hex}`;
}

export function getAccountDisplayName(
  account: Partial<Account> | null | undefined,
): string {
  if (!account) return "Unnamed Account / Location";

  return (
    account.long_name ||
    [account.retailer, account.name].filter(Boolean).join(" - ") ||
    account.name ||
    account.retailer ||
    [account.city, account.state].filter(Boolean).join(", ") ||
    "Unnamed Account / Location"
  );
}

export function getPersonFullName(
  person: Partial<Contact> | null | undefined,
): string {
  if (!person) return "Unnamed Person";

  const fullName = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || person.email || "Unnamed Person";
}

export function getContactFullName(
  contact: Partial<Contact> | null | undefined,
): string {
  return getPersonFullName(contact);
}

export function formatAddress(
  account: Partial<Account> | null | undefined,
): string {
  if (!account) return "";

  return [account.address, account.city, account.state, account.zip]
    .filter(Boolean)
    .join(", ");
}

export function buildGoogleMapsSearchUrl(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  label?: string | null;
  context?: string | null;
}): string {
  const addressParts = [
    normalizeDisplayValue(input.address),
    normalizeDisplayValue(input.city),
    normalizeDisplayValue(input.state),
    normalizeDisplayValue(input.zip),
  ].filter(Boolean);

  const addressLine = addressParts.join(", ");

  const queryParts = [
    normalizeDisplayValue(input.label),
    normalizeDisplayValue(input.context),
    addressLine,
  ].filter(Boolean);

  const query = queryParts.join(", ");
  if (!query) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function ContactValueLink({
  kind,
  value,
  className = "",
}: {
  kind: "email" | "mobile" | "office";
  value: string | null | undefined;
  className?: string;
}) {
  const display = normalizeDisplayValue(value);

  if (!display) {
    return <span className={className}>Not listed</span>;
  }

  if (kind === "email") {
    return (
      <a
        href={`mailto:${display}`}
        className={`font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-400 ${className}`}
      >
        {display}
      </a>
    );
  }

  const telValue = cleanPhoneForTel(display);

  if (!telValue) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={`tel:${telValue}`}
      className={`font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-400 ${className}`}
    >
      {display}
    </a>
  );
}

export function AddressValueLink({
  value,
  address,
  city,
  state,
  zip,
  label,
  context,
  className = "",
  showPin = false,
}: {
  value?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  label?: string | null;
  context?: string | null;
  className?: string;
  showPin?: boolean;
}) {
  const display =
    normalizeDisplayValue(value) ||
    [address, city, state, zip]
      .map((item) => normalizeDisplayValue(item))
      .filter(Boolean)
      .join(", ");

  if (!display) {
    return <span className={className}>Not listed</span>;
  }

  const href = buildGoogleMapsSearchUrl({
    address: value || address,
    city,
    state,
    zip,
    label,
    context,
  });

  if (!href) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-400 ${className}`}
      title="Open in Google Maps"
    >
      {showPin ? `📍 ${display}` : display}
    </a>
  );
}

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-400"
    >
      {label}
    </Link>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <span
        className={`text-sm font-semibold transition ${
          !isDark
            ? "text-slate-900 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        Light Mode
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
        className={`relative inline-flex h-8 w-16 items-center rounded-full border-2 transition ${
          isDark
            ? "border-blue-500 bg-slate-800"
            : "border-slate-400 bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full shadow-md transition ${
            isDark ? "translate-x-8 bg-blue-400" : "translate-x-1 bg-white"
          }`}
        />
      </button>

      <span
        className={`text-sm font-semibold transition ${
          isDark
            ? "text-slate-900 dark:text-[#ffd84d]"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        Dark Mode
      </span>
    </div>
  );
}

function SignInPanel({
  onSignedIn,
}: {
  onSignedIn: () => Promise<void>;
}) {
  const supabase = createClient();

  const [signInEmail, setSignInEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const validateCertisEmail = (email: string): boolean => {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      setMessage({
        tone: "error",
        text: "Please enter your CERTIS email address.",
      });
      return false;
    }

    if (!normalized.endsWith("@certisbio.com")) {
      setMessage({
        tone: "error",
        text: "Account creation is limited to @certisbio.com email addresses.",
      });
      return false;
    }

    return true;
  };

  const handleSignIn = async () => {
    const email = signInEmail.trim().toLowerCase();

    if (!email || !password.trim()) {
      setMessage({
        tone: "error",
        text: "Please enter both email and password.",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not sign in. ${error.message}`,
      });
      setIsSubmitting(false);
      return;
    }

    setMessage({
      tone: "success",
      text: "Signed in successfully.",
    });

    setPassword("");
    await onSignedIn();
    setIsSubmitting(false);
  };

  const handleCreateAccount = async () => {
    const email = createEmail.trim().toLowerCase();

    if (!validateCertisEmail(email)) return;

    if (!createPassword.trim() || !confirmPassword.trim()) {
      setMessage({
        tone: "error",
        text: "Please enter and confirm your password.",
      });
      return;
    }

    if (createPassword.length < 8) {
      setMessage({
        tone: "error",
        text: "Password must be at least 8 characters.",
      });
      return;
    }

    if (createPassword !== confirmPassword) {
      setMessage({
        tone: "error",
        text: "Passwords do not match.",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const redirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password: createPassword,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not create account. ${error.message}`,
      });
      setIsSubmitting(false);
      return;
    }

    setMessage({
      tone: "success",
      text: "Account created. Check your email to confirm your account before signing in.",
    });

    setCreateEmail("");
    setCreatePassword("");
    setConfirmPassword("");
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-md">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            CERTIS Biologicals · Row Crops
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-[#ffd84d]">
            Sign In to the Demand Creation Hub
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Access people, accounts, and interaction workflows.
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-2 text-sm font-semibold">Sign In</div>

          <div className="grid gap-4">
            <Input
              label="Email"
              value={signInEmail}
              onChange={setSignInEmail}
              type="email"
              placeholder="name@certisbio.com"
            />
            <Input
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="Enter password"
            />
          </div>

          <div className="mt-4">
            <PrimaryButton onClick={handleSignIn} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Sign In"}
            </PrimaryButton>
          </div>
        </div>

        <div className="my-6 border-t border-slate-200 dark:border-slate-700" />

        <div>
          <div className="mb-2 text-sm font-semibold">Create Account</div>

          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            New CERTIS users can create an account with a @certisbio.com email and password.
          </p>

          <div className="grid gap-4">
            <Input
              label="CERTIS Email"
              value={createEmail}
              onChange={setCreateEmail}
              type="email"
              placeholder="name@certisbio.com"
            />
            <Input
              label="Create Password"
              value={createPassword}
              onChange={setCreatePassword}
              type="password"
              placeholder="Minimum 8 characters"
            />
            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              type="password"
              placeholder="Re-enter password"
            />
          </div>

          <div className="mt-4">
            <SecondaryButton onClick={handleCreateAccount} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Create Account"}
            </SecondaryButton>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          Access is limited to CERTIS Biologicals users with @certisbio.com email addresses.
        </div>

        {message ? (
          <div className="mt-5">
            <StatusMessage message={message.text} tone={message.tone} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function HubShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const pathname = usePathname();

  const [user, setUser] = useState<HubUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem(
      "certis-demand-creation-hub-theme",
    ) as ThemeMode | null;

    let nextTheme: ThemeMode;

    if (storedTheme === "light" || storedTheme === "dark") {
      nextTheme = storedTheme;
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      nextTheme = prefersDark ? "dark" : "light";
    }

    setTheme(nextTheme);
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isThemeReady) return;

    const root = document.documentElement;
    const body = document.body;

    window.localStorage.setItem("certis-demand-creation-hub-theme", theme);

    root.setAttribute("data-theme", theme);

    if (theme === "dark") {
      root.classList.add("dark");
      body.style.backgroundColor = "#020617";
      body.style.color = "#f8fafc";
      body.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      body.style.backgroundColor = "#f1f5f9";
      body.style.color = "#0f172a";
      body.style.colorScheme = "light";
    }
  }, [theme, isThemeReady]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoadingUser(true);

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      setUser(null);
      setIsLoadingUser(false);
      return;
    }

    setUser(
      authUser
        ? {
            id: authUser.id,
            email: authUser.email ?? null,
          }
        : null,
    );

    setIsLoadingUser(false);
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  useEffect(() => {
    void refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser, supabase]);

  const contextValue = useMemo<HubUserContextValue>(
    () => ({
      user,
      isLoadingUser,
      refreshUser,
      signOut,
      theme,
      toggleTheme,
    }),
    [user, isLoadingUser, refreshUser, signOut, theme, toggleTheme],
  );

  return (
    <HubUserContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {isLoadingUser ? (
            <div className="mx-auto max-w-md">
              <SectionCard
                title="Loading Hub"
                description="Checking authentication and preparing your workspace."
              >
                <StatusMessage message="Loading..." tone="info" />
              </SectionCard>
            </div>
          ) : !user ? (
            <SignInPanel onSignedIn={refreshUser} />
          ) : (
            <>
              <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-1 items-center gap-5">
                    <div className="flex-shrink-0">
                      <Image
                        src="/certis-logo.png"
                        alt="CERTIS Biologicals logo"
                        width={160}
                        height={60}
                        priority
                        className="h-auto w-[160px]"
                      />
                    </div>

                    <div className="flex min-w-0 flex-col justify-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                        CERTIS Biologicals · Row Crops
                      </p>

                      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-[#ffd84d]">
                        {title}
                      </h1>

                      {subtitle ? (
                        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="font-semibold">Signed-in User</div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">
                        {user?.email || "Not authenticated"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <ThemeToggle theme={theme} onToggle={toggleTheme} />
                      <SecondaryButton onClick={() => void signOut()}>
                        Sign Out
                      </SecondaryButton>
                    </div>
                  </div>
                </div>

                <nav className="mt-5 flex flex-wrap gap-2">
                  {pathname !== "/" ? <NavLink href="/" label="Launch Page" /> : null}
                  <NavLink href="/add-contact" label="Add New Person" />
                  <NavLink href="/add-account" label="Add New Account / Location" />
                  <NavLink href="/search-contacts" label="Search Existing People" />
                  <NavLink href="/account-dashboard" label="Commercial Intelligence Hub" />
                </nav>
              </header>

              {children}
            </>
          )}
        </div>
      </div>
    </HubUserContext.Provider>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-[#ffd84d]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "date" | "password";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-400"
    >
      {children}
    </button>
  );
}

export function StatusMessage({
  message,
  tone,
}: {
  message: string;
  tone: "success" | "error" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200";

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${toneClass}`}>
      {message}
    </div>
  );
}

export function RecordBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

export function InteractionPanel({
  selectedAccount,
  selectedContact,
  selectedPersonId,
  selectedSourceTable,
  onSaved,
}: {
  selectedAccount?: Account | null;
  selectedContact?: Contact | null;
  selectedPersonId?: string | null;
  selectedSourceTable?: "contacts" | "kingpins" | null;
  onSaved?: () => Promise<void> | void;
}) {
  const supabase = createClient();

  const [interactionType, setInteractionType] = useState("call");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [interactionDate, setInteractionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [stages, setStages] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const toggleStage = (stage: string) => {
    setStages((prev) =>
      prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage],
    );
  };

  const handleSave = async () => {
    if (!summary.trim()) {
      setMessage({ tone: "error", text: "Please enter a purpose before saving." });
      return;
    }

    if (stages.length === 0) {
      setMessage({ tone: "error", text: "Please select at least one Stage." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const legacyContactId =
      selectedSourceTable === "contacts" ? selectedContact?.id ?? null : null;

    const { error } = await supabase.from("interactions").insert({
      person_id: selectedPersonId ?? null,
      contact_id: legacyContactId,
      date: interactionDate || null,
      type: interactionType,
      summary: summary.trim(),
      details: details.trim() || null,
      stage: stages,
    });

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not save interaction. ${error.message}`,
      });
      setIsSaving(false);
      return;
    }

    setSummary("");
    setDetails("");
    setInteractionType("call");
    setInteractionDate(new Date().toISOString().slice(0, 10));
    setStages([]);

    setMessage({ tone: "success", text: "Interaction saved successfully." });
    setIsSaving(false);

    if (onSaved) {
      await onSaved();
    }
  };

  return (
    <SectionCard
      title="Log An Interaction"
      description="Capture interaction details and assign stage progression."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Linked Account
          </div>
          <div className="mt-1 font-semibold">
            {selectedAccount ? getAccountDisplayName(selectedAccount) : "None selected"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Linked Person
          </div>
          <div className="mt-1 font-semibold">
            {selectedContact ? getPersonFullName(selectedContact) : "None selected"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Interaction Type"
          value={interactionType}
          onChange={setInteractionType}
          options={[
            { value: "call", label: formatInteractionType("call") },
            { value: "email", label: formatInteractionType("email") },
            { value: "in_person_visit", label: formatInteractionType("in_person_visit") },
            { value: "virtual_meeting", label: formatInteractionType("virtual_meeting") },
            { value: "trial", label: formatInteractionType("trial") },
            { value: "note", label: formatInteractionType("note") },
          ]}
        />

        <Input
          label="Interaction Date"
          value={interactionDate}
          onChange={setInteractionDate}
          type="date"
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Stage of Interaction
        </div>
        <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Select all that apply.
        </div>

        <div className="flex flex-wrap gap-2">
          {INTERACTION_STAGE_OPTIONS.map((stage) => {
            const isSelected = stages.includes(stage.value);

            return (
              <button
                key={stage.value}
                type="button"
                onClick={() => toggleStage(stage.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? `${stage.color} text-white`
                    : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <Input
          label="Purpose"
          value={summary}
          onChange={setSummary}
          placeholder="Example: Discuss trial results, Introduce product, Close sale"
        />

        <TextArea
          label="Details"
          value={details}
          onChange={setDetails}
          rows={5}
          placeholder="Capture key points, reactions, commitments, and next steps."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Interaction"}
        </PrimaryButton>
      </div>

      {message ? (
        <div className="mt-4">
          <StatusMessage message={message.text} tone={message.tone} />
        </div>
      ) : null}
    </SectionCard>
  );
}