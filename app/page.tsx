"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, Bot, Building2, CalendarDays, CarFront, Check, ChevronRight,
  CircleDollarSign, Cloud, CloudOff, CreditCard, GraduationCap, Home, LayoutDashboard,
  KeyRound, Lightbulb, LoaderCircle, LockKeyhole, Menu, MoreHorizontal, Plus, ReceiptText, Settings,
  Droplets, Repeat2, ShieldCheck, Smartphone, Sparkles, TrendingDown,
  WalletCards, Wifi, X, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { createEncryptedEnvelope, encryptWithDataKey, unlockEnvelope, type EncryptedEnvelope } from "@/lib/e2ee";

type View = "overview" | "debts" | "expenses" | "calendar" | "planner";
type Debt = {
  id: number;
  name: string;
  category: string;
  balance: number;
  monthly: number;
  progress: number;
  due: string;
  tone: "mint" | "orange" | "blue" | "purple";
};

type Expense = {
  id: number;
  name: string;
  category: string;
  amount: number;
  due: string;
  icon: "electric" | "water" | "phone" | "internet" | "food" | "subscription";
  autoPay?: boolean;
};

const initialDebts: Debt[] = [
  { id: 1, name: "บ้าน", category: "สินเชื่อที่อยู่อาศัย", balance: 2380000, monthly: 16800, progress: 24, due: "5 ต.ค.", tone: "mint" },
  { id: 2, name: "รถ", category: "สินเชื่อเช่าซื้อ", balance: 428000, monthly: 9250, progress: 46, due: "12 ต.ค.", tone: "orange" },
  { id: 3, name: "บัตร K", category: "บัตรเครดิต", balance: 48500, monthly: 4850, progress: 18, due: "18 ต.ค.", tone: "blue" },
  { id: 4, name: "กยศ.", category: "เงินกู้เพื่อการศึกษา", balance: 164000, monthly: 1380, progress: 39, due: "สำรองทุกเดือน", tone: "purple" },
];

const initialExpenses: Expense[] = [
  { id: 1, name: "ค่าไฟ", category: "สาธารณูปโภค", amount: 1850, due: "10 ต.ค.", icon: "electric" },
  { id: 2, name: "ค่าน้ำ", category: "สาธารณูปโภค", amount: 320, due: "12 ต.ค.", icon: "water" },
  { id: 3, name: "ค่าโทรศัพท์", category: "การสื่อสาร", amount: 699, due: "15 ต.ค.", icon: "phone", autoPay: true },
  { id: 4, name: "อินเทอร์เน็ตบ้าน", category: "การสื่อสาร", amount: 599, due: "20 ต.ค.", icon: "internet", autoPay: true },
  { id: 5, name: "ค่าอาหารและของใช้", category: "ชีวิตประจำวัน", amount: 9000, due: "งบทั้งเดือน", icon: "food" },
  { id: 6, name: "บริการรายเดือน", category: "สมาชิกและแอป", amount: 499, due: "25 ต.ค.", icon: "subscription", autoPay: true },
];

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const DEBTS_STORAGE_KEY = "tanglak-debts-v1";
const EXPENSES_STORAGE_KEY = "tanglak-expenses-v1";
const UPDATED_AT_STORAGE_KEY = "tanglak-updated-at-v1";
const ENCRYPTED_STORAGE_KEY = "tanglak-e2ee-v1";
type SyncStatus = "loading" | "syncing" | "synced" | "offline" | "error";
type CryptoMode = "loading" | "setup" | "locked" | "ready" | "error";

const expenseIconFromCategory = (category: string, name: string): Expense["icon"] => {
  if (name.includes("น้ำ")) return "water";
  if (name.includes("ไฟ")) return "electric";
  if (name.includes("อินเทอร์เน็ต") || name.includes("เน็ต")) return "internet";
  if (category === "การสื่อสาร") return "phone";
  if (category === "อาหารและของใช้") return "food";
  if (category === "สมาชิกและแอป") return "subscription";
  return "subscription";
};

const debtToneFromCategory = (category: string): Debt["tone"] => {
  if (category.includes("ที่อยู่อาศัย")) return "mint";
  if (category.includes("เช่าซื้อ")) return "orange";
  if (category.includes("ศึกษา")) return "purple";
  return "blue";
};

const requireEmptyInput = (input: unknown) => {
  if (input == null) return;
  if (typeof input !== "object" || Array.isArray(input) || Object.keys(input as Record<string, unknown>).length > 0) {
    throw new Error("เครื่องมือนี้ไม่รับข้อมูลเพิ่มเติม");
  }
};

const iconFor = (name: string, className = "size-5") => {
  if (name === "บ้าน") return <Building2 className={className} />;
  if (name === "รถ") return <CarFront className={className} />;
  if (name.includes("บัตร")) return <CreditCard className={className} />;
  return <GraduationCap className={className} />;
};

const expenseIcon = (icon: Expense["icon"]) => {
  if (icon === "electric") return <Zap className="size-5" />;
  if (icon === "water") return <Droplets className="size-5" />;
  if (icon === "phone") return <Smartphone className="size-5" />;
  if (icon === "internet") return <Wifi className="size-5" />;
  if (icon === "subscription") return <Repeat2 className="size-5" />;
  return <ReceiptText className="size-5" />;
};

const toneClasses = {
  mint: "bg-[#d7ff71] text-[#11241b]",
  orange: "bg-[#ffddae] text-[#4b2a05]",
  blue: "bg-[#cbe6ff] text-[#092f52]",
  purple: "bg-[#e4d8ff] text-[#35205d]",
};

export default function HomePage() {
  const [view, setView] = useState<View>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [debts, setDebts] = useState(initialDebts);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [cryptoMode, setCryptoMode] = useState<CryptoMode>("loading");
  const [encryptedEnvelope, setEncryptedEnvelope] = useState<EncryptedEnvelope | null>(null);
  const [envelopeNeedsSync, setEnvelopeNeedsSync] = useState(false);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [todayLabel, setTodayLabel] = useState("วันนี้");
  const [greeting, setGreeting] = useState("สวัสดี");
  const [notice, setNotice] = useState("");

  const monthlyTotal = useMemo(() => debts.reduce((sum, item) => sum + item.monthly, 0), [debts]);
  const totalBalance = useMemo(() => debts.reduce((sum, item) => sum + item.balance, 0), [debts]);
  const monthlyExpenseTotal = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

  useEffect(() => {
    let active = true;
    let localDebts = initialDebts;
    let localExpenses = initialExpenses;
    let localEnvelope: EncryptedEnvelope | null = null;

    try {
      const savedDebts = localStorage.getItem(DEBTS_STORAGE_KEY);
      const savedExpenses = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const savedEnvelope = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
      if (savedDebts) {
        const parsed = JSON.parse(savedDebts);
        if (Array.isArray(parsed)) localDebts = parsed;
      }
      if (savedExpenses) {
        const parsed = JSON.parse(savedExpenses);
        if (Array.isArray(parsed)) localExpenses = parsed;
      }
      if (savedEnvelope) localEnvelope = JSON.parse(savedEnvelope) as EncryptedEnvelope;
    } catch {
      setNotice("ไม่สามารถอ่านสำเนาข้อมูลในเครื่องได้");
    }

    const now = new Date();
    setTodayLabel(new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));
    const hour = now.getHours();
    setGreeting(hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น");

    const loadCloud = async () => {
      try {
        setSyncStatus("loading");
        let remoteEnvelope: EncryptedEnvelope | null = null;
        let legacyState: { debts: Debt[]; expenses: Expense[]; updatedAt: string } | null = null;

        if (navigator.onLine) {
          const response = await fetch("/api/finance-state", { cache: "no-store" });
          if (!response.ok) throw new Error("cloud unavailable");
          const payload = await response.json() as { encrypted: EncryptedEnvelope | null; state: typeof legacyState };
          remoteEnvelope = payload.encrypted ?? null;
          legacyState = payload.state ?? null;
        }

        if (!active) return;
        const localTime = localEnvelope ? Date.parse(localEnvelope.updatedAt) || 0 : 0;
        const remoteTime = remoteEnvelope ? Date.parse(remoteEnvelope.updatedAt) || 0 : 0;
        const chosenEnvelope = remoteTime >= localTime ? remoteEnvelope ?? localEnvelope : localEnvelope;

        if (chosenEnvelope) {
          setEncryptedEnvelope(chosenEnvelope);
          setEnvelopeNeedsSync(!(remoteEnvelope && chosenEnvelope === remoteEnvelope));
          localStorage.setItem(ENCRYPTED_STORAGE_KEY, JSON.stringify(chosenEnvelope));
          localStorage.removeItem(DEBTS_STORAGE_KEY);
          localStorage.removeItem(EXPENSES_STORAGE_KEY);
          localStorage.removeItem(UPDATED_AT_STORAGE_KEY);
          setDebts([]);
          setExpenses([]);
          setCryptoMode("locked");
          setSyncStatus(navigator.onLine ? "synced" : "offline");
          return;
        }

        if (legacyState) {
          setDebts(legacyState.debts);
          setExpenses(legacyState.expenses);
        } else {
          setDebts(localDebts);
          setExpenses(localExpenses);
        }
        setCryptoMode("setup");
        setSyncStatus(navigator.onLine ? "error" : "offline");
      } catch {
        if (!active) return;
        if (localEnvelope) {
          setEncryptedEnvelope(localEnvelope);
          setDebts([]);
          setExpenses([]);
          setCryptoMode("locked");
        } else {
          setDebts(localDebts);
          setExpenses(localExpenses);
          setCryptoMode("setup");
        }
        setSyncStatus(navigator.onLine ? "error" : "offline");
      }
    };
    void loadCloud();

    const handleOnline = () => {
      setSyncStatus("syncing");
      setLocalUpdatedAt(Date.now());
    };
    const handleOffline = () => setSyncStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (cryptoMode !== "ready" || !dataKey || !encryptedEnvelope || localUpdatedAt <= lastSyncedAt) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus("syncing");
        const nextEnvelope = await encryptWithDataKey({ debts, expenses }, dataKey, encryptedEnvelope);
        localStorage.setItem(ENCRYPTED_STORAGE_KEY, JSON.stringify(nextEnvelope));
        if (!navigator.onLine) {
          setEncryptedEnvelope(nextEnvelope);
          setEnvelopeNeedsSync(true);
          setLastSyncedAt(Date.parse(nextEnvelope.updatedAt));
          setSyncStatus("offline");
          return;
        }
        const response = await fetch("/api/finance-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encrypted: nextEnvelope }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("sync failed");
        setEncryptedEnvelope(nextEnvelope);
        setEnvelopeNeedsSync(false);
        setLastSyncedAt(Date.parse(nextEnvelope.updatedAt));
        setSyncStatus("synced");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSyncStatus(navigator.onLine ? "error" : "offline");
      }
    }, 700);

    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [cryptoMode, dataKey, debts, encryptedEnvelope, expenses, lastSyncedAt, localUpdatedAt]);

  const enableEncryption = async (passphrase: string) => {
    const { envelope, dataKey: nextKey } = await createEncryptedEnvelope({ debts, expenses }, passphrase);
    localStorage.setItem(ENCRYPTED_STORAGE_KEY, JSON.stringify(envelope));
    localStorage.removeItem(DEBTS_STORAGE_KEY);
    localStorage.removeItem(EXPENSES_STORAGE_KEY);
    localStorage.removeItem(UPDATED_AT_STORAGE_KEY);
    setEncryptedEnvelope(envelope);
    setEnvelopeNeedsSync(true);
    setDataKey(nextKey);
    setLocalUpdatedAt(Date.parse(envelope.updatedAt));
    setLastSyncedAt(0);
    setCryptoMode("ready");
    setSyncStatus(navigator.onLine ? "syncing" : "offline");
  };

  const unlockEncryption = async (passphrase: string) => {
    if (!encryptedEnvelope) throw new Error("ไม่พบข้อมูลเข้ารหัส");
    const unlocked = await unlockEnvelope<{ debts: Debt[]; expenses: Expense[] }>(encryptedEnvelope, passphrase);
    if (!Array.isArray(unlocked.data.debts) || !Array.isArray(unlocked.data.expenses)) throw new Error("ข้อมูลไม่ถูกต้อง");
    setDebts(unlocked.data.debts);
    setExpenses(unlocked.data.expenses);
    setDataKey(unlocked.dataKey);
    const timestamp = Date.parse(encryptedEnvelope.updatedAt) || Date.now();
    setLocalUpdatedAt(timestamp);
    setLastSyncedAt(envelopeNeedsSync ? 0 : timestamp);
    setCryptoMode("ready");
    setSyncStatus(navigator.onLine ? "synced" : "offline");
  };

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();

    const register = async () => {
      await modelContext.registerTool({
        name: "read_debt_dashboard",
        title: "อ่านภาพรวมหนี้",
        description: "อ่านยอดหนี้คงเหลือและภาระชำระประจำเดือนที่แสดงอยู่ในแอป",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: (input: unknown) => {
          requireEmptyInput(input);
          return { totalBalance, monthlyTotal, monthlyExpenseTotal, debtCount: debts.length, expenseCount: expenses.length, nextDue: "บ้าน วันที่ 5 ต.ค." };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool({
        name: "open_add_expense_form",
        title: "เปิดแบบฟอร์มเพิ่มรายจ่าย",
        description: "เปิดแบบฟอร์มเพิ่มรายจ่ายประจำรายเดือนบนหน้าจอ",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          requireEmptyInput(input);
          setView("expenses");
          setAddExpenseOpen(true);
          return { status: "opened" };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool({
        name: "open_add_debt_form",
        title: "เปิดแบบฟอร์มเพิ่มหนี้",
        description: "เปิดแบบฟอร์มเพิ่มรายการหนี้ใหม่บนหน้าจอ",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          requireEmptyInput(input);
          setAddOpen(true);
          return { status: "opened" };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [debts.length, expenses.length, monthlyExpenseTotal, monthlyTotal, totalBalance]);

  const markChanged = () => setLocalUpdatedAt(Date.now());

  const saveDebt = (debt: Debt) => {
    setDebts((current) => current.some((item) => item.id === debt.id)
      ? current.map((item) => item.id === debt.id ? debt : item)
      : [...current, debt]);
    markChanged();
    setAddOpen(false);
    setEditingDebt(null);
    setNotice(editingDebt ? "บันทึกการแก้ไขหนี้แล้ว" : "เพิ่มรายการหนี้เรียบร้อยแล้ว");
    setTimeout(() => setNotice(""), 2800);
  };

  const saveExpense = (expense: Expense) => {
    setExpenses((current) => current.some((item) => item.id === expense.id)
      ? current.map((item) => item.id === expense.id ? expense : item)
      : [...current, expense]);
    markChanged();
    setAddExpenseOpen(false);
    setEditingExpense(null);
    setNotice(editingExpense ? "บันทึกการแก้ไขรายจ่ายแล้ว" : "เพิ่มรายจ่ายประจำเรียบร้อยแล้ว");
    setTimeout(() => setNotice(""), 2800);
  };

  const deleteDebt = (id: number) => {
    if (!window.confirm("ลบรายการหนี้นี้ใช่ไหม?")) return;
    setDebts((current) => current.filter((item) => item.id !== id));
    markChanged();
    setAddOpen(false);
    setEditingDebt(null);
    setNotice("ลบรายการหนี้แล้ว");
  };

  const deleteExpense = (id: number) => {
    if (!window.confirm("ลบรายจ่ายประจำนี้ใช่ไหม?")) return;
    setExpenses((current) => current.filter((item) => item.id !== id));
    markChanged();
    setAddExpenseOpen(false);
    setEditingExpense(null);
    setNotice("ลบรายจ่ายแล้ว");
  };

  return (
    <main className="min-h-screen bg-[#f4f7f3] text-[#14231c]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-[#dfe7e1] bg-[#f9fbf8] px-4 py-6 lg:flex">
        <Brand />
        <nav className="mt-10 space-y-1" aria-label="เมนูหลัก">
          <NavItem active={view === "overview"} icon={<LayoutDashboard />} label="ภาพรวม" onClick={() => setView("overview")} />
          <NavItem active={view === "debts"} icon={<WalletCards />} label="หนี้ของฉัน" badge={String(debts.length)} onClick={() => setView("debts")} />
          <NavItem active={view === "expenses"} icon={<ReceiptText />} label="รายจ่ายประจำ" badge={String(expenses.length)} onClick={() => setView("expenses")} />
          <NavItem active={view === "calendar"} icon={<CalendarDays />} label="ปฏิทินชำระ" onClick={() => setView("calendar")} />
          <NavItem active={view === "planner"} icon={<Sparkles />} label="AI วางแผน" onClick={() => setView("planner")} />
        </nav>
        <div className="mt-auto">
          <div className="mb-4 rounded-2xl bg-[#152d23] p-4 text-white">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-[#d7ff71] text-[#152d23]"><ShieldCheck className="size-5" /></div>
            <p className="text-sm font-semibold">เข้ารหัสแบบ End-to-End</p>
            <p className="mt-1 text-xs leading-5 text-white/60">ข้อมูลถูกเข้ารหัสบนอุปกรณ์ก่อนส่ง Cloud เซิร์ฟเวอร์อ่านยอดเงินไม่ได้</p>
          </div>
          <NavItem icon={<Settings />} label="ตั้งค่า" onClick={() => setNotice("หน้าตั้งค่าจะมาในเวอร์ชันถัดไป")} />
          <div className="mt-5 flex items-center gap-3 border-t border-[#dfe7e1] pt-5">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#d7ff71] font-bold">ก</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">กิตติพงษ์</p><p className="text-xs text-[#6c7c74]">บัญชีส่วนตัว</p></div>
            <MoreHorizontal className="ml-auto size-5 text-[#6c7c74]" />
          </div>
        </div>
      </aside>

      <section className="pb-24 lg:ml-[236px] lg:pb-0">
        <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-[#dfe7e1]/80 bg-[#f4f7f3]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
          <button className="mr-3 rounded-xl p-2 lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="เปิดเมนู"><Menu className="size-5" /></button>
          <div><p className="text-xs font-medium text-[#718078]">{todayLabel}</p><h1 className="text-lg font-bold tracking-[-0.02em]">{greeting}, กิตติพงษ์</h1></div>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge status={syncStatus} />
            <button className="relative flex size-10 items-center justify-center rounded-full border border-[#dfe7e1] bg-white" aria-label="การแจ้งเตือน"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff7657] ring-2 ring-white" /></button>
            <Button onClick={() => {
              if (view === "expenses") { setEditingExpense(null); setAddExpenseOpen(true); }
              else { setEditingDebt(null); setAddOpen(true); }
            }} className="h-10 rounded-full bg-[#152d23] px-4 text-white hover:bg-[#244538]"><Plus /> <span className="hidden sm:inline">{view === "expenses" ? "เพิ่มรายจ่าย" : "เพิ่มรายการหนี้"}</span></Button>
          </div>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-40 bg-[#10251c]/40 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="h-full w-[280px] bg-[#f9fbf8] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between"><Brand /><button onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X /></button></div>
              <nav className="mt-10 space-y-2">
                <NavItem active={view === "overview"} icon={<LayoutDashboard />} label="ภาพรวม" onClick={() => { setView("overview"); setMenuOpen(false); }} />
                <NavItem active={view === "debts"} icon={<WalletCards />} label="หนี้ของฉัน" onClick={() => { setView("debts"); setMenuOpen(false); }} />
                <NavItem active={view === "expenses"} icon={<ReceiptText />} label="รายจ่ายประจำ" onClick={() => { setView("expenses"); setMenuOpen(false); }} />
                <NavItem active={view === "calendar"} icon={<CalendarDays />} label="ปฏิทินชำระ" onClick={() => { setView("calendar"); setMenuOpen(false); }} />
                <NavItem active={view === "planner"} icon={<Sparkles />} label="AI วางแผน" onClick={() => { setView("planner"); setMenuOpen(false); }} />
              </nav>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-[1440px] p-4 sm:p-7 lg:p-10">
          {view === "overview" && <Overview debts={debts} expenses={expenses} monthlyTotal={monthlyTotal} monthlyExpenseTotal={monthlyExpenseTotal} totalBalance={totalBalance} onViewAll={() => setView("debts")} onViewExpenses={() => setView("expenses")} onPlanner={() => setView("planner")} />}
          {view === "debts" && <DebtsView debts={debts} totalBalance={totalBalance} monthlyTotal={monthlyTotal} onAdd={() => { setEditingDebt(null); setAddOpen(true); }} onEdit={(debt) => { setEditingDebt(debt); setAddOpen(true); }} />}
          {view === "expenses" && <ExpensesView expenses={expenses} monthlyExpenseTotal={monthlyExpenseTotal} monthlyDebtTotal={monthlyTotal} onAdd={() => { setEditingExpense(null); setAddExpenseOpen(true); }} onEdit={(expense) => { setEditingExpense(expense); setAddExpenseOpen(true); }} />}
          {view === "calendar" && <CalendarView debts={debts} />}
          {view === "planner" && <PlannerView onBack={() => setView("overview")} />}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#dfe7e1] bg-white/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="เมนูมือถือ">
        <MobileNav active={view === "overview"} icon={<Home />} label="ภาพรวม" onClick={() => setView("overview")} />
        <MobileNav active={view === "debts"} icon={<WalletCards />} label="หนี้" onClick={() => setView("debts")} />
        <MobileNav active={view === "expenses"} icon={<ReceiptText />} label="รายจ่าย" onClick={() => setView("expenses")} />
        <MobileNav active={view === "calendar"} icon={<CalendarDays />} label="ปฏิทิน" onClick={() => setView("calendar")} />
        <MobileNav active={view === "planner"} icon={<Sparkles />} label="AI วางแผน" onClick={() => setView("planner")} />
      </nav>

      <AddDebtDialog open={addOpen} item={editingDebt} onOpenChange={(open) => { setAddOpen(open); if (!open) setEditingDebt(null); }} onSave={saveDebt} onDelete={deleteDebt} />
      <AddExpenseDialog open={addExpenseOpen} item={editingExpense} onOpenChange={(open) => { setAddExpenseOpen(open); if (!open) setEditingExpense(null); }} onSave={saveExpense} onDelete={deleteExpense} />
      <EncryptionGate mode={cryptoMode} onSetup={enableEncryption} onUnlock={unlockEncryption} />
      {notice && <div role="status" className="fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#152d23] px-5 py-3 text-sm font-medium text-white shadow-xl lg:bottom-8"><Check className="size-4 text-[#d7ff71]" />{notice}</div>}
    </main>
  );
}

function Brand() {
  return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-[14px] bg-[#152d23] text-[#d7ff71]"><TrendingDown className="size-5" /></div><div><p className="text-xl font-black tracking-[-0.04em]">ตั้งหลัก</p><p className="text-[11px] font-medium text-[#718078]">DEBT PLANNER</p></div></div>;
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const config = {
    loading: { label: "กำลังโหลด", icon: <LoaderCircle className="size-3.5 animate-spin" /> },
    syncing: { label: "กำลังซิงก์", icon: <LoaderCircle className="size-3.5 animate-spin" /> },
    synced: { label: "ซิงก์แล้ว", icon: <Cloud className="size-3.5" /> },
    offline: { label: "ออฟไลน์", icon: <CloudOff className="size-3.5" /> },
    error: { label: "เก็บในเครื่อง", icon: <CloudOff className="size-3.5" /> },
  }[status];
  return <span title={config.label} className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold ${status === "synced" ? "border-[#cfe2d0] bg-[#eaf5e8] text-[#376146]" : "border-[#dfe7e1] bg-white text-[#6a7b72]"}`}>{config.icon}<span className="hidden sm:inline">{config.label}</span></span>;
}

function EncryptionGate({ mode, onSetup, onUnlock }: { mode: CryptoMode; onSetup: (passphrase: string) => Promise<void>; onUnlock: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassphrase("");
    setConfirmation("");
    setError("");
    setBusy(false);
  }, [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (passphrase.length < 12) { setError("รหัสปลดล็อกต้องมีอย่างน้อย 12 ตัวอักษร"); return; }
    if (mode === "setup" && passphrase !== confirmation) { setError("รหัสยืนยันไม่ตรงกัน"); return; }
    try {
      setBusy(true);
      if (mode === "setup") await onSetup(passphrase);
      else await onUnlock(passphrase);
    } catch {
      setError(mode === "locked" ? "รหัสไม่ถูกต้อง หรือข้อมูลเข้ารหัสเสียหาย" : "ไม่สามารถเปิดการเข้ารหัสได้");
      setBusy(false);
    }
  };

  return <Dialog open={mode !== "ready"} onOpenChange={() => undefined}><DialogContent showCloseButton={false} className="overflow-hidden rounded-[28px] border-0 p-0 sm:max-w-[520px]">
    {mode === "loading" ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><LoaderCircle className="mx-auto size-8 animate-spin text-[#41604d]" /><p className="mt-4 font-bold">กำลังตรวจสอบข้อมูลที่เข้ารหัส…</p></div></div> :
      <form onSubmit={submit}>
        <div className="bg-[#152d23] p-6 text-white sm:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-[#d7ff71] text-[#152d23]">{mode === "setup" ? <KeyRound className="size-6" /> : <LockKeyhole className="size-6" />}</div><DialogHeader className="mt-5 text-left"><DialogTitle className="text-2xl font-black tracking-[-0.03em]">{mode === "setup" ? "ปกป้องข้อมูลด้วย E2EE" : "ปลดล็อกข้อมูลของคุณ"}</DialogTitle><DialogDescription className="leading-6 text-white/65">{mode === "setup" ? "ตั้งรหัสสำหรับเข้ารหัสหนี้และรายจ่ายก่อนส่งขึ้น Cloud รหัสนี้จะไม่ถูกส่งไปยังเซิร์ฟเวอร์" : "ใส่รหัส E2EE เพื่อถอดรหัสข้อมูลบนอุปกรณ์นี้"}</DialogDescription></DialogHeader></div>
        <div className="space-y-4 p-6 sm:p-8"><Field label={mode === "setup" ? "สร้างรหัสปลดล็อก" : "รหัสปลดล็อก"}><input className="field-input" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="อย่างน้อย 12 ตัวอักษร" autoFocus required /></Field>{mode === "setup" && <Field label="ยืนยันรหัสปลดล็อก"><input className="field-input" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="พิมพ์รหัสอีกครั้ง" required /></Field>}{error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}<div className="rounded-2xl bg-[#f1f5f0] p-4 text-xs leading-5 text-[#5d6e64]"><ShieldCheck className="mb-2 size-5 text-[#3d6d4d]" />{mode === "setup" ? "โปรดเก็บรหัสนี้ไว้ในที่ปลอดภัย หากลืมรหัส เราไม่สามารถดูหรือกู้ข้อมูลให้ได้" : "การถอดรหัสเกิดขึ้นบนอุปกรณ์นี้เท่านั้น กุญแจจะอยู่ในหน่วยความจำจนกว่าจะปิดหรือรีเฟรชหน้า"}</div><Button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-[#152d23] text-white hover:bg-[#244538]">{busy && <LoaderCircle className="animate-spin" />}{mode === "setup" ? "เปิดใช้การเข้ารหัส" : "ปลดล็อกข้อมูล"}</Button></div>
      </form>}
  </DialogContent></Dialog>;
}

function NavItem({ active, icon, label, badge, onClick }: { active?: boolean; icon: React.ReactNode; label: string; badge?: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active ? "bg-[#e5f2e4] text-[#152d23]" : "text-[#607069] hover:bg-[#eef3ee]"}`}><span className="[&>svg]:size-[19px]">{icon}</span>{label}{badge && <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs">{badge}</span>}</button>;
}

function MobileNav({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold ${active ? "text-[#153c2c]" : "text-[#829087]"}`}><span className={`grid size-8 place-items-center rounded-full [&>svg]:size-[18px] ${active ? "bg-[#d7ff71]" : ""}`}>{icon}</span>{label}</button>;
}

function Overview({ debts, expenses, monthlyTotal, monthlyExpenseTotal, totalBalance, onViewAll, onViewExpenses, onPlanner }: { debts: Debt[]; expenses: Expense[]; monthlyTotal: number; monthlyExpenseTotal: number; totalBalance: number; onViewAll: () => void; onViewExpenses: () => void; onPlanner: () => void }) {
  const income = 68000;
  const essentials = monthlyExpenseTotal;
  const remaining = income - essentials - monthlyTotal;
  return <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
      <section className="relative overflow-hidden rounded-[28px] bg-[#152d23] p-6 text-white shadow-[0_24px_60px_rgba(20,45,35,.16)] sm:p-8">
        <div className="absolute -right-20 -top-24 size-64 rounded-full border-[46px] border-white/[.04]" />
        <div className="relative flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-white/60">ภาระที่ต้องจ่ายในเดือนนี้</p><p className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">฿{money.format(monthlyTotal)}</p><div className="mt-4 flex items-center gap-2 text-sm text-white/65"><span className="rounded-full bg-[#d7ff71]/15 px-2.5 py-1 font-semibold text-[#d7ff71]">จ่ายแล้ว 61%</span><span>เหลืออีก 2 รายการ</span></div></div><div className="relative grid size-[94px] shrink-0 place-items-center rounded-full bg-[conic-gradient(#d7ff71_0_61%,rgba(255,255,255,.1)_61%_100%)]"><div className="grid size-[72px] place-items-center rounded-full bg-[#152d23] text-center"><span className="text-xl font-black">61%</span><span className="-mt-4 text-[10px] text-white/50">สำเร็จแล้ว</span></div></div></div>
        <div className="relative mt-8"><div className="mb-2 flex justify-between text-xs text-white/55"><span>ต.ค. 2569</span><span>เป้าหมาย ฿{money.format(monthlyTotal)}</span></div><Progress value={61} className="h-2.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#d7ff71]" /></div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5"><div><p className="text-xs text-white/50">ครบกำหนดถัดไป</p><p className="mt-1.5 flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-[#d7ff71]" /> บ้าน · 5 ต.ค.</p></div><div><p className="text-xs text-white/50">ยอดถัดไป</p><p className="mt-1 text-lg font-bold">฿16,800</p></div></div>
      </section>

      <section className="rounded-[28px] border border-[#dfe7e1] bg-white p-6 sm:p-7">
        <div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-[#607069]">เงินของเดือนนี้</p><p className="mt-2 text-3xl font-black tracking-[-0.04em]">฿{money.format(remaining)}</p><p className="mt-1 text-xs text-[#819087]">คงเหลือหลังหักภาระทั้งหมด</p></div><span className="rounded-full bg-[#e8f9e8] px-3 py-1.5 text-xs font-bold text-[#337547]">คล่องตัวดี</span></div>
        <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-[#edf1ed]"><span className="w-[48%] bg-[#173a2b]" /><span className="w-[29%] bg-[#9ec979]" /><span className="w-[23%] bg-[#d7ff71]" /></div>
        <div className="mt-6 space-y-4"><MoneyLine color="bg-[#173a2b]" label="ชำระหนี้" amount={monthlyTotal} /><MoneyLine color="bg-[#9ec979]" label="รายจ่ายประจำ" amount={essentials} /><MoneyLine color="bg-[#d7ff71]" label="เหลือใช้และออม" amount={remaining} strong /></div>
      </section>
    </div>

    <section className="rounded-[28px] border border-[#dfe7e1] bg-white p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">รายจ่ายประจำเดือนนี้</h2><p className="mt-1 text-xs text-[#7a8981]">รวม ฿{money.format(monthlyExpenseTotal)} · {expenses.length} รายการ</p></div><button onClick={onViewExpenses} className="text-sm font-bold text-[#365b49]">จัดการรายจ่าย</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{expenses.slice(0, 4).map((expense) => <div key={expense.id} className="flex items-center gap-3 rounded-2xl bg-[#f3f7f2] p-3.5"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#456852]">{expenseIcon(expense.icon)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{expense.name}</p><p className="text-xs text-[#7b8981]">{expense.due}</p></div><p className="ml-auto text-sm font-black">฿{money.format(expense.amount)}</p></div>)}</div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.95fr]">
      <section className="rounded-[28px] border border-[#dfe7e1] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">หนี้ของฉัน</h2><p className="mt-1 text-xs text-[#7a8981]">ยอดคงเหลือทั้งหมด ฿{money.format(totalBalance)}</p></div><button onClick={onViewAll} className="text-sm font-bold text-[#365b49]">ดูทั้งหมด</button></div>
        <div className="divide-y divide-[#e7ece8]">{debts.slice(0, 4).map((debt) => <DebtRow key={debt.id} debt={debt} />)}</div>
      </section>
      <section className="overflow-hidden rounded-[28px] bg-[#e6efdf] p-6 sm:p-7">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><span className="grid size-9 place-items-center rounded-xl bg-white"><Bot className="size-5" /></span> AI แนะนำวันนี้</span><Sparkles className="size-5 text-[#52725d]" /></div>
        <h2 className="mt-7 max-w-[330px] text-2xl font-black leading-snug tracking-[-0.04em]">ถ้าโปะบัตรเครดิตเพิ่ม ฿2,000 คุณจะประหยัดดอกเบี้ยได้</h2>
        <p className="mt-3 text-sm leading-6 text-[#56675d]">จากกระแสเงินสดเดือนนี้ คุณยังเหลือเงินสำรองหลังโปะประมาณ ฿9,020</p>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-[#718078]">หมดเร็วขึ้น</p><p className="mt-1 text-xl font-black">8 เดือน</p></div><div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-[#718078]">ดอกเบี้ยลดลง</p><p className="mt-1 text-xl font-black">฿6,480</p></div></div>
        <Button onClick={onPlanner} className="mt-5 h-11 w-full rounded-full bg-[#152d23] text-white hover:bg-[#244538]">ลองปรับแผน <ChevronRight /></Button>
      </section>
    </div>

    <section className="rounded-[28px] border border-[#dfe7e1] bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">แนวโน้มหนี้คงเหลือ</h2><p className="mt-1 text-xs text-[#7a8981]">ประมาณการจากแผนชำระปัจจุบัน</p></div><span className="rounded-full bg-[#f0f4ef] px-3 py-1.5 text-xs font-semibold">12 เดือน</span></div>
      <div className="mt-7 flex h-36 items-end gap-2 sm:gap-4">{[94,91,86,82,77,72,68,63,58,53,48,43].map((height, index) => <div key={index} className="group flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-[#b5d7a2] transition group-hover:bg-[#79ad65]" style={{ height: `${height}%` }} /></div>)}</div>
      <div className="mt-3 flex justify-between text-[11px] text-[#839087]"><span>ต.ค.</span><span>ม.ค.</span><span>เม.ย.</span><span>ก.ค.</span><span>ก.ย.</span></div>
    </section>
  </div>;
}

function MoneyLine({ color, label, amount, strong }: { color: string; label: string; amount: number; strong?: boolean }) {
  return <div className={`flex items-center text-sm ${strong ? "font-bold" : ""}`}><span className={`mr-3 size-2.5 rounded-full ${color}`} /><span className="text-[#607069]">{label}</span><span className="ml-auto">฿{money.format(amount)}</span></div>;
}

function DebtRow({ debt }: { debt: Debt }) {
  return <div className="flex items-center gap-3 py-4 first:pt-1 last:pb-0"><div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${toneClasses[debt.tone]}`}>{iconFor(debt.name)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-bold">{debt.name}</p><p className="text-sm font-black">฿{money.format(debt.monthly)}</p></div><div className="mt-1.5 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8ede9]"><div className="h-full rounded-full bg-[#739f72]" style={{ width: `${debt.progress}%` }} /></div><span className="whitespace-nowrap text-[11px] text-[#839087]">{debt.due}</span></div></div><ChevronRight className="size-4 shrink-0 text-[#a3aea8]" /></div>;
}

function DebtsView({ debts, totalBalance, monthlyTotal, onAdd, onEdit }: { debts: Debt[]; totalBalance: number; monthlyTotal: number; onAdd: () => void; onEdit: (debt: Debt) => void }) {
  return <div><div className="mb-7 flex items-end justify-between"><div><p className="text-sm font-semibold text-[#75847c]">พอร์ตหนี้ส่วนตัว</p><h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">หนี้ของฉัน</h2></div><Button onClick={onAdd} className="rounded-full bg-[#152d23]"><Plus /> เพิ่มหนี้</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><SummaryCard label="ยอดหนี้คงเหลือ" value={`฿${money.format(totalBalance)}`} icon={<CircleDollarSign />} /><SummaryCard label="จ่ายต่อเดือน" value={`฿${money.format(monthlyTotal)}`} icon={<ReceiptText />} /><SummaryCard label="หนี้ทั้งหมด" value={`${debts.length} รายการ`} icon={<WalletCards />} /></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{debts.map((debt) => <article key={debt.id} className="rounded-[24px] border border-[#dfe7e1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between"><div className={`grid size-12 place-items-center rounded-2xl ${toneClasses[debt.tone]}`}>{iconFor(debt.name)}</div><button onClick={() => onEdit(debt)} aria-label={`แก้ไข ${debt.name}`} className="rounded-full p-2 hover:bg-[#f0f4ef]"><MoreHorizontal /></button></div><p className="mt-5 text-xs text-[#7b8981]">{debt.category}</p><h3 className="mt-1 text-xl font-black">{debt.name}</h3><p className="mt-5 text-xs text-[#7b8981]">ยอดคงเหลือ</p><p className="mt-1 text-2xl font-black tracking-[-0.03em]">฿{money.format(debt.balance)}</p><div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span>ชำระแล้ว {debt.progress}%</span><span>{debt.due}</span></div><Progress value={debt.progress} className="h-2 bg-[#e9eeea] [&_[data-slot=progress-indicator]]:bg-[#6f9d70]" /></div><div className="mt-5 flex items-center justify-between border-t border-[#e8ede9] pt-4"><span className="text-xs text-[#7b8981]">ต่อเดือน</span><span className="font-black">฿{money.format(debt.monthly)}</span></div></article>)}</div>
  </div>;
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-[22px] border border-[#dfe7e1] bg-white p-5"><div className="flex items-center justify-between text-[#6f8077]"><span className="text-xs font-semibold">{label}</span><span className="[&>svg]:size-5">{icon}</span></div><p className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</p></div>; }

function ExpensesView({ expenses, monthlyExpenseTotal, monthlyDebtTotal, onAdd, onEdit }: { expenses: Expense[]; monthlyExpenseTotal: number; monthlyDebtTotal: number; onAdd: () => void; onEdit: (expense: Expense) => void }) {
  const autoPayTotal = expenses.filter((item) => item.autoPay).reduce((sum, item) => sum + item.amount, 0);
  return <div>
    <div className="mb-7 flex items-end justify-between"><div><p className="text-sm font-semibold text-[#75847c]">ค่าใช้จ่ายที่เกิดซ้ำ</p><h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">รายจ่ายประจำ</h2></div><Button onClick={onAdd} className="rounded-full bg-[#152d23]"><Plus /> เพิ่มรายจ่าย</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><SummaryCard label="รวมเดือนนี้" value={`฿${money.format(monthlyExpenseTotal)}`} icon={<ReceiptText />} /><SummaryCard label="ตัดอัตโนมัติ" value={`฿${money.format(autoPayTotal)}`} icon={<Repeat2 />} /><SummaryCard label="จำนวนรายการ" value={`${expenses.length} รายการ`} icon={<CalendarDays />} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded-[28px] border border-[#dfe7e1] bg-white">
        <div className="border-b border-[#e6ece7] px-5 py-4 sm:px-7"><h3 className="font-extrabold">รายการทั้งหมด</h3></div>
        <div className="divide-y divide-[#e8ede9] px-5 sm:px-7">{expenses.map((expense) => <button type="button" onClick={() => onEdit(expense)} key={expense.id} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-[#fbfcfa]"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf4eb] text-[#41604d]">{expenseIcon(expense.icon)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{expense.name}</p><p className="mt-0.5 text-xs text-[#7b8981]">{expense.category} · {expense.due}</p></div>{expense.autoPay && <span className="ml-auto hidden rounded-full bg-[#e7f4e5] px-2.5 py-1 text-[11px] font-bold text-[#39704a] sm:block">อัตโนมัติ</span>}<p className={`${expense.autoPay ? "sm:ml-2" : "ml-auto"} text-sm font-black`}>฿{money.format(expense.amount)}</p><ChevronRight className="size-4 text-[#a3aea8]" /></button>)}</div>
      </section>
      <aside className="rounded-[28px] bg-[#e6efdf] p-6"><div className="grid size-11 place-items-center rounded-2xl bg-white"><Sparkles className="size-5" /></div><h3 className="mt-6 text-2xl font-black leading-snug tracking-[-0.04em]">ค่าใช้จ่ายประจำคิดเป็น {Math.round(monthlyExpenseTotal / 680)}% ของรายได้</h3><p className="mt-3 text-sm leading-6 text-[#5e7065]">เดือนนี้ค่าอาหารและของใช้เป็นหมวดที่สูงที่สุด ลองตั้งงบย่อยรายสัปดาห์ที่ประมาณ ฿2,250</p><div className="mt-6 rounded-2xl bg-white/70 p-4"><p className="text-xs text-[#718078]">งบที่ยังใช้ได้หลังหักหนี้และรายจ่าย</p><p className="mt-1 text-2xl font-black">฿{money.format(68000 - monthlyDebtTotal - monthlyExpenseTotal)}</p></div></aside>
    </div>
  </div>;
}

function CalendarView({ debts }: { debts: Debt[] }) {
  const days = Array.from({ length: 35 }, (_, i) => i < 3 ? null : i - 2);
  return <div><p className="text-sm font-semibold text-[#75847c]">กำหนดชำระ</p><h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">ตุลาคม 2569</h2><div className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]"><section className="rounded-[28px] border border-[#dfe7e1] bg-white p-4 sm:p-7"><div className="grid grid-cols-7 text-center text-xs font-bold text-[#849189]">{["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."].map((d)=><div key={d} className="pb-4">{d}</div>)}</div><div className="grid grid-cols-7 gap-1 sm:gap-2">{days.map((day,index)=><div key={index} className={`relative min-h-16 rounded-xl p-2 text-sm sm:min-h-24 ${day===5?"bg-[#152d23] text-white":"bg-[#f6f8f5]"}`}>{day && <><span className="font-semibold">{day}</span>{[5,12,18,25].includes(day) && <span className={`absolute bottom-2 left-2 right-2 h-1.5 rounded-full ${day===5?"bg-[#d7ff71]":"bg-[#82aa75]"}`} />}</>}</div>)}</div></section><aside className="rounded-[28px] bg-[#152d23] p-6 text-white"><p className="text-xs font-semibold text-white/50">กำลังจะถึง</p><h3 className="mt-1 text-xl font-black">4 รายการในเดือนนี้</h3><div className="mt-6 space-y-3">{debts.map((debt,index)=><div key={debt.id} className="flex items-center gap-3 rounded-2xl bg-white/[.07] p-3"><div className={`grid size-10 place-items-center rounded-xl ${toneClasses[debt.tone]}`}>{iconFor(debt.name,"size-4")}</div><div><p className="text-sm font-bold">{debt.name}</p><p className="text-xs text-white/50">{index===3?"สำรองทุกเดือน":debt.due}</p></div><p className="ml-auto text-sm font-bold">฿{money.format(debt.monthly)}</p></div>)}</div></aside></div></div>;
}

function PlannerView({ onBack }: { onBack: () => void }) {
  const [extra, setExtra] = useState(2000);
  return <div className="mx-auto max-w-5xl"><p className="flex items-center gap-2 text-sm font-semibold text-[#5c7366]"><Sparkles className="size-4" /> AI PLANNER</p><h2 className="mt-2 max-w-2xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">ลองปรับเงินโปะ แล้วดูว่าคุณจะเป็นอิสระจากหนี้เร็วขึ้นแค่ไหน</h2><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.9fr]"><section className="rounded-[28px] border border-[#dfe7e1] bg-white p-6 sm:p-8"><label className="text-sm font-bold">เงินที่ต้องการโปะเพิ่มต่อเดือน</label><div className="mt-5 flex items-end gap-2"><span className="pb-1 text-xl font-bold text-[#718078]">฿</span><input aria-label="เงินโปะเพิ่ม" type="number" value={extra} onChange={(e)=>setExtra(Number(e.target.value))} className="w-full border-b-2 border-[#173a2b] bg-transparent pb-2 text-4xl font-black outline-none" /></div><div className="mt-5 flex flex-wrap gap-2">{[1000,2000,3000,5000].map(value=><button key={value} onClick={()=>setExtra(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${extra===value?"bg-[#152d23] text-white":"bg-[#eef3ee]"}`}>฿{money.format(value)}</button>)}</div><div className="mt-8 rounded-2xl bg-[#f1f5f0] p-4"><p className="text-sm font-bold">ใช้กับหนี้ดอกเบี้ยสูงก่อน</p><div className="mt-3 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#cbe6ff]"><CreditCard className="size-5" /></div><div><p className="text-sm font-bold">บัตร K</p><p className="text-xs text-[#718078]">ยอดคงเหลือ ฿48,500</p></div><Check className="ml-auto size-5 text-[#3d7b50]" /></div></div></section><section className="relative overflow-hidden rounded-[28px] bg-[#d7ff71] p-6 sm:p-8"><Lightbulb className="size-8" /><p className="mt-6 text-sm font-semibold">ผลลัพธ์โดยประมาณ</p><p className="mt-2 text-5xl font-black tracking-[-0.06em]">{Math.max(3, Math.round(12-extra/500))} เดือน</p><p className="mt-1 text-sm">เร็วขึ้นจากแผนเดิม</p><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/65 p-4"><p className="text-xs text-[#58705e]">ดอกเบี้ยที่ลดลง</p><p className="mt-1 text-xl font-black">฿{money.format(extra*3.24)}</p></div><div className="rounded-2xl bg-white/65 p-4"><p className="text-xs text-[#58705e]">ปิดบัตรได้ใน</p><p className="mt-1 text-xl font-black">{Math.max(5, Math.round(14-extra/400))} เดือน</p></div></div><p className="mt-6 flex gap-2 text-xs leading-5 text-[#48614f]"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> ตัวเลขนี้เป็นประมาณการเพื่อช่วยวางแผน ไม่ใช่คำแนะนำทางการเงิน</p></section></div><button onClick={onBack} className="mt-6 text-sm font-bold text-[#4e6759]">กลับไปภาพรวม</button></div>;
}

function AddDebtDialog({ open, item, onOpenChange, onSave, onDelete }: { open: boolean; item: Debt | null; onOpenChange: (open: boolean) => void; onSave: (debt: Debt) => void; onDelete: (id: number) => void }) {
  const [category, setCategory] = useState("สินเชื่อส่วนบุคคล");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [monthly, setMonthly] = useState("");
  const [progress, setProgress] = useState("0");
  const [due, setDue] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory(item?.category ?? "สินเชื่อส่วนบุคคล");
    setName(item?.name ?? "");
    setBalance(item ? String(item.balance) : "");
    setMonthly(item ? String(item.monthly) : "");
    setProgress(item ? String(item.progress) : "0");
    setDue(item?.due ?? "");
  }, [item, open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const balanceValue = Number(balance);
    const monthlyValue = Number(monthly);
    if (!cleanName || !Number.isFinite(balanceValue) || balanceValue < 0 || !Number.isFinite(monthlyValue) || monthlyValue < 0) return;
    onSave({
      id: item?.id ?? Date.now(),
      name: cleanName,
      category,
      balance: balanceValue,
      monthly: monthlyValue,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      due: due.trim() || "ยังไม่ระบุ",
      tone: debtToneFromCategory(category),
    });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-auto rounded-[26px] border-[#dfe7e1] p-0 sm:max-w-[540px]"><form onSubmit={submit}><DialogHeader className="border-b border-[#e4eae5] p-6 text-left"><DialogTitle className="text-2xl font-black tracking-[-0.03em]">{item ? "แก้ไขรายการหนี้" : "เพิ่มรายการหนี้"}</DialogTitle><DialogDescription>ข้อมูลจะถูกบันทึกไว้ในเบราว์เซอร์ของอุปกรณ์นี้</DialogDescription></DialogHeader><div className="space-y-5 px-6"><Field label="ประเภทหนี้"><select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}><option>สินเชื่อที่อยู่อาศัย</option><option>สินเชื่อเช่าซื้อ</option><option>บัตรเครดิต</option><option>เงินกู้เพื่อการศึกษา</option><option>สินเชื่อส่วนบุคคล</option><option>หนี้อื่น</option></select></Field><Field label="ชื่อรายการ"><input className="field-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น บ้าน, รถ, บัตร K" required /></Field><div className="grid grid-cols-2 gap-4"><Field label="ยอดคงเหลือ"><input className="field-input" type="number" min="0" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0" required /></Field><Field label="ยอดจ่ายต่อเดือน"><input className="field-input" type="number" min="0" step="0.01" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="0" required /></Field></div><div className="grid grid-cols-2 gap-4"><Field label="ชำระแล้ว (%)"><input className="field-input" type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></Field><Field label="วันครบกำหนด"><input className="field-input" value={due} onChange={(event) => setDue(event.target.value)} placeholder="เช่น 25 ของทุกเดือน" /></Field></div></div><DialogFooter className="mt-2 flex-row border-t border-[#e4eae5] p-6">{item && <Button type="button" variant="outline" onClick={() => onDelete(item.id)} className="mr-auto h-11 rounded-full border-red-200 px-5 text-red-600 hover:bg-red-50">ลบ</Button>}<DialogClose asChild><Button type="button" variant="outline" className="h-11 rounded-full px-5">ยกเลิก</Button></DialogClose><Button type="submit" className="h-11 rounded-full bg-[#152d23] px-6 text-white">บันทึกรายการ</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AddExpenseDialog({ open, item, onOpenChange, onSave, onDelete }: { open: boolean; item: Expense | null; onOpenChange: (open: boolean) => void; onSave: (expense: Expense) => void; onDelete: (id: number) => void }) {
  const [category, setCategory] = useState("สาธารณูปโภค");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [autoPay, setAutoPay] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(item?.category ?? "สาธารณูปโภค");
    setName(item?.name ?? "");
    setAmount(item ? String(item.amount) : "");
    setDue(item?.due ?? "");
    setAutoPay(Boolean(item?.autoPay));
  }, [item, open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const amountValue = Number(amount);
    if (!cleanName || !Number.isFinite(amountValue) || amountValue < 0) return;
    onSave({ id: item?.id ?? Date.now(), name: cleanName, category, amount: amountValue, due: due.trim() || "ยังไม่ระบุ", icon: expenseIconFromCategory(category, cleanName), autoPay });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-auto rounded-[26px] border-[#dfe7e1] p-0 sm:max-w-[540px]"><form onSubmit={submit}><DialogHeader className="border-b border-[#e4eae5] p-6 text-left"><DialogTitle className="text-2xl font-black tracking-[-0.03em]">{item ? "แก้ไขรายจ่ายประจำ" : "เพิ่มรายจ่ายประจำ"}</DialogTitle><DialogDescription>เพิ่มค่าน้ำ ค่าไฟ ค่าโทรศัพท์ หรือรายจ่ายที่เกิดซ้ำทุกเดือน</DialogDescription></DialogHeader><div className="space-y-5 px-6"><Field label="หมวดรายจ่าย"><select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}><option>สาธารณูปโภค</option><option>การสื่อสาร</option><option>การเดินทาง</option><option>อาหารและของใช้</option><option>สมาชิกและแอป</option><option>อื่น ๆ</option></select></Field><Field label="ชื่อรายการ"><input className="field-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น ค่าไฟ, ค่าน้ำ, ค่าโทรศัพท์" required /></Field><div className="grid grid-cols-2 gap-4"><Field label="จำนวนเงินต่อเดือน"><input className="field-input" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" required /></Field><Field label="วันครบกำหนด"><input className="field-input" value={due} onChange={(event) => setDue(event.target.value)} placeholder="เช่น 10 ของทุกเดือน" /></Field></div><label className="flex items-center gap-3 rounded-2xl bg-[#f2f6f1] p-4 text-sm font-bold"><input type="checkbox" checked={autoPay} onChange={(event) => setAutoPay(event.target.checked)} className="size-4 accent-[#152d23]" /> ตัดชำระอัตโนมัติ</label></div><DialogFooter className="mt-2 flex-row border-t border-[#e4eae5] p-6">{item && <Button type="button" variant="outline" onClick={() => onDelete(item.id)} className="mr-auto h-11 rounded-full border-red-200 px-5 text-red-600 hover:bg-red-50">ลบ</Button>}<DialogClose asChild><Button type="button" variant="outline" className="h-11 rounded-full px-5">ยกเลิก</Button></DialogClose><Button type="submit" className="h-11 rounded-full bg-[#152d23] px-6 text-white">บันทึกรายจ่าย</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold"><span className="mb-2 block">{label}</span>{children}</label>; }
