import { API_URL } from "../config/api";
import { apiFetch, crearApiError } from "./httpClient";

const base = `${API_URL}/api/v2`;

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ALL";
export type WorkPeriod = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";
export type Employee = {
  id: number;
  name: string;
  hourlyRate: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type EmployeePayload = { name: string; hourlyRate: number; notes: string | null };
export type ShiftInput = { startTime: string; endTime: string; breakMinutes: number };
export type WorkdayInput = { workDate: string; notes: string | null; shifts: ShiftInput[] };
export type Workday = {
  id: number;
  employee: { id: number; name: string };
  workDate: string;
  hourlyRateSnapshot: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalAmount: number;
  shiftCount: number;
  notes: string | null;
  shifts: (ShiftInput & { id: number; workedMinutes: number; workedHours: number; sortOrder: number })[];
  createdAt: string;
  updatedAt: string;
};
export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
};
export type WeekView = {
  from: string;
  to: string;
  employees: {
    employeeId: number;
    employeeName: string;
    hourlyRate: number;
    active: boolean;
    days: { date: string; workDayId: number; shiftCount: number; totalWorkedMinutes: number; totalWorkedHours: number; totalAmount: number }[];
    weekWorkedMinutes: number;
    weekWorkedHours: number;
    weekAmount: number;
  }[];
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalAmount: number;
};
export type PeriodSummary = {
  employees: { employeeId: number; employeeName: string; workedMinutes: number; workedHours: number; amount: number }[];
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalAmount: number;
};
export type DaySummary = PeriodSummary & { date: string; employeesWorked: number };
export type WeekSummary = PeriodSummary & { from: string; to: string };
export type MonthSummary = PeriodSummary & { year: number; month: number };
export type Dashboard = {
  activeEmployees: number;
  today: { workedMinutes: number; workedHours: number; amount: number; employeesWorked: number };
  week: { workedMinutes: number; workedHours: number; amount: number; employeesWorked: number };
  month: { workedMinutes: number; workedHours: number; amount: number; employeesWorked: number };
};
export type EmployeeHistory = {
  employee: { id: number; name: string };
  from: string | null;
  to: string | null;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalAmount: number;
  workDays: Page<Workday>;
};
export type HistoryFilters = {
  employeeId?: number;
  date?: string;
  from?: string;
  to?: string;
  period?: WorkPeriod;
  page?: number;
  size?: number;
  sort?: string;
};

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : "";
}

async function request<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await apiFetch(`${base}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) throw await crearApiError(response, fallback);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

function json(method: string, payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export const listEmployees = (status: EmployeeStatus = "ACTIVE") =>
  request<Employee[]>(`/employees${query({ status })}`, "No se pudieron cargar los empleados.");
export const searchActiveEmployees = (name: string) =>
  request<Employee[]>(`/employees/search${query({ q: name })}`, "No se pudo buscar empleados.");
export const getEmployee = (id: number) =>
  request<Employee>(`/employees/${id}`, "No se pudo cargar el empleado.");
export const createEmployee = (payload: EmployeePayload) =>
  request<Employee>("/employees", "No se pudo crear el empleado.", json("POST", payload));
export const updateEmployee = (id: number, payload: EmployeePayload) =>
  request<Employee>(`/employees/${id}`, "No se pudo actualizar el empleado.", json("PUT", payload));
export const setEmployeeActive = (id: number, active: boolean) =>
  request<Employee>(`/employees/${id}/${active ? "activate" : "deactivate"}`, "No se pudo cambiar el estado.", { method: "PATCH" });

export const createWorkday = (employeeId: number, payload: WorkdayInput) =>
  request<Workday>("/employee-workdays", "No se pudo crear la jornada.", json("POST", { employeeId, ...payload }));
export const createBulkWorkdays = (employeeIds: number[], payload: WorkdayInput) =>
  request<Workday[]>("/employee-workdays/bulk", "No se pudieron crear las jornadas.", json("POST", { employeeIds, ...payload }));
export const getWorkday = (id: number) =>
  request<Workday>(`/employee-workdays/${id}`, "No se pudo cargar la jornada.");
export const updateWorkday = (id: number, payload: WorkdayInput) =>
  request<Workday>(`/employee-workdays/${id}`, "No se pudo actualizar la jornada.", json("PUT", payload));
export const copyWorkday = (id: number, targetDate: string) =>
  request<Workday>(`/employee-workdays/${id}/copy`, "No se pudo copiar la jornada.", json("POST", { targetDate }));
export const deleteWorkday = (id: number) =>
  request<void>(`/employee-workdays/${id}`, "No se pudo eliminar la jornada.", { method: "DELETE" });
export const getWorkdayHistory = (filters: HistoryFilters) =>
  request<Page<Workday>>(`/employee-workdays/history${query(filters)}`, "No se pudo cargar el historial.");
export const getEmployeeHistory = (id: number, filters: Pick<HistoryFilters, "from" | "to" | "page" | "size" | "sort">) =>
  request<EmployeeHistory>(`/employees/${id}/workdays${query(filters)}`, "No se pudo cargar el historial del empleado.");
export const getWeekView = (date: string) =>
  request<WeekView>(`/employee-workdays/week${query({ date })}`, "No se pudo cargar la planilla semanal.");
export const getDaySummary = (date: string) =>
  request<DaySummary>(`/employee-workdays/summary/day${query({ date })}`, "No se pudo cargar el resumen diario.");
export const getWeekSummary = (date: string) =>
  request<WeekSummary>(`/employee-workdays/summary/week${query({ date })}`, "No se pudo cargar el resumen semanal.");
export const getMonthSummary = (year: number, month: number) =>
  request<MonthSummary>(`/employee-workdays/summary/month${query({ year, month })}`, "No se pudo cargar el resumen mensual.");
export const getEmployeesDashboard = () =>
  request<Dashboard>("/employees/dashboard", "No se pudo cargar el tablero de empleados.");
