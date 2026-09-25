import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  Check, ChevronLeft, ChevronRight, Copy, Edit3, LoaderCircle, LockKeyhole,
  Plus, RefreshCw, Search, Trash2, UsersRound, X,
} from "lucide-react";
import AppConfirmDialog from "../components/AppConfirmDialog";
import { decimalPlaces, parseDecimalInput } from "../utils/decimalInput";
import { ApiError } from "../services/httpClient";
import {
  copyWorkday, createBulkWorkdays, createEmployee, createWorkday, deleteWorkday,
  getDaySummary, getEmployeeHistory, getEmployeesDashboard, getMonthSummary,
  getWeekSummary, getWeekView, getWorkday, getWorkdayHistory, listEmployees,
  searchActiveEmployees, setEmployeeActive, updateEmployee, updateWorkday,
  type Dashboard, type DaySummary, type Employee, type EmployeeHistory,
  type EmployeeStatus, type MonthSummary, type Page, type ShiftInput,
  type WeekSummary, type WeekView, type Workday, type WorkdayInput, type WorkPeriod,
} from "../services/empleadosApi";
import "../styles/empleados.css";

type Tab = "jornadas" | "empleados" | "resumen";
type WorkMode = "single" | "bulk" | "edit";
type SummaryMode = "day" | "week" | "month";
type EmployeeDraft = { name: string; hourlyRate: string; notes: string };
type WorkDraft = { workDate: string; notes: string; shifts: ShiftInput[] };
const EMPTY_EMPLOYEE: EmployeeDraft = { name: "", hourlyRate: "", notes: "" };
const NEW_SHIFT: ShiftInput = { startTime: "08:00", endTime: "12:00", breakMinutes: 0 };
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
const number = (value: number, digits = 2) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const dayLabel = (value: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const nameCase = (value: string) => value.trim().toLocaleLowerCase("es-AR").replace(/(^|[\s-])(\p{L})/gu, (_whole, separator: string, letter: string) => separator + letter.toLocaleUpperCase("es-AR"));
const shortTime = (value: string) => value.slice(0, 5);

function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function millisecondsUntilArgentinaMidnight() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const elapsed = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + now.getMilliseconds();
  return 86_400_000 - elapsed + 100;
}
function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function weekBounds(value: string) {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  const from = addDays(value, -((day + 6) % 7));
  return { from, to: addDays(from, 6) };
}
function summaryPeriodText(mode: SummaryMode, date: string, month: string) {
  if (mode === "month") {
    if (!/^\d{4}-\d{2}$/.test(month)) return "Elegí un mes";
    const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
    return `Mes de ${label}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Elegí una fecha";
  return mode === "day" ? `Día ${dateLabel(date)}` : `Semana de ${dateLabel(date)}`;
}
function AnimatedMoney({ value }: { value: number | undefined }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    if (value === undefined) return;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / 650, 1);
      setDisplayValue(progress === 1 ? value : value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  if (value === undefined) return <>—</>;
  return <><span aria-hidden="true">{money(displayValue)}</span><span className="emp-visually-hidden">{money(value)}</span></>;
}
function message(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const conflicts = (error.body as { conflicts?: { employeeName: string }[] } | null)?.conflicts;
    return conflicts?.length ? `${error.message} ${conflicts.map((item) => item.employeeName).join(", ")}.` : error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
function workedMinutes(shifts: ShiftInput[]) {
  return shifts.reduce((sum, shift) => {
    if (!/^\d{2}:\d{2}$/.test(shift.startTime) || !/^\d{2}:\d{2}$/.test(shift.endTime)) return sum;
    const start = shift.startTime.split(":").map(Number);
    const end = shift.endTime.split(":").map(Number);
    return sum + Math.max(0, end[0] * 60 + end[1] - start[0] * 60 - start[1] - Number(shift.breakMinutes || 0));
  }, 0);
}
function validShifts(shifts: ShiftInput[]): string | null {
  if (!shifts.length) return "Agregá al menos un turno.";
  const intervals: { start: number; end: number }[] = [];
  for (const shift of shifts) {
    if (!/^\d{2}:\d{2}$/.test(shift.startTime) || !/^\d{2}:\d{2}$/.test(shift.endTime)) return "Completá la entrada y salida de cada turno.";
    const [sh, sm] = shift.startTime.split(":").map(Number);
    const [eh, em] = shift.endTime.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (end <= start) return "La salida debe ser posterior a la entrada, dentro del mismo día.";
    if (!Number.isInteger(Number(shift.breakMinutes)) || Number(shift.breakMinutes) < 0 || Number(shift.breakMinutes) >= end - start) return "El descanso debe ser menor que la duración del turno.";
    intervals.push({ start, end });
  }
  intervals.sort((a, b) => a.start - b.start);
  if (intervals.some((item, index) => index > 0 && item.start < intervals[index - 1].end)) return "Los turnos no pueden superponerse.";
  return null;
}

function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return createPortal(<motion.div className="emp-modal-backdrop"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.28 }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className={`emp-modal ${wide ? "emp-modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.94 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}>
      <header><div><small>{eyebrow}</small><h3>{title}</h3></div><button type="button" className="emp-icon" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
      {children}
    </motion.section>
  </motion.div>, document.body);
}

export default function Empleados() {
  const [today, setToday] = useState(todayArgentina);
  const currentMonthName = useMemo(() => new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" })
    .format(new Date(`${today}T12:00:00Z`)).toLocaleUpperCase("es-AR"), [today]);
  const successTimer = useRef<number | null>(null);
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("jornadas");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [currentWeek, setCurrentWeek] = useState<WeekView | null>(null);
  const [currentWeekLoading, setCurrentWeekLoading] = useState(true);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>("ACTIVE");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeModal, setEmployeeModal] = useState<Employee | "new" | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(EMPTY_EMPLOYEE);
  const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);
  const [employeeHistoryId, setEmployeeHistoryId] = useState<number | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<EmployeeHistory | null>(null);
  const [employeeHistoryPage, setEmployeeHistoryPage] = useState(0);
  const [employeeFrom, setEmployeeFrom] = useState("");
  const [employeeTo, setEmployeeTo] = useState("");
  const [weekDate, setWeekDate] = useState(today);
  const [week, setWeek] = useState<WeekView | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekFailedDate, setWeekFailedDate] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<WorkPeriod>("WEEK");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyEmployeeId, setHistoryEmployeeId] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [history, setHistory] = useState<Page<Workday> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("week");
  const [summaryDate, setSummaryDate] = useState(today);
  const [summaryMonth, setSummaryMonth] = useState(today.slice(0, 7));
  const [summary, setSummary] = useState<DaySummary | WeekSummary | MonthSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkDraft>({ workDate: today, notes: "", shifts: [{ ...NEW_SHIFT }] });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [editingWorkday, setEditingWorkday] = useState<Workday | null>(null);
  const [detail, setDetail] = useState<Workday | null>(null);
  const [copyDate, setCopyDate] = useState(today);
  const [deleteTarget, setDeleteTarget] = useState<Workday | null>(null);

  const refresh = () => { setSummary(null); setRevision((value) => value + 1); };
  const selectedWeek = useMemo(() => weekBounds(weekDate), [weekDate]);
  const currentWeekBounds = useMemo(() => weekBounds(today), [today]);
  const weekLocked = selectedWeek.from > today;
  const creationWeek = tab === "jornadas" ? selectedWeek : currentWeekBounds;
  const workWeek = workMode === "edit" && editingWorkday ? weekBounds(editingWorkday.workDate) : creationWeek;
  const workDateMax = workWeek.to < today ? workWeek.to : today;
  const copyDateMax = creationWeek.to < today ? creationWeek.to : today;
  const visibleWeek = weekDate === today ? currentWeek : week ?? currentWeek;
  const weekMatchesDate = week !== null && weekDate >= week.from && weekDate <= week.to;
  const weekFailed = !weekLocked && weekDate !== today && weekFailedDate === weekDate && !weekLoading;
  const weekPending = weekLocked ? false : weekDate === today ? currentWeekLoading : weekLoading || (!weekMatchesDate && !weekFailed);
  const days = useMemo(() => visibleWeek ? Array.from({ length: 7 }, (_, index) => addDays(visibleWeek.from, index)) : [], [visibleWeek]);
  const summaryPeriod = summaryMode === "week" && summary && "from" in summary
    ? `${dateLabel(summary.from)} — ${dateLabel(summary.to)}`
    : summaryPeriodText(summaryMode, summaryDate, summaryMonth);
  const summaryUnit = summaryMode === "day" ? "DÍA" : summaryMode === "week" ? "SEMANA" : "MES";
  const summaryPeriodSuffix = summaryMode === "day" ? "DEL DÍA" : summaryMode === "week" ? "DE LA SEMANA" : "DEL MES";
  const hourlyRateDisplay = useMemo(() => {
    const rates = activeEmployees.map((employee) => employee.hourlyRate);
    if (!rates.length) return null;
    const minimum = Math.min(...rates);
    const maximum = Math.max(...rates);
    return minimum === maximum ? `${money(minimum)}/h` : `${money(minimum)} – ${money(maximum)}/h`;
  }, [activeEmployees]);
  const selectedActive = activeEmployees.filter((item) => selectedEmployeeIds.includes(item.id));
  const previewMinutes = workedMinutes(workDraft.shifts);
  const previewRate = workMode === "edit" ? editingWorkday?.hourlyRateSnapshot ?? 0 : selectedActive[0]?.hourlyRate ?? 0;

  useEffect(() => {
    const updateToday = () => setToday(todayArgentina());
    let timer = 0;
    const scheduleMidnight = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { updateToday(); scheduleMidnight(); }, millisecondsUntilArgentinaMidnight());
    };
    const resync = () => { updateToday(); scheduleMidnight(); };
    scheduleMidnight();
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  useEffect(() => () => {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
  }, []);
  function showSuccess(text: string) {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
    setSuccess(text);
    successTimer.current = window.setTimeout(() => { setSuccess(""); successTimer.current = null; }, 1700);
  }

  useEffect(() => {
    let current = true;
    Promise.all([getEmployeesDashboard(), listEmployees("ALL")]).then(([stats, people]) => {
      if (current) { setDashboard(stats); setAllEmployees(people); setActiveEmployees(people.filter((item) => item.active)); }
    }).catch((cause) => { if (current) setError(message(cause, "No se pudo cargar el módulo.")); });
    getWeekView(today).then((thisWeek) => { if (current) setCurrentWeek(thisWeek); })
      .catch((cause) => { if (current) setError(message(cause, "No se pudo cargar la semana actual.")); })
      .finally(() => { if (current) setCurrentWeekLoading(false); });
    return () => { current = false; };
  }, [revision, today]);

  useEffect(() => {
    if (tab !== "jornadas" || weekDate === today || weekLocked) return;
    let current = true;
    const timer = window.setTimeout(() => { if (current) { setWeekLoading(true); setWeekFailedDate(null); } }, 0);
    getWeekView(weekDate).then((value) => { if (current) { setWeek(value); setWeekFailedDate(null); } })
      .catch((cause) => { if (current) { setWeekFailedDate(weekDate); setError(message(cause, "No se pudo cargar la semana.")); } })
      .finally(() => { if (current) { window.clearTimeout(timer); setWeekLoading(false); } });
    return () => { current = false; window.clearTimeout(timer); };
  }, [tab, weekDate, weekLocked, revision, today]);

  useEffect(() => {
    if (tab !== "jornadas" || (historyPeriod === "CUSTOM" && (!historyFrom || !historyTo || historyFrom > historyTo))) return;
    let current = true;
    window.setTimeout(() => { if (current) setHistoryLoading(true); }, 0);
    getWorkdayHistory({
      period: historyPeriod,
      from: historyPeriod === "CUSTOM" ? historyFrom : undefined,
      to: historyPeriod === "CUSTOM" ? historyTo : undefined,
      employeeId: historyEmployeeId ? Number(historyEmployeeId) : undefined,
      page: historyPage, size: 20, sort: "workDate,desc",
    }).then((value) => { if (current) setHistory(value); })
      .catch((cause) => { if (current) setError(message(cause, "No se pudo cargar el historial.")); })
      .finally(() => { if (current) setHistoryLoading(false); });
    return () => { current = false; };
  }, [tab, historyPeriod, historyFrom, historyTo, historyEmployeeId, historyPage, revision]);

  useEffect(() => {
    if (tab !== "empleados") return;
    let current = true;
    const timer = window.setTimeout(() => {
      setEmployeesLoading(true);
      const query = employeeSearch.trim();
      const operation = employeeStatus === "ACTIVE" && query ? searchActiveEmployees(query) : listEmployees(employeeStatus);
      operation.then((list) => { if (current) setEmployees(employeeStatus !== "ACTIVE" && query ? list.filter((item) => item.name.toLocaleLowerCase("es-AR").includes(query.toLocaleLowerCase("es-AR"))) : list); })
        .catch((cause) => { if (current) setError(message(cause, "No se pudieron cargar los empleados.")); })
        .finally(() => { if (current) setEmployeesLoading(false); });
    }, employeeSearch ? 250 : 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [tab, employeeStatus, employeeSearch, revision]);

  useEffect(() => {
    if (tab !== "empleados" || employeeHistoryId === null || (employeeFrom && employeeTo && employeeFrom > employeeTo)) return;
    let current = true;
    getEmployeeHistory(employeeHistoryId, { from: employeeFrom || undefined, to: employeeTo || undefined, page: employeeHistoryPage, size: 20, sort: "workDate,desc" })
      .then((value) => { if (current) setEmployeeHistory(value); })
      .catch((cause) => { if (current) setError(message(cause, "No se pudo cargar el historial del empleado.")); });
    return () => { current = false; };
  }, [tab, employeeHistoryId, employeeFrom, employeeTo, employeeHistoryPage, revision]);

  useEffect(() => {
    if (tab !== "resumen") return;
    let current = true;
    window.setTimeout(() => { if (current) setSummaryLoading(true); }, 0);
    const operation = summaryMode === "day" ? getDaySummary(summaryDate)
      : summaryMode === "week" ? getWeekSummary(summaryDate)
      : getMonthSummary(Number(summaryMonth.slice(0, 4)), Number(summaryMonth.slice(5, 7)));
    operation.then((value) => { if (current) setSummary(value); })
      .catch((cause) => { if (current) setError(message(cause, "No se pudo cargar el resumen.")); })
      .finally(() => { if (current) setSummaryLoading(false); });
    return () => { current = false; };
  }, [tab, summaryMode, summaryDate, summaryMonth, revision]);

  function openEmployee(item: Employee | "new") {
    setEmployeeDraft(item === "new" ? EMPTY_EMPLOYEE : { name: nameCase(item.name), hourlyRate: String(item.hourlyRate), notes: item.notes ?? "" });
    setEmployeeModal(item);
    setError("");
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = parseDecimalInput(employeeDraft.hourlyRate);
    if (!employeeDraft.name.trim() || employeeDraft.name.trim().length > 150 || !Number.isFinite(rate) || rate <= 0 || decimalPlaces(employeeDraft.hourlyRate) > 2 || employeeDraft.notes.length > 500) {
      setError("Revisá el nombre, el valor por hora (hasta 2 decimales) y las notas.");
      return;
    }
    setBusy(true); setError("");
    try {
      const payload = { name: nameCase(employeeDraft.name), hourlyRate: rate, notes: employeeDraft.notes.trim() || null };
      if (employeeModal === "new") await createEmployee(payload);
      else if (employeeModal) await updateEmployee(employeeModal.id, payload);
      showSuccess(employeeModal === "new" ? "Empleado creado" : "Empleado actualizado");
      setEmployeeModal(null); refresh();
    } catch (cause) { setError(message(cause, "No se pudo guardar el empleado.")); }
    finally { setBusy(false); }
  }

  function openWork(mode: WorkMode, item?: Workday) {
    const todayNow = todayArgentina();
    const bounds = mode === "edit" && item ? weekBounds(item.workDate) : creationWeek;
    if (bounds.from > todayNow) { setError("Las semanas futuras están bloqueadas para cargar jornadas."); return; }
    const lastAllowedDate = bounds.to < todayNow ? bounds.to : todayNow;
    const preferredDate = tab === "jornadas" ? weekDate : todayNow;
    const initialDate = preferredDate < bounds.from ? bounds.from : preferredDate > lastAllowedDate ? lastAllowedDate : preferredDate;
    setWorkMode(mode); setEditingWorkday(item ?? null); setError("");
    setSelectedEmployeeIds(item ? [item.employee.id] : []);
    setWorkDraft(item ? { workDate: item.workDate, notes: item.notes ?? "", shifts: item.shifts.map((shift) => ({ startTime: shortTime(shift.startTime), endTime: shortTime(shift.endTime), breakMinutes: shift.breakMinutes })) }
      : { workDate: initialDate, notes: "", shifts: [{ ...NEW_SHIFT }] });
    setDetail(null);
  }
  function changeShift(index: number, field: keyof ShiftInput, value: string) {
    setWorkDraft((current) => ({ ...current, shifts: current.shifts.map((shift, position) => position === index ? { ...shift, [field]: field === "breakMinutes" ? Number(value) : value } : shift) }));
  }
  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validShifts(workDraft.shifts);
    if (problem) { setError(problem); return; }
    if (!workDraft.workDate || workDraft.notes.length > 1000) { setError("Revisá la fecha y las notas de la jornada."); return; }
    const todayNow = todayArgentina();
    const latestDate = workWeek.to < todayNow ? workWeek.to : todayNow;
    if (workDraft.workDate < workWeek.from || workDraft.workDate > latestDate) { setError("La fecha debe estar dentro de la semana seleccionada y no puede ser futura."); return; }
    if (workMode !== "edit" && (!selectedEmployeeIds.length || (workMode === "bulk" && selectedEmployeeIds.length > 100))) { setError("Elegí entre 1 y 100 empleados activos."); return; }
    setBusy(true); setError("");
    try {
      const payload: WorkdayInput = { workDate: workDraft.workDate, notes: workDraft.notes.trim() || null, shifts: workDraft.shifts };
      if (workMode === "edit" && editingWorkday) await updateWorkday(editingWorkday.id, payload);
      else if (workMode === "bulk") await createBulkWorkdays(selectedEmployeeIds, payload);
      else await createWorkday(selectedEmployeeIds[0], payload);
      showSuccess(workMode === "edit" ? "Jornada corregida" : workMode === "bulk" ? "Jornadas creadas" : "Jornada creada");
      setWorkMode(null); setWeekDate(workDraft.workDate); refresh();
    } catch (cause) { setError(message(cause, "No se pudo guardar la jornada.")); }
    finally { setBusy(false); }
  }
  async function showWorkday(id: number) {
    setBusy(true); setError("");
    try {
      const workday = await getWorkday(id);
      const todayNow = todayArgentina();
      const lastAllowedDate = creationWeek.to < todayNow ? creationWeek.to : todayNow;
      const nextDay = addDays(workday.workDate, 1);
      const firstChoice = creationWeek.from > lastAllowedDate ? ""
        : nextDay >= creationWeek.from && nextDay <= lastAllowedDate ? nextDay
        : creationWeek.from !== workday.workDate ? creationWeek.from
        : creationWeek.from < lastAllowedDate ? addDays(creationWeek.from, 1) : "";
      setDetail(workday);
      setCopyDate(firstChoice);
    }
    catch (cause) { setError(message(cause, "No se pudo cargar la jornada.")); }
    finally { setBusy(false); }
  }
  async function submitCopy() {
    if (!detail || !copyDate) return;
    const todayNow = todayArgentina();
    const latestDate = creationWeek.to < todayNow ? creationWeek.to : todayNow;
    if (copyDate < creationWeek.from || copyDate > latestDate || copyDate === detail.workDate) {
      setError("Elegí otra fecha dentro de la semana seleccionada, hasta hoy.");
      return;
    }
    setBusy(true); setError("");
    try { await copyWorkday(detail.id, copyDate); showSuccess("Jornada copiada"); setDetail(null); setWeekDate(copyDate); refresh(); }
    catch (cause) { setError(message(cause, "No se pudo copiar la jornada.")); }
    finally { setBusy(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true); setError("");
    try { await deleteWorkday(deleteTarget.id); showSuccess("Jornada eliminada"); setDeleteTarget(null); setDetail(null); refresh(); }
    catch (cause) { setError(message(cause, "No se pudo eliminar la jornada.")); setDeleteTarget(null); }
    finally { setBusy(false); }
  }
  async function confirmToggle() {
    if (!employeeToToggle) return;
    setBusy(true); setError("");
    try { await setEmployeeActive(employeeToToggle.id, !employeeToToggle.active); showSuccess(employeeToToggle.active ? "Empleado desactivado" : "Empleado activado"); setEmployeeToToggle(null); refresh(); }
    catch (cause) { setError(message(cause, "No se pudo cambiar el estado.")); setEmployeeToToggle(null); }
    finally { setBusy(false); }
  }

  return <MotionConfig reducedMotion="never"><section className="emp-page">
    <header className="emp-hero">
      <div><p>GESTIÓN DEL EQUIPO</p><h2>Empleados y jornadas</h2><span>Horas, turnos e importes en un solo lugar.</span></div>
      <div className="emp-hero__actions"><button className="emp-ghost" type="button" onClick={refresh} aria-label="Actualizar datos"><RefreshCw size={17} /></button><button className="emp-primary" type="button" onClick={() => openWork("single")} disabled={tab === "jornadas" && weekLocked} title={tab === "jornadas" && weekLocked ? "Las semanas futuras están bloqueadas" : undefined}><Plus size={17} /> Cargar jornada</button></div>
    </header>
    {error && <div className="emp-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar error"><X size={16} /></button></div>}
    <section className="emp-activity" aria-label={tab === "resumen" ? "Resumen del equipo" : "Actividad del equipo"}>
      {tab === "resumen" ? <div className="emp-activity__body emp-activity__body--summary">
        <div className="emp-activity__title"><small>RESUMEN · {summaryUnit}</small><h3>Resumen del equipo</h3><span className="emp-activity__period">{summaryPeriod}</span></div>
        <div className="emp-activity__metric"><small>HORAS {summaryPeriodSuffix}</small><strong>{summary ? `${number(summary.totalWorkedHours)} h` : "—"}</strong></div>
        <div className="emp-activity__metric"><small>COSTO {summaryPeriodSuffix}</small><strong><AnimatedMoney value={summary?.totalAmount} /></strong></div>
        <div className="emp-activity__metric"><small>EMPLEADOS CON JORNADAS</small><strong>{summary?.employees.length ?? "—"}</strong></div>
      </div> : <div className="emp-activity__body emp-activity__body--dashboard">
        <div className="emp-activity__title"><small>EN NÚMEROS</small><h3>Actividad del equipo</h3></div>
        <div className="emp-activity__metric"><small>HORAS ESTA SEMANA</small><strong>{dashboard ? `${number(dashboard.week.workedHours)} h` : "—"}</strong></div>
        <div className="emp-activity__metric"><small>HORAS HOY</small><strong>{dashboard ? `${number(dashboard.today.workedHours)} h` : "—"}</strong></div>
        <div className="emp-activity__metric"><small>COSTO DE MES DE <span className="emp-activity__month">{currentMonthName}</span></small><strong><AnimatedMoney value={dashboard?.month.amount} /></strong></div>
        <div className="emp-activity__metric"><small>EMPLEADOS ACTIVOS</small><strong>{dashboard?.activeEmployees ?? "—"}</strong></div>
        <div className="emp-activity__metric emp-activity__metric--hourly-rate" title="Valor por hora de los empleados activos"><small>VALOR POR HORA</small><strong>{hourlyRateDisplay ?? "—"}</strong></div>
      </div>}
    </section>
    <nav className="emp-tabs" aria-label="Secciones de empleados">
      {([["jornadas", "Jornadas"], ["empleados", "Empleados"], ["resumen", "Resúmenes"]] as const).map(([value, label]) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => { if (value === "resumen" && tab !== "resumen") setSummary(null); setTab(value); setError(""); }}>{label}</button>)}
    </nav>

    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} className="emp-tab-panel"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -9 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
    {tab === "jornadas" && <>
      <section className="emp-card">
        <header className="emp-card__header"><div><small>PLANILLA SEMANAL</small><h3>{weekLocked ? `${dateLabel(selectedWeek.from)} — ${dateLabel(selectedWeek.to)}` : weekFailed ? "Semana no disponible" : weekPending ? "Cargando semana…" : visibleWeek ? `${dateLabel(visibleWeek.from)} — ${dateLabel(visibleWeek.to)}` : "Semana"}</h3><p>Seleccioná un día registrado para ver y corregir la jornada.</p></div><div className="emp-inline"><button className="emp-ghost" type="button" onClick={() => setWeekDate(addDays(weekDate || today, -7))} aria-label="Semana anterior"><ChevronLeft size={18} /></button><input type="date" value={weekDate} onChange={(event) => { if (event.target.value) setWeekDate(event.target.value); }} aria-label="Semana de" /><button className="emp-ghost" type="button" onClick={() => setWeekDate(addDays(weekDate || today, 7))} aria-label="Semana siguiente"><ChevronRight size={18} /></button><button className="emp-secondary" type="button" onClick={() => openWork("bulk")} disabled={weekLocked} title={weekLocked ? "Las semanas futuras están bloqueadas" : undefined}><UsersRound size={16} /> Carga masiva</button></div></header>
        {weekLocked ? <div className="emp-week-locked" role="status"><span className="emp-week-locked__icon"><LockKeyhole size={25} /></span><strong>Semana bloqueada</strong><p>No se pueden cargar jornadas en semanas futuras. Volvé a la semana actual o a una anterior.</p></div> :
        <div className="emp-week-content" aria-busy={weekPending}>
          {visibleWeek && !weekFailed && <div className={`emp-week-content__data${weekPending ? " is-pending" : ""}`} inert={weekPending}>
          <div className="emp-week-scroll"><table className="emp-week"><thead><tr><th>EMPLEADO</th>{days.map((day) => <th key={day} className={day === today ? "is-today" : ""}>{dayLabel(day)}</th>)}<th>TOTAL</th></tr></thead><tbody>{visibleWeek.employees.map((person) => <tr key={person.employeeId}><th scope="row"><strong>{nameCase(person.employeeName)}</strong>{!person.active && <small>Inactivo</small>}</th>{days.map((day) => { const cell = person.days.find((item) => item.date === day); return <td key={day} className={day > today ? "emp-week__future-day" : undefined}>{day > today ? <span className="emp-week__future-label"><LockKeyhole size={12} /> Bloqueado</span> : cell ? <button type="button" onClick={() => void showWorkday(cell.workDayId)} title={`${number(cell.totalWorkedHours)} h · ${money(cell.totalAmount)}`}><strong>{number(cell.totalWorkedHours)} h</strong><small>{cell.shiftCount} {cell.shiftCount === 1 ? "turno" : "turnos"}</small></button> : <span>—</span>}</td>; })}<td className="emp-week__total"><strong>{number(person.weekWorkedHours)} h</strong><small>{money(person.weekAmount)}</small></td></tr>)}</tbody></table></div>
          {!visibleWeek.employees.length && <div className="emp-empty">Todavía no hay empleados para mostrar esta semana.</div>}
          <div className="emp-week-footer"><span>Total de la semana</span><strong>{number(visibleWeek.totalWorkedHours)} horas</strong><strong>{money(visibleWeek.totalAmount)}</strong></div>
          </div>}
          {weekPending && <div className="emp-week-loading" role="status"><LoaderCircle className="emp-spin" size={20} /> Cargando semana…</div>}
          {weekFailed && <div className="emp-empty">No se pudo cargar la semana seleccionada.</div>}
        </div>}
      </section>
      <section className="emp-card">
        <header className="emp-card__header"><div><small>REGISTROS</small><h3>Historial de jornadas</h3></div><div className="emp-filters"><select value={historyPeriod} onChange={(event) => { setHistoryPeriod(event.target.value as WorkPeriod); setHistoryPage(0); }} aria-label="Período"><option value="TODAY">Hoy</option><option value="WEEK">Esta semana</option><option value="MONTH">Este mes</option><option value="CUSTOM">Entre fechas</option></select><select value={historyEmployeeId} onChange={(event) => { setHistoryEmployeeId(event.target.value); setHistoryPage(0); }} aria-label="Empleado"><option value="">Todos los empleados</option>{allEmployees.map((item) => <option key={item.id} value={item.id}>{nameCase(item.name)}</option>)}</select>{historyPeriod === "CUSTOM" && <><input type="date" value={historyFrom} onChange={(event) => { setHistoryFrom(event.target.value); setHistoryPage(0); }} aria-label="Desde" /><input type="date" value={historyTo} min={historyFrom} onChange={(event) => { setHistoryTo(event.target.value); setHistoryPage(0); }} aria-label="Hasta" /></>}</div></header>
        {historyPeriod === "CUSTOM" && (!historyFrom || !historyTo || historyFrom > historyTo) ? <div className="emp-empty">Elegí un rango de fechas válido para consultar el historial.</div> : historyLoading ? <div className="emp-loading"><LoaderCircle className="emp-spin" size={20} /> Cargando registros…</div> : <WorkdayTable items={history?.content ?? []} onOpen={(id) => void showWorkday(id)} />}
        {history && history.totalPages > 1 && !(historyPeriod === "CUSTOM" && (!historyFrom || !historyTo || historyFrom > historyTo)) && <Pagination page={historyPage} total={history.totalPages} onPage={setHistoryPage} />}
      </section>
    </>}

    {tab === "empleados" && <>
      <section className="emp-card"><header className="emp-card__header"><div><small>EQUIPO</small><h3>Empleados</h3><p>El valor por hora actualizado se aplica a las próximas jornadas.</p></div><button className="emp-primary" type="button" onClick={() => openEmployee("new")}><Plus size={16} /> Nuevo empleado</button></header>
        <div className="emp-list-toolbar"><label><Search size={17} /><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Buscar por nombre" maxLength={150} /></label><div className="emp-segments">{([["ACTIVE", "Activos"], ["INACTIVE", "Inactivos"], ["ALL", "Todos"]] as const).map(([value, label]) => <button key={value} className={employeeStatus === value ? "is-active" : ""} type="button" onClick={() => setEmployeeStatus(value)}>{label}</button>)}</div></div>
        {employeesLoading ? <div className="emp-loading"><LoaderCircle className="emp-spin" size={20} /> Cargando empleados…</div> : <div className="emp-table-scroll"><table className="emp-table"><thead><tr><th>EMPLEADO</th><th>VALOR POR HORA</th><th>ESTADO</th><th>NOTAS</th><th>ACCIONES</th></tr></thead><tbody>{employees.map((item) => <tr key={item.id}><td><strong>{nameCase(item.name)}</strong></td><td>{money(item.hourlyRate)}</td><td><span className={`emp-badge ${item.active ? "is-active" : ""}`}>{item.active ? "Activo" : "Inactivo"}</span></td><td className="emp-table__notes">{item.notes || "—"}</td><td><div className="emp-row-actions"><button type="button" onClick={() => { setEmployeeHistoryId(item.id); setEmployeeHistoryPage(0); setEmployeeHistory(null); }} title="Ver historial">Historial</button><button type="button" onClick={() => openEmployee(item)} title="Editar"><Edit3 size={15} /></button><button type="button" onClick={() => setEmployeeToToggle(item)}>{item.active ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table>{!employees.length && <div className="emp-empty">No hay empleados que coincidan con el filtro.</div>}</div>}
      </section>
      {employeeHistoryId !== null && <section className="emp-card"><header className="emp-card__header"><div><small>HISTORIAL INDIVIDUAL</small><h3>{employeeHistory ? nameCase(employeeHistory.employee.name) : "Cargando…"}</h3></div><div className="emp-inline"><input type="date" value={employeeFrom} onChange={(event) => { setEmployeeFrom(event.target.value); setEmployeeHistoryPage(0); }} aria-label="Desde" /><input type="date" min={employeeFrom} value={employeeTo} onChange={(event) => { setEmployeeTo(event.target.value); setEmployeeHistoryPage(0); }} aria-label="Hasta" /><button className="emp-ghost" type="button" onClick={() => { setEmployeeHistoryId(null); setEmployeeHistory(null); }} aria-label="Cerrar historial"><X size={18} /></button></div></header>
        {employeeFrom && employeeTo && employeeFrom > employeeTo ? <div className="emp-empty">La fecha inicial no puede ser posterior a la final.</div> : employeeHistory && <><div className="emp-history-totals"><span><strong>{number(employeeHistory.totalWorkedHours)} h</strong> trabajadas</span><span><strong>{money(employeeHistory.totalAmount)}</strong> acumulado</span></div><WorkdayTable items={employeeHistory.workDays.content} onOpen={(id) => void showWorkday(id)} />{employeeHistory.workDays.totalPages > 1 && <Pagination page={employeeHistoryPage} total={employeeHistory.workDays.totalPages} onPage={setEmployeeHistoryPage} />}</>}
      </section>}
    </>}

    {tab === "resumen" && <section className="emp-card"><header className="emp-card__header"><div><small>COSTOS Y HORAS</small><h3>Detalle por empleado</h3><p>Desglose del período seleccionado.</p></div><div className="emp-filters"><select value={summaryMode} onChange={(event) => { setSummary(null); setSummaryMode(event.target.value as SummaryMode); }} aria-label="Tipo de resumen"><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select>{summaryMode === "month" ? <input type="month" value={summaryMonth} onChange={(event) => { setSummary(null); setSummaryMonth(event.target.value); }} aria-label="Mes" /> : <input type="date" value={summaryDate} onChange={(event) => { setSummary(null); setSummaryDate(event.target.value); }} aria-label="Fecha" />}</div></header>
      {summaryLoading ? <div className="emp-loading"><LoaderCircle className="emp-spin" size={20} /> Cargando resumen…</div> : summary && <div className="emp-table-scroll"><table className="emp-table"><thead><tr><th>EMPLEADO</th><th>HORAS TRABAJADAS</th><th>IMPORTE</th></tr></thead><tbody>{summary.employees.map((item) => <tr key={item.employeeId}><td><strong>{nameCase(item.employeeName)}</strong></td><td>{number(item.workedHours)} h</td><td><strong>{money(item.amount)}</strong></td></tr>)}</tbody></table>{!summary.employees.length && <div className="emp-empty">No hay jornadas en este período.</div>}</div>}
    </section>}
      </motion.div>
    </AnimatePresence>

    <AnimatePresence initial={false}>
    {employeeModal && <Modal key="employee" title={employeeModal === "new" ? "Nuevo empleado" : "Editar empleado"} eyebrow="DATOS DEL EMPLEADO" onClose={() => setEmployeeModal(null)}>
      <form className="emp-form" onSubmit={(event) => void submitEmployee(event)}>
        <label>Nombre<input autoFocus required maxLength={150} value={employeeDraft.name} onChange={(event) => setEmployeeDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Juan Pérez" /></label>
        <label>Valor por hora<input required inputMode="decimal" value={employeeDraft.hourlyRate} onChange={(event) => setEmployeeDraft((current) => ({ ...current, hourlyRate: event.target.value }))} placeholder="Ej. 3500,00" /></label>
        <label>Notas <small>{employeeDraft.notes.length}/500</small><textarea rows={3} maxLength={500} value={employeeDraft.notes} onChange={(event) => setEmployeeDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Tarea o información útil" /></label>
        {error && <p className="emp-form-error">{error}</p>}
        <footer><button className="emp-secondary" type="button" onClick={() => setEmployeeModal(null)}>Cancelar</button><button className="emp-primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="emp-spin" size={16} /> Guardando…</> : "Guardar empleado"}</button></footer>
      </form>
    </Modal>}

    {workMode && <Modal key="workday" wide title={workMode === "edit" ? "Corregir jornada" : workMode === "bulk" ? "Carga masiva" : "Nueva jornada"} eyebrow="TURNOS Y HORAS" onClose={() => setWorkMode(null)}>
      <form className="emp-form" onSubmit={(event) => void submitWork(event)}>
        {workMode === "edit" ? <div className="emp-form-info">Empleado: <strong>{nameCase(editingWorkday?.employee.name ?? "")}</strong> · valor histórico {money(editingWorkday?.hourlyRateSnapshot ?? 0)}/h</div> : workMode === "single" ? <label>Empleado<select required value={selectedEmployeeIds[0] ?? ""} onChange={(event) => setSelectedEmployeeIds(event.target.value ? [Number(event.target.value)] : [])}><option value="">Seleccionar empleado activo</option>{activeEmployees.map((item) => <option key={item.id} value={item.id}>{nameCase(item.name)} · {money(item.hourlyRate)}/h</option>)}</select></label> : <fieldset className="emp-employee-picker"><legend>Empleados activos ({selectedEmployeeIds.length} seleccionados)</legend><div>{activeEmployees.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEmployeeIds.includes(item.id)} onChange={(event) => setSelectedEmployeeIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{nameCase(item.name)}<small>{money(item.hourlyRate)}/h</small></span></label>)}</div></fieldset>}
        <label>Fecha<input required type="date" min={workWeek.from} max={workDateMax} value={workDraft.workDate} onChange={(event) => setWorkDraft((current) => ({ ...current, workDate: event.target.value }))} /><small className="emp-date-hint">Del {dateLabel(workWeek.from)} al {dateLabel(workDateMax)}. No se permiten fechas futuras.</small></label>
        <div className="emp-shifts"><div className="emp-shifts__heading"><strong>Turnos</strong><button className="emp-secondary" type="button" onClick={() => setWorkDraft((current) => ({ ...current, shifts: [...current.shifts, { ...NEW_SHIFT }] }))}><Plus size={15} /> Agregar turno</button></div>{workDraft.shifts.map((shift, index) => <div className="emp-shift" key={index}><span>{index + 1}</span><label>Entrada<input type="time" required step={60} value={shift.startTime} onChange={(event) => changeShift(index, "startTime", event.target.value)} /></label><label>Salida<input type="time" required step={60} value={shift.endTime} onChange={(event) => changeShift(index, "endTime", event.target.value)} /></label><label>Descanso (min)<input type="number" min="0" step="1" required value={shift.breakMinutes} onChange={(event) => changeShift(index, "breakMinutes", event.target.value)} /></label><button className="emp-icon" type="button" onClick={() => setWorkDraft((current) => ({ ...current, shifts: current.shifts.filter((_, position) => position !== index) }))} disabled={workDraft.shifts.length === 1} aria-label={`Quitar turno ${index + 1}`}><Trash2 size={17} /></button></div>)}</div>
        <label>Notas <small>{workDraft.notes.length}/1000</small><textarea rows={2} maxLength={1000} value={workDraft.notes} onChange={(event) => setWorkDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Opcional" /></label>
        <div className="emp-preview"><span>Vista previa · {number(previewMinutes / 60)} horas</span>{workMode === "bulk" ? <strong>{selectedActive.length} empleados · {money(selectedActive.reduce((sum, item) => sum + item.hourlyRate * previewMinutes / 60, 0))}</strong> : <strong>{money(previewRate * previewMinutes / 60)}</strong>}<small>El backend confirma las horas y el importe definitivo al guardar.</small></div>
        {error && <p className="emp-form-error">{error}</p>}
        <footer><button className="emp-secondary" type="button" onClick={() => setWorkMode(null)}>Cancelar</button><button className="emp-primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="emp-spin" size={16} /> Guardando…</> : workMode === "bulk" ? "Crear jornadas" : "Guardar jornada"}</button></footer>
      </form>
    </Modal>}

    {detail && <Modal key="detail" title={`Jornada de ${nameCase(detail.employee.name)}`} eyebrow={dateLabel(detail.workDate)} onClose={() => setDetail(null)}>
      <div className="emp-detail"><div className="emp-detail__total"><span>{number(detail.totalWorkedHours)} h</span><strong>{money(detail.totalAmount)}</strong></div><p>Valor histórico: {money(detail.hourlyRateSnapshot)} por hora</p><h4>Turnos</h4>{detail.shifts.map((shift) => <div className="emp-detail__shift" key={shift.id}><span>{shortTime(shift.startTime)} – {shortTime(shift.endTime)}</span><strong>{number(shift.workedHours)} h</strong><small>{shift.breakMinutes ? `${shift.breakMinutes} min de descanso` : "Sin descanso"}</small></div>)}{detail.notes && <p className="emp-detail__notes">{detail.notes}</p>}{error && <p className="emp-form-error">{error}</p>}<div className="emp-copy"><label>Copiar a otra fecha<input type="date" min={creationWeek.from} max={copyDateMax} value={copyDate} onChange={(event) => setCopyDate(event.target.value)} /></label><button className="emp-secondary" type="button" onClick={() => void submitCopy()} disabled={busy || !copyDate || creationWeek.from > today || allEmployees.find((item) => item.id === detail.employee.id)?.active === false} title={allEmployees.find((item) => item.id === detail.employee.id)?.active === false ? "No se puede copiar la jornada de un empleado inactivo" : creationWeek.from > today ? "Las semanas futuras están bloqueadas" : undefined}><Copy size={15} /> Copiar</button></div><footer><button className="emp-secondary emp-danger" type="button" onClick={() => setDeleteTarget(detail)}><Trash2 size={15} /> Eliminar</button><button className="emp-primary" type="button" onClick={() => openWork("edit", detail)}><Edit3 size={15} /> Corregir</button></footer></div>
    </Modal>}
    </AnimatePresence>
    {createPortal(<AnimatePresence>
      {success && <motion.div className="emp-success" role="status" aria-live="polite"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}>
        <motion.div className="emp-success__card"
          initial={{ opacity: 0, y: 22, scale: 0.84 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.93 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <span className="emp-success__icon">
            <motion.span className="emp-success__ring" initial={{ scale: 0.7, opacity: 0.8 }} animate={{ scale: 1.55, opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut", delay: 0.12 }} />
            <motion.span initial={{ scale: 0.2, rotate: -35 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.52, type: "spring", stiffness: 300, damping: 16 }}>
              <Check size={32} strokeWidth={2.8} />
            </motion.span>
          </span>
          <strong>{success}</strong>
        </motion.div>
      </motion.div>}
    </AnimatePresence>, document.body)}
    <AppConfirmDialog open={Boolean(deleteTarget)} title="Eliminar jornada" description={`Se eliminará la jornada de ${deleteTarget?.employee.name ?? ""} del ${deleteTarget ? dateLabel(deleteTarget.workDate) : ""} y sus turnos.`} confirmText="Eliminar jornada" variant="danger" loading={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
    <AppConfirmDialog open={Boolean(employeeToToggle)} title={employeeToToggle?.active ? "Desactivar empleado" : "Activar empleado"} description={employeeToToggle?.active ? "El empleado seguirá visible en el historial y no podrá recibir jornadas nuevas." : "El empleado podrá volver a recibir jornadas nuevas."} confirmText={employeeToToggle?.active ? "Desactivar" : "Activar"} variant={employeeToToggle?.active ? "danger" : "primary"} loading={busy} onConfirm={() => void confirmToggle()} onCancel={() => setEmployeeToToggle(null)} />
  </section></MotionConfig>;
}

function WorkdayTable({ items, onOpen }: { items: Workday[]; onOpen: (id: number) => void }) {
  return <div className="emp-table-scroll"><table className="emp-table"><thead><tr><th>FECHA</th><th>EMPLEADO</th><th>TURNOS</th><th>HORAS</th><th>IMPORTE</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{dateLabel(item.workDate)}</td><td><strong>{nameCase(item.employee.name)}</strong></td><td>{item.shiftCount}</td><td>{number(item.totalWorkedHours)} h</td><td><strong>{money(item.totalAmount)}</strong></td><td><button className="emp-row-link" type="button" onClick={() => onOpen(item.id)}>Ver detalle <ChevronRight size={15} /></button></td></tr>)}</tbody></table>{!items.length && <div className="emp-empty">No hay jornadas registradas para este filtro.</div>}</div>;
}
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  return <div className="emp-pagination"><span>Página {page + 1} de {total}</span><div><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={17} /></button><button type="button" disabled={page >= total - 1} onClick={() => onPage(page + 1)} aria-label="Página siguiente"><ChevronRight size={17} /></button></div></div>;
}
