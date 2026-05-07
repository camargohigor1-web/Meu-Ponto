"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ============================================================
// TIPOS
// ============================================================
interface Batida { horario: string; editado?: boolean; }
interface RegistroDia {
  batidas: (string | null)[];
  editado: boolean[];
  ausencia: string;
  observacao: string;
  rhDivergencias?: (string | null)[];
}
interface Periodo { id: string; inicio: string; fim: string; fechado: boolean; }
interface Recebimento {
  id: number;
  dataRecebimento: string;
  competencia: string;
  tipo: "adiantamento" | "pagamento";
  salario: string;
  horaExtra: string;
  acrescimos: string;
  acrescimosObs: string;
  adiantamento: string;
  inss: string;
  irrf: string;
  vt: string;
  vr: string;
  outros: string;
  outrosObs: string;
}
interface Notificacao { id: number; label: string; horario: string; antecedencia: number; ativa: boolean; mensagem: string; }
interface Config {
  nome: string; empresa: string; cargo: string; admissao: string; salarioBruto: string;
  escala: { dias: number[]; entrada: string; saidaAlmoco: string; voltaAlmoco: string; saida: string; };
  tolerancia: number; toleranciaTipo: "marcacao" | "dia";
  almocoDuracao: number; fechamentoDia: number; pagamentoDia: number; adiantamentoDia: number;
  adicionalHE: number; darkMode: boolean;
  notificacoes: Notificacao[];
}

// ============================================================
// FERIADOS
// ============================================================
function calcularPascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function getFeriados(ano: number): Record<string, string> {
  const f: Record<string, string> = {};
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const add = (d: Date, nome: string) => { f[fmt(d)] = nome; };
  const pascoa = calcularPascoa(ano);

  // Nacionais fixos
  add(new Date(ano,0,1), "Confraternização Universal");
  add(new Date(ano,3,21), "Tiradentes");
  add(new Date(ano,4,1), "Dia do Trabalho");
  add(new Date(ano,8,7), "Independência do Brasil");
  add(new Date(ano,9,12), "Nossa Sra. Aparecida");
  add(new Date(ano,10,2), "Finados");
  add(new Date(ano,10,15), "Proclamação da República");
  add(new Date(ano,10,20), "Consciência Negra");
  add(new Date(ano,11,25), "Natal");

  // Nacionais móveis
  add(addDias(pascoa,-48), "Carnaval (Seg)");
  add(addDias(pascoa,-47), "Carnaval (Ter)");
  add(addDias(pascoa,-2), "Sexta-feira Santa");
  add(pascoa, "Páscoa");
  add(addDias(pascoa,60), "Corpus Christi");

  // Estaduais SP fixos
  add(new Date(ano,0,25), "Aniversário de São Paulo");
  add(new Date(ano,6,9), "Revolução Constitucionalista");
  add(new Date(ano,10,20), "Consciência Negra SP");

  return f;
}

// ============================================================
// CONSTANTES
// ============================================================
const INSS_2025 = [
  { ate: 1518.0, aliquota: 7.5 },
  { ate: 2793.88, aliquota: 9.0 },
  { ate: 4190.83, aliquota: 12.0 },
  { ate: 8157.41, aliquota: 14.0 },
];
const IRRF_2025 = [
  { ate: 2259.2, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 7.5, deducao: 169.44 },
  { ate: 3751.05, aliquota: 15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 22.5, deducao: 662.77 },
  { ate: Infinity, aliquota: 27.5, deducao: 896.0 },
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const NOMES_BATIDAS = ["Entrada","Saída Almoço","Volta Almoço","Saída"];

const DEFAULT_CONFIG: Config = {
  nome: "", empresa: "", cargo: "", admissao: "", salarioBruto: "",
  escala: { dias: [1,2,3,4,5], entrada: "08:00", saidaAlmoco: "12:00", voltaAlmoco: "13:00", saida: "17:00" },
  tolerancia: 5, toleranciaTipo: "marcacao", almocoDuracao: 60,
  fechamentoDia: 25, pagamentoDia: 5, adiantamentoDia: 20, adicionalHE: 50, darkMode: true,
  notificacoes: [
    { id: 1, label: "Entrada", horario: "07:55", antecedencia: 5, ativa: true, mensagem: "☀️ Hora de registrar sua entrada!" },
    { id: 2, label: "Almoço", horario: "11:55", antecedencia: 5, ativa: true, mensagem: "🍽️ Faltam 5 minutos para o almoço!" },
    { id: 3, label: "Volta Almoço", horario: "12:55", antecedencia: 5, ativa: true, mensagem: "⏰ Faltam 5 minutos para voltar do almoço!" },
    { id: 4, label: "Saída", horario: "16:50", antecedencia: 10, ativa: true, mensagem: "🚶 Faltam 10 minutos para ir embora!" },
  ],
};

// ============================================================
// UTILITÁRIOS
// ============================================================
function calcINSS(b: number): number {
  let r = 0, base = b, ant = 0;
  for (const f of INSS_2025) {
    if (base <= 0) break;
    const fv = Math.min(base, f.ate - ant);
    r += fv * (f.aliquota / 100);
    base -= fv; ant = f.ate;
    if (b <= f.ate) break;
  }
  return Math.min(r, 8157.41 * 0.14);
}
function calcIRRF(b: number, inss: number): number {
  const base = b - inss;
  for (const f of IRRF_2025) {
    if (base <= f.ate) return Math.max(0, base * (f.aliquota / 100) - f.deducao);
  }
  return 0;
}
function parseHHMM(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minToHHMM(min: number): string {
  const neg = min < 0, abs = Math.abs(min);
  return `${neg ? "-" : "+"}${String(Math.floor(abs/60)).padStart(2,"0")}:${String(abs%60).padStart(2,"0")}`;
}
function hojeStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatarData(s: string): string {
  if (!s) return "";
  const [y,m,d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function calcSaldo(batidas: (string|null)[], escala: Config["escala"]): number | null {
  const [e,sa,va,s] = batidas;
  if (!e||!sa||!va||!s) return null;
  const trab = (parseHHMM(s)-parseHHMM(va))+(parseHHMM(sa)-parseHHMM(e));
  const prev = (parseHHMM(escala.saida)-parseHHMM(escala.voltaAlmoco))+(parseHHMM(escala.saidaAlmoco)-parseHHMM(escala.entrada));
  return trab - prev;
}
function strParaData(s: string): Date {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function dataParaStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDiasStr(s: string, n: number): string {
  const d = strParaData(s); d.setDate(d.getDate()+n); return dataParaStr(d);
}

function useLocalStorage<T>(key: string, init: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

// ============================================================
// ÍCONES
// ============================================================
function Ic({ n, size=20, cls="" }: { n: string; size?: number; cls?: string }) {
  const p: Record<string,React.ReactNode> = {
    home: <><path d="m3 9 9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    dollar: <><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevLeft: <><polyline points="15 18 9 12 15 6"/></>,
    chevRight: <><polyline points="9 18 15 12 9 6"/></>,
    chevDown: <><polyline points="6 9 12 15 18 9"/></>,
    chevUp: <><polyline points="18 15 12 9 6 15"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    beach: <><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><path d="m4.2 10.6 2.6-5.4"/><path d="m19.8 10.6-2.6-5.4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    msg: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      {p[n]}
    </svg>
  );
}

// ============================================================
// COMPONENTES BASE
// ============================================================
function Card({ children, cls="", onClick }: { children: React.ReactNode; cls?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`rounded-2xl border backdrop-blur-sm transition-all duration-200 ${cls}`}>{children}</div>;
}
function Btn({ children, onClick, v="primary", cls="", disabled=false, sz="md" }: {
  children: React.ReactNode; onClick?: () => void; v?: string; cls?: string; disabled?: boolean; sz?: string;
}) {
  const sizes: Record<string,string> = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2.5 text-sm", lg:"px-6 py-3 text-base" };
  const vars: Record<string,string> = {
    primary:"bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95",
    secondary:"bg-slate-700 hover:bg-slate-600 text-white active:scale-95",
    ghost:"text-slate-300 hover:text-white hover:bg-slate-700/50 active:scale-95",
    danger:"bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 active:scale-95",
    success:"bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95",
    warning:"bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 border border-yellow-500/30 active:scale-95",
  };
  return (
    <button disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-40 ${sizes[sz]} ${vars[v]} ${cls}`}>
      {children}
    </button>
  );
}
function Inp({ label, value, onChange, type="text", placeholder="", hint="" }: {
  label?: string; value: string|number; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"/>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}
function Sel({ label, value, onChange, opts }: {
  label?: string; value: string|number; onChange: (v: string) => void; opts: {value: string|number; label: string}[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
        {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      {label && <span className="text-sm text-slate-300">{label}</span>}
      <div onClick={()=>onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value?"bg-blue-600":"bg-slate-700"}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value?"translate-x-6":"translate-x-1"}`}/>
      </div>
    </label>
  );
}
function Badge({ children, color="blue" }: { children: React.ReactNode; color?: string }) {
  const c: Record<string,string> = {
    blue:"bg-blue-500/20 text-blue-300 border-blue-500/30",
    green:"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    red:"bg-red-500/20 text-red-300 border-red-500/30",
    yellow:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    gray:"bg-slate-500/20 text-slate-300 border-slate-500/30",
    orange:"bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${c[color]}`}>{children}</span>;
}

// ============================================================
// TELA: PONTO
// ============================================================
function TelaPonto({ config, registros, setRegistros, periodos, dark }: {
  config: Config; registros: Record<string,RegistroDia>; setRegistros: React.Dispatch<React.SetStateAction<Record<string,RegistroDia>>>;
  periodos: Periodo[]; dark: boolean;
}) {
  const [diaAtual, setDiaAtual] = useState(hojeStr);
  const [hora, setHora] = useState<Date|null>(null);
  const [pulso, setPulso] = useState(false);
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [editVal, setEditVal] = useState("");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [showObs, setShowObs] = useState(false);

  useEffect(() => {
    setHora(new Date());
    const t = setInterval(()=>setHora(new Date()),1000);
    return ()=>clearInterval(t);
  }, []);

  const hoje = hojeStr();
  const ehHoje = diaAtual === hoje;
  const reg = registros[diaAtual] || { batidas:[null,null,null,null], editado:[false,false,false,false], ausencia:"", observacao:"" };
  const padroes = [config.escala.entrada, config.escala.saidaAlmoco, config.escala.voltaAlmoco, config.escala.saida];
  const proxIdx = reg.batidas.findIndex(b=>!b);
  const saldo = calcSaldo(reg.batidas, config.escala);
  const podeBater = ehHoje && (modoEdicao || ehHoje);
  const podeEditar = modoEdicao || ehHoje;

  // Período do dia
  const periodoAtivo = periodos.find(p => !p.fechado) || null;
  const diaEmPeriodoFechado = periodos.find(p => p.fechado && diaAtual >= p.inicio && diaAtual <= p.fim);

  function salvar(novo: RegistroDia) { setRegistros(prev=>({...prev,[diaAtual]:novo})); }

  function bater() {
    if (!hora || proxIdx < 0) return;
    const h = String(hora.getHours()).padStart(2,"0");
    const m = String(hora.getMinutes()).padStart(2,"0");
    const novas = [...reg.batidas]; novas[proxIdx] = `${h}:${m}`;
    salvar({...reg, batidas: novas});
    setPulso(true); setTimeout(()=>setPulso(false),600);
  }

  function excluir(i: number) {
    const novas = [...reg.batidas]; novas[i] = null;
    const edit = [...reg.editado]; edit[i] = false;
    salvar({...reg, batidas: novas, editado: edit});
  }

  function salvarEdicao() {
    if (editIdx===null) return;
    const novas = [...reg.batidas]; novas[editIdx] = editVal;
    const edit = [...reg.editado]; edit[editIdx] = true;
    salvar({...reg, batidas: novas, editado: edit});
    setEditIdx(null);
  }

  function navDia(n: number) {
    const d = strParaData(diaAtual); d.setDate(d.getDate()+n);
    setDiaAtual(dataParaStr(d));
    setModoEdicao(false);
  }

  const countdown = (() => {
    if (!hora || reg.batidas[3] || !reg.batidas[2]) return null;
    return parseHHMM(config.escala.saida) - (hora.getHours()*60+hora.getMinutes());
  })();

  const diaLabel = (() => {
    if (ehHoje) return "Hoje";
    const d = strParaData(diaAtual);
    const diff = Math.round((strParaData(hoje).getTime()-d.getTime())/(1000*60*60*24));
    if (diff===1) return "Ontem";
    if (diff===-1) return "Amanhã";
    return DIAS_SEMANA[d.getDay()];
  })();

  return (
    <div className="space-y-4 pb-6">
      {/* Navegação de dias */}
      <div className="flex items-center justify-between">
        <button onClick={()=>navDia(-1)} className="p-2 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all">
          <Ic n="chevLeft" size={20}/>
        </button>
        <div className="text-center">
          <p className={`text-lg font-bold ${dark?"text-white":"text-slate-800"}`}>{diaLabel}</p>
          <p className="text-xs text-slate-400">{formatarData(diaAtual)} · {DIAS_SEMANA[strParaData(diaAtual).getDay()]}</p>
          {!ehHoje && (
            <button onClick={()=>{setDiaAtual(hojeStr());setModoEdicao(false);}}
              className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 transition-colors">
              ↩ Voltar para hoje
            </button>
          )}
        </div>
        <button onClick={()=>navDia(1)} disabled={ehHoje} className="p-2 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all disabled:opacity-30">
          <Ic n="chevRight" size={20}/>
        </button>
      </div>

      {/* Badge de período */}
      {diaEmPeriodoFechado && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/30 border border-slate-600/30">
          <Ic n="lock" size={14} cls="text-slate-400"/>
          <span className="text-xs text-slate-400">Período fechado · {formatarData(diaEmPeriodoFechado.inicio)} a {formatarData(diaEmPeriodoFechado.fim)}</span>
          {!modoEdicao && (
            <button onClick={()=>setModoEdicao(true)} className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Ic n="edit" size={12}/> Editar
            </button>
          )}
        </div>
      )}

      {/* Botão principal de bater ponto */}
      {ehHoje && (
        <Card cls={`p-6 text-center border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
          {proxIdx >= 0 ? (
            <>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-widest">Próximo registro</p>
              <p className={`text-lg font-bold mb-5 ${dark?"text-white":"text-slate-800"}`}>{NOMES_BATIDAS[proxIdx]}</p>
              <button onClick={bater}
                className={`relative w-32 h-32 rounded-full mx-auto flex items-center justify-center text-white font-bold shadow-2xl transition-all duration-200 active:scale-90
                  ${pulso?"scale-110 shadow-blue-500/60":"hover:scale-105"} bg-gradient-to-br from-blue-500 to-blue-700`}>
                <div className={`absolute inset-0 rounded-full bg-blue-400/20 ${pulso?"animate-ping":""}`}/>
                <span className="relative z-10 flex flex-col items-center gap-1">
                  <Ic n="clock" size={26}/>
                  <span className="text-sm">Bater</span>
                </span>
              </button>
              <p className="text-xs text-slate-500 mt-4 font-mono">
                {hora ? `${String(hora.getHours()).padStart(2,"0")}:${String(hora.getMinutes()).padStart(2,"0")}:${String(hora.getSeconds()).padStart(2,"0")}` : "--:--:--"}
              </p>
            </>
          ) : (
            <div className="py-4 space-y-1">
              <div className="text-4xl mb-3">🌙</div>
              <p className={`text-lg font-bold ${dark?"text-white":"text-slate-800"}`}>Bom descanso!</p><p className="text-sm text-slate-400">Todas as batidas registradas. Até amanhã! 👋</p>
            </div>
          )}
        </Card>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <Card cls={`p-3 border-blue-500/20 ${dark?"bg-blue-900/20":"bg-blue-50"}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-300">⏱ Faltam para saída</span>
            <span className={`font-mono font-bold ${countdown>0?"text-blue-400":"text-emerald-400"}`}>
              {countdown>0 ? minToHHMM(countdown).replace("+","") : "Pode sair!"}
            </span>
          </div>
        </Card>
      )}

      {/* Registros do dia */}
      <Card cls={`border-slate-700/50 overflow-hidden ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
        <div className={`px-4 py-3 border-b flex justify-between items-center ${dark?"border-slate-700/50":"border-slate-200"}`}>
          <h3 className={`font-semibold text-sm ${dark?"text-white":"text-slate-800"}`}>Marcações</h3>
          {saldo !== null && (
            <span className={`font-mono font-bold text-sm ${saldo>=0?"text-emerald-400":"text-red-400"}`}>{minToHHMM(saldo)}</span>
          )}
        </div>
        {NOMES_BATIDAS.map((nome,i) => {
          const batida = reg.batidas[i];
          const padrao = padroes[i];
          const diff = batida ? parseHHMM(batida)-parseHHMM(padrao) : null;
          return (
            <div key={i} className={`flex items-center px-4 py-3 ${dark?"border-b border-slate-700/30 last:border-0":"border-b border-slate-100 last:border-0"}`}>
              <div className="flex-1">
                <p className={`text-sm font-medium ${dark?"text-white":"text-slate-700"}`}>{nome}</p>
                {reg.editado[i] && <span className="text-xs text-yellow-400">✏ editado</span>}
              </div>
              <div className="flex items-center gap-3">
                {batida ? (
                  <>
                    <div className="text-right">
                      <p className={`font-mono font-bold text-sm ${dark?"text-blue-300":"text-blue-600"}`}>{batida}</p>
                      {diff!==null && <p className={`text-xs ${diff<0?"text-red-400":diff>0?"text-emerald-400":"text-slate-400"}`}>
                        {diff===0?"no horário":`${diff>0?"+":""}${diff}min`}
                      </p>}
                    </div>
                    {podeEditar && <>
                      <button onClick={()=>{setEditIdx(i);setEditVal(batida);}} className="text-slate-500 hover:text-blue-400 transition-colors p-1">
                        <Ic n="edit" size={13}/>
                      </button>
                      <button onClick={()=>excluir(i)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                        <Ic n="trash" size={13}/>
                      </button>
                    </>}
                  </>
                ) : (
                  <span className={`font-mono text-sm ${dark?"text-slate-600":"text-slate-400"}`}>{padrao}</span>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Ausência */}
      <Sel label="Ausência / Ocorrência" value={reg.ausencia||""}
        onChange={v=>salvar({...reg,ausencia:v})}
        opts={[
          {value:"",label:"Nenhuma"},
          {value:"falta",label:"❌ Falta injustificada"},
          {value:"atestado",label:"🟡 Atestado médico"},
          {value:"feriado",label:"🔵 Feriado"},
          {value:"ferias",label:"🏖️ Férias"},
          {value:"folga",label:"🔄 Folga compensada"},
        ]}
      />

      {/* Observação */}
      <div>
        <button onClick={()=>setShowObs(!showObs)}
          className={`flex items-center gap-2 text-sm font-medium mb-2 ${dark?"text-slate-300":"text-slate-600"}`}>
          <Ic n={showObs?"chevUp":"chevDown"} size={14}/>
          {reg.observacao ? "Observação (preenchida)" : "Adicionar observação"}
        </button>
        {showObs && (
          <textarea value={reg.observacao||""} onChange={e=>salvar({...reg,observacao:e.target.value})}
            placeholder="Anotações sobre o dia (opcional)..."
            rows={3}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition-all"/>
        )}
      </div>

      {/* Modal edição */}
      {editIdx!==null && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-xs rounded-2xl p-6 space-y-4 ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <h3 className={`font-bold ${dark?"text-white":"text-slate-800"}`}>Editar {NOMES_BATIDAS[editIdx]}</h3>
            <Inp label="Horário" type="time" value={editVal} onChange={setEditVal}/>
            <div className="flex gap-3">
              <Btn onClick={salvarEdicao} cls="flex-1">Salvar</Btn>
              <Btn v="secondary" onClick={()=>setEditIdx(null)} cls="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: INÍCIO / DASHBOARD
// ============================================================
function TelaInicio({ config, registros, dark }: {
  config: Config; registros: Record<string,RegistroDia>; dark: boolean;
}) {
  const [hora, setHora] = useState<Date|null>(null);
  const [calAno, setCalAno] = useState(()=>new Date().getFullYear());
  const [calMes, setCalMes] = useState(()=>new Date().getMonth());
  const [diaSel, setDiaSel] = useState<string|null>(null);

  useEffect(()=>{
    setHora(new Date());
    const t=setInterval(()=>setHora(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  const feriados = getFeriados(calAno);
  const hoje = hojeStr();
  const bruto = Number(config.salarioBruto)||0;
  const inss = calcINSS(bruto);
  const irrf = calcIRRF(bruto,inss);
  const liquido = bruto - inss - irrf;

  // Horas trabalhadas hoje para calcular por hora
  const hoje_d = new Date();
  const diasSemana = Array.from({length:7},(_,i)=>{
    const d=new Date(hoje_d); d.setDate(hoje_d.getDate()-hoje_d.getDay()+i);
    return dataParaStr(d);
  });
  const saldoSemana = diasSemana.reduce((acc,dia)=>{
    const r=registros[dia]; if(!r) return acc;
    return acc+(calcSaldo(r.batidas,config.escala)||0);
  },0);

  // Horas trabalhadas no mês
  const anoAtual=hoje_d.getFullYear(), mesAtual=hoje_d.getMonth();
  const diasMesAtual=new Date(anoAtual,mesAtual+1,0).getDate();
  let minMes=0, diasTrabMes=0;
  for(let d=1;d<=diasMesAtual;d++){
    const str=`${anoAtual}-${String(mesAtual+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const r=registros[str]; if(!r) continue;
    const s=calcSaldo(r.batidas,config.escala);
    if(s!==null){minMes+=s; diasTrabMes++;}
  }
  const previsto=(parseHHMM(config.escala.saida)-parseHHMM(config.escala.voltaAlmoco))+(parseHHMM(config.escala.saidaAlmoco)-parseHHMM(config.escala.entrada));
  const totalMinMes=diasTrabMes*previsto+minMes;
  const liquidoPorHora=totalMinMes>0?liquido/(totalMinMes/60):0;

  // Calendário
  const primeiroDia=new Date(calAno,calMes,1).getDay();
  const totalDias=new Date(calAno,calMes+1,0).getDate();
  const celulas=Array.from({length:primeiroDia+totalDias},(_,i)=>i<primeiroDia?null:i-primeiroDia+1);

  function statusDia(d:number):{emoji:string;cor:string}|null{
    const str=`${calAno}-${String(calMes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const fer=feriados[str];
    if(fer) return {emoji:"🔵",cor:"text-blue-400"};
    const r=registros[str]; if(!r) return null;
    if(r.ausencia==="atestado") return {emoji:"🟡",cor:"text-yellow-400"};
    if(r.ausencia==="ferias") return {emoji:"🏖️",cor:""};
    if(r.ausencia==="falta") return {emoji:"❌",cor:"text-red-400"};
    if(r.ausencia==="feriado") return {emoji:"🔵",cor:"text-blue-400"};
    if(calcSaldo(r.batidas,config.escala)!==null) return {emoji:"✅",cor:"text-emerald-400"};
    return null;
  }

  const h=hora?.getHours()??12;
  const saudacao=h<12?"Bom dia ☀️":h<18?"Boa tarde 🌤️":"Boa noite 🌙";

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <Card cls={`p-5 border-blue-500/20 ${dark?"bg-gradient-to-br from-blue-900/40 to-slate-900/60":"bg-gradient-to-br from-blue-50 to-white"}`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-blue-400 font-medium uppercase tracking-widest mb-1">{saudacao}</p>
            <h2 className={`text-xl font-bold ${dark?"text-white":"text-slate-800"}`}>{config.nome||"Bem-vindo ao MeuPonto"}</h2>
            {config.empresa && <p className="text-sm text-slate-400 mt-0.5">{config.empresa} · {config.cargo}</p>}
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold font-mono tabular-nums ${dark?"text-white":"text-slate-800"}`}>
              {hora?`${String(hora.getHours()).padStart(2,"0")}:${String(hora.getMinutes()).padStart(2,"0")}`:"--:--"}
            </div>
            <div className="text-xs text-slate-400">{hora?`${String(hora.getSeconds()).padStart(2,"0")}s`:"--"}</div>
          </div>
        </div>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {label:"Saldo Semana", value:minToHHMM(saldoSemana), color:saldoSemana>=0?"text-emerald-400":"text-red-400", icon:"trending"},
          {label:"Salário Líquido", value:bruto?`R$ ${liquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"—", color:dark?"text-white":"text-slate-800", icon:"dollar"},
          {label:"Líquido / Hora", value:liquidoPorHora>0?`R$ ${liquidoPorHora.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"—", color:"text-blue-400", icon:"clock"},
          {label:"Saldo Mês", value:minToHHMM(minMes), color:minMes>=0?"text-emerald-400":"text-red-400", icon:"file"},
        ].map((c,i)=>(
          <Card key={i} cls={`p-4 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Ic n={c.icon} size={14} cls="text-slate-400"/>
              <span className="text-xs text-slate-400">{c.label}</span>
            </div>
            <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Calendário */}
      <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>{if(calMes===0){setCalMes(11);setCalAno(calAno-1);}else setCalMes(calMes-1);}}
            className="p-1.5 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all">
            <Ic n="chevLeft" size={16}/>
          </button>
          <h3 className={`font-semibold ${dark?"text-white":"text-slate-800"}`}>{MESES[calMes]} {calAno}</h3>
          <button onClick={()=>{if(calMes===11){setCalMes(0);setCalAno(calAno+1);}else setCalMes(calMes+1);}}
            className="p-1.5 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all">
            <Ic n="chevRight" size={16}/>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {DIAS_SEMANA.map(d=><div key={d} className="text-xs text-slate-500 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {celulas.map((d,i)=>{
            if(!d) return <div key={i}/>;
            const str=`${calAno}-${String(calMes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const st=statusDia(d);
            const isHoje=str===hoje;
            const fer=feriados[str];
            return (
              <button key={i} onClick={()=>setDiaSel(str)}
                className={`relative h-9 flex items-center justify-center rounded-lg text-xs font-medium transition-all hover:ring-2 hover:ring-blue-500/50
                  ${isHoje?"bg-blue-600 text-white ring-2 ring-blue-400":dark?"text-slate-300 hover:bg-slate-700/50":"text-slate-600 hover:bg-slate-100"}
                  ${fer&&!isHoje?"text-blue-400":""}`}>
                {st?<span className="text-sm leading-none">{st.emoji}</span>:d}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
          <span>✅ OK</span><span>❌ Falta</span><span>🟡 Atestado</span><span>🔵 Feriado</span><span>🏖️ Férias</span>
        </div>
      </Card>

      {/* Modal dia selecionado */}
      {diaSel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`font-bold ${dark?"text-white":"text-slate-800"}`}>{formatarData(diaSel)}</h3>
                <p className="text-xs text-slate-400">{DIAS_SEMANA[strParaData(diaSel).getDay()]} {feriados[diaSel]?`· 🔵 ${feriados[diaSel]}`:""}</p>
              </div>
              <button onClick={()=>setDiaSel(null)} className="p-2 rounded-xl hover:bg-slate-700/50 text-slate-400">
                <Ic n="x" size={18}/>
              </button>
            </div>
            {(() => {
              const r=registros[diaSel];
              if(!r) return <p className="text-slate-400 text-sm text-center py-4">Sem registros para este dia.</p>;
              const s=calcSaldo(r.batidas,config.escala);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {NOMES_BATIDAS.map((nome,i)=>(
                      <div key={i} className={`p-3 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-100"}`}>
                        <p className="text-xs text-slate-400 mb-1">{nome}</p>
                        <p className={`font-mono font-bold text-sm ${r.batidas[i]?(dark?"text-blue-300":"text-blue-600"):"text-slate-500"}`}>
                          {r.batidas[i]||"--:--"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {s!==null && (
                    <div className={`flex justify-between p-3 rounded-xl ${s>=0?"bg-emerald-500/10 border border-emerald-500/20":"bg-red-500/10 border border-red-500/20"}`}>
                      <span className="text-sm text-slate-300">Saldo</span>
                      <span className={`font-mono font-bold ${s>=0?"text-emerald-400":"text-red-400"}`}>{minToHHMM(s)}</span>
                    </div>
                  )}
                  {r.ausencia && <Badge color={r.ausencia==="falta"?"red":r.ausencia==="atestado"?"yellow":"blue"}>{r.ausencia}</Badge>}
                  {r.observacao && (
                    <div className={`p-3 rounded-xl ${dark?"bg-slate-700/30":"bg-slate-100"}`}>
                      <p className="text-xs text-slate-400 mb-1">Observação</p>
                      <p className="text-sm text-slate-300">{r.observacao}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: FINANCEIRO
// ============================================================
function calcLiquidoRec(r: Recebimento): number {
  const bruto = Number(r.salario)||0;
  const horaExtra = Number(r.horaExtra)||0;
  const acrescimos = Number(r.acrescimos)||0;
  const inss = Number(r.inss)||0;
  const irrf = Number(r.irrf)||0;
  const vt = Number(r.vt)||0;
  const vr = Number(r.vr)||0;
  const outros = Number(r.outros)||0;
  const adiant = Number(r.adiantamento)||0;
  return bruto + horaExtra + acrescimos - inss - irrf - vt - vr - outros - adiant;
}

function calcTotalMes(recs: Recebimento[], competencia: string): number {
  const doMes = recs.filter(r => r.competencia === competencia);
  return doMes.reduce((acc, r) => acc + calcLiquidoRec(r), 0);
}

const FORM_VAZIO: Omit<Recebimento,"id"> = {
  dataRecebimento: "", competencia: "", tipo: "adiantamento",
  salario: "", horaExtra: "", acrescimos: "", acrescimosObs: "",
  adiantamento: "", inss: "", irrf: "", vt: "", vr: "",
  outros: "", outrosObs: ""
};

function TelaFinanceiro({ config, registros, financeiro, setFinanceiro, dark }: {
  config: Config; registros: Record<string,RegistroDia>;
  financeiro: {recebimentos: Recebimento[]};
  setFinanceiro: React.Dispatch<React.SetStateAction<{recebimentos: Recebimento[]}>>;
  dark: boolean;
}) {
  const [aba, setAba] = useState("resumo");
  const [form, setForm] = useState<Omit<Recebimento,"id">>(FORM_VAZIO);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [viewRec, setViewRec] = useState<Recebimento|null>(null);
  const [adiantHint, setAdiantHint] = useState(""); // valor esmaecido sugerido

  const bruto=Number(config.salarioBruto)||0;
  const inss=calcINSS(bruto), irrf=calcIRRF(bruto,inss), liquido=bruto-inss-irrf;
  const rec=financeiro.recebimentos||[];

  // Detectar último adiantamento para sugerir no campo
  function getUltimoAdiantamento(competencia: string): string {
    const adi = rec.filter(r => r.competencia === competencia && r.tipo === "adiantamento");
    if (adi.length === 0) return "";
    return adi[adi.length-1].salario || "";
  }

  function abrirNovoForm(tipo: "adiantamento"|"pagamento") {
    const hoje = hojeStr();
    const comp = hoje.slice(0,7); // "YYYY-MM"
    const hint = tipo === "pagamento" ? getUltimoAdiantamento(comp) : "";
    setAdiantHint(hint);
    setForm({...FORM_VAZIO, tipo, dataRecebimento: hoje, competencia: comp});
    setEditId(null);
    setShowForm(true);
  }

  function abrirEditar(r: Recebimento) {
    setForm({
      dataRecebimento: r.dataRecebimento, competencia: r.competencia, tipo: r.tipo,
      salario: r.salario, horaExtra: r.horaExtra||"",
      acrescimos: r.acrescimos||"", acrescimosObs: r.acrescimosObs||"",
      adiantamento: r.adiantamento,
      inss: r.inss, irrf: r.irrf, vt: r.vt, vr: r.vr,
      outros: r.outros, outrosObs: r.outrosObs||""
    });
    setAdiantHint("");
    setEditId(r.id);
    setViewRec(null);
    setShowForm(true);
  }

  function salvar() {
    if (editId !== null) {
      setFinanceiro(p=>({...p, recebimentos: p.recebimentos.map(r=>r.id===editId?{...form,id:editId}:r)}));
    } else {
      setFinanceiro(p=>({...p, recebimentos:[...p.recebimentos,{...form,id:Date.now()}]}));
    }
    setShowForm(false);
    setForm(FORM_VAZIO);
    setEditId(null);
  }

  function excluir(id: number) {
    if(!window.confirm("Excluir este registro?")) return;
    setFinanceiro(p=>({...p, recebimentos: p.recebimentos.filter(r=>r.id!==id)}));
    setViewRec(null);
  }

  // Agrupar por competência para exibição
  const porCompetencia: Record<string, Recebimento[]> = {};
  rec.forEach(r => {
    if (!porCompetencia[r.competencia]) porCompetencia[r.competencia] = [];
    porCompetencia[r.competencia].push(r);
  });

  // Dados para gráficos - líquido total por competência
  const competencias = Object.keys(porCompetencia).sort().slice(-12);
  const dadosLinha = competencias.map(c => {
    const [ano, mes] = c.split("-");
    return {
      mes: MESES_CURTOS[parseInt(mes)-1]+"/"+ano.slice(2),
      liquido: calcTotalMes(rec, c),
    };
  });

  const mediaLiquida = competencias.length
    ? competencias.reduce((a,c)=>a+calcTotalMes(rec,c),0)/competencias.length
    : liquido;

  const dadosPizza=[
    {name:"INSS",value:Math.round(inss)},
    {name:"IRRF",value:Math.round(irrf)},
    {name:"Líquido",value:Math.round(liquido)},
  ];
  const CORES=["#ef4444","#f59e0b","#10b981"];

  const hoje_d=new Date();
  const dadosBH=Array.from({length:6},(_,i)=>{
    const d=new Date(hoje_d.getFullYear(),hoje_d.getMonth()-5+i,1);
    const ano=d.getFullYear(), mes=d.getMonth();
    const total=new Date(ano,mes+1,0).getDate();
    let saldo=0;
    for(let dd=1;dd<=total;dd++){
      const str=`${ano}-${String(mes+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
      const r=registros[str]; if(!r) continue;
      saldo+=calcSaldo(r.batidas,config.escala)||0;
    }
    return {mes:MESES_CURTOS[mes], saldo:parseFloat((saldo/60).toFixed(1))};
  });

  const abas=["resumo","gráficos","tabelas","histórico"];
  const fmtComp = (c: string) => { const [a,m]=c.split("-"); return `${MESES_CURTOS[parseInt(m)-1]}/${a}`; };

  return (
    <div className="space-y-4 pb-6">
      <div className={`flex gap-1 p-1 rounded-xl ${dark?"bg-slate-800/50":"bg-slate-100"}`}>
        {abas.map(a=>(
          <button key={a} onClick={()=>setAba(a)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-all duration-200
              ${aba===a?"bg-blue-600 text-white shadow":dark?"text-slate-400 hover:text-white":"text-slate-500 hover:text-slate-800"}`}>
            {a==="gráficos"?"Gráficos":a.charAt(0).toUpperCase()+a.slice(1)}
          </button>
        ))}
      </div>

      {aba==="resumo" && (
        <div className="space-y-4">
          <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Simulação Salarial</h3>
            {[
              {label:"Salário Bruto",value:bruto,neg:false,color:"text-white"},
              {label:`INSS`,value:inss,neg:true,color:"text-red-400"},
              {label:`IRRF`,value:irrf,neg:true,color:"text-red-400"},
            ].map((item,i)=>(
              <div key={i} className={`flex justify-between py-2 ${i<2?(dark?"border-b border-slate-700/50":"border-b border-slate-200"):""}`}>
                <span className="text-sm text-slate-400">{item.label}</span>
                <span className={`font-mono font-bold ${item.color}`}>{item.neg?"-":""}R$ {item.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 px-3 mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="font-semibold text-emerald-300">Salário Líquido Estimado</span>
              <span className="font-mono font-bold text-emerald-400 text-lg">R$ {liquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
            </div>
          </Card>
          {competencias.length>0 && (
            <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
              <h3 className={`font-semibold mb-2 ${dark?"text-white":"text-slate-800"}`}>Média Real Recebida</h3>
              <p className="text-3xl font-bold text-emerald-400 font-mono">R$ {mediaLiquida.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
              <p className="text-xs text-slate-400 mt-1">Média mensal baseada em {competencias.length} mês(es)</p>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={()=>abrirNovoForm("adiantamento")} cls="w-full" sz="md" v="secondary">
              <Ic n="plus" size={15}/>Adiantamento
            </Btn>
            <Btn onClick={()=>abrirNovoForm("pagamento")} cls="w-full" sz="md">
              <Ic n="plus" size={15}/>Pagamento
            </Btn>
          </div>
        </div>
      )}

      {aba==="gráficos" && (
        <div className="space-y-4">
          {dadosLinha.length>1 && (
            <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
              <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Evolução do Líquido Mensal</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dadosLinha}>
                  <XAxis dataKey="mes" stroke="#64748b" fontSize={10}/>
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`}/>
                  <Tooltip formatter={(v:number)=>`R$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2})}`} contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:12}}/>
                  <Line type="monotone" dataKey="liquido" stroke="#10b981" strokeWidth={2} dot={{fill:"#10b981",r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Composição Salarial Estimada</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={dadosPizza} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value">
                    {dadosPizza.map((_,i)=><Cell key={i} fill={CORES[i]}/>)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>`R$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2})}`} contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:12}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {dadosPizza.map((d,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{background:CORES[i]}}/>
                    <span className="text-xs text-slate-400">{d.name}</span>
                    <span className="text-xs font-mono text-slate-300 ml-auto">R$ {d.value.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Banco de Horas (últimos 6 meses)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dadosBH}>
                <XAxis dataKey="mes" stroke="#64748b" fontSize={10}/>
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={v=>`${v}h`}/>
                <Tooltip formatter={(v:number)=>`${v}h`} contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:12}}/>
                <Bar dataKey="saldo" radius={[4,4,0,0]}>
                  {dadosBH.map((d,i)=><Cell key={i} fill={d.saldo>=0?"#10b981":"#ef4444"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {aba==="tabelas" && (
        <div className="space-y-4">
          <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-3 ${dark?"text-white":"text-slate-800"}`}>Tabela INSS 2025</h3>
            <p className="text-xs text-slate-400 mb-3">Desconto progressivo por faixa de salário.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 border-b border-slate-700">
                <th className="text-left py-2">Faixa</th><th className="text-right py-2">Alíq.</th><th className="text-right py-2">Você</th>
              </tr></thead>
              <tbody>
                {INSS_2025.map((f,i)=>{
                  const ant=i>0?INSS_2025[i-1].ate:0;
                  const nf=bruto>=ant&&bruto<=f.ate;
                  return <tr key={i} className={`border-b border-slate-700/30 ${nf?"bg-blue-500/10":""}`}>
                    <td className={`py-2 text-left text-xs ${nf?"text-blue-300 font-semibold":"text-slate-400"}`}>{nf?"◀ ":""}Até R$ {f.ate.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                    <td className={`py-2 text-right text-xs ${nf?"text-blue-300":"text-slate-400"}`}>{f.aliquota}%</td>
                    <td className={`py-2 text-right font-mono text-xs ${nf?"text-blue-300 font-semibold":"text-slate-500"}`}>{nf?`R$ ${inss.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"—"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </Card>
          <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-3 ${dark?"text-white":"text-slate-800"}`}>Tabela IRRF 2025</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 border-b border-slate-700">
                <th className="text-left py-2">Base</th><th className="text-right py-2">Alíq.</th><th className="text-right py-2">Dedução</th>
              </tr></thead>
              <tbody>
                {IRRF_2025.map((f,i)=>{
                  const base=bruto-inss;
                  const nf=base<=f.ate&&(i===0||base>IRRF_2025[i-1].ate);
                  return <tr key={i} className={`border-b border-slate-700/30 ${nf?"bg-yellow-500/10":""}`}>
                    <td className={`py-2 text-left text-xs ${nf?"text-yellow-300 font-semibold":"text-slate-400"}`}>{nf?"◀ ":""}{f.ate===Infinity?"Acima de R$ 4.664,68":`Até R$ ${f.ate.toLocaleString("pt-BR",{minimumFractionDigits:2})}`}</td>
                    <td className={`py-2 text-right text-xs ${nf?"text-yellow-300":"text-slate-400"}`}>{f.aliquota}%</td>
                    <td className="py-2 text-right font-mono text-xs text-slate-500">{f.deducao>0?`R$ ${f.deducao.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"—"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {aba==="histórico" && (
        <div className="space-y-3">
          {competencias.length===0 ? (
            <div className="text-center py-10 text-slate-400">
              <Ic n="dollar" size={32} cls="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Nenhum recebimento registrado</p>
              <Btn onClick={()=>setAba("resumo")} v="secondary" cls="mt-4" sz="sm">Ir para Resumo</Btn>
            </div>
          ) : competencias.slice().reverse().map(comp=>{
            const recsComp = porCompetencia[comp];
            const totalComp = calcTotalMes(rec, comp);
            const temAdiant = recsComp.some(r=>r.tipo==="adiantamento");
            const temPag = recsComp.some(r=>r.tipo==="pagamento");
            return (
              <Card key={comp} cls={`border-slate-700/50 overflow-hidden ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
                <div className={`px-4 py-3 border-b flex justify-between items-center ${dark?"border-slate-700/50":"border-slate-200"}`}>
                  <div>
                    <p className={`font-semibold ${dark?"text-white":"text-slate-800"}`}>{fmtComp(comp)}</p>
                    <div className="flex gap-2 mt-0.5">
                      {temAdiant && <Badge color="gray">Adiantamento</Badge>}
                      {temPag && <Badge color="blue">Pagamento</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-400">R$ {totalComp.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
                    <p className="text-xs text-slate-500">total líquido</p>
                  </div>
                </div>
                {recsComp.map(r=>{
                  const liq = calcLiquidoRec(r);
                  return (
                    <button key={r.id} onClick={()=>setViewRec(r)}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left
                        ${dark?"border-b border-slate-700/20 last:border-0 hover:bg-slate-700/30":"border-b border-slate-100 last:border-0 hover:bg-slate-50"}`}>
                      <div>
                        <p className={`text-sm font-medium ${dark?"text-slate-300":"text-slate-600"}`}>
                          {r.tipo==="adiantamento"?"💵 Adiantamento":"💰 Pagamento"}
                        </p>
                        <p className="text-xs text-slate-500">{formatarData(r.dataRecebimento)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm font-bold ${liq>=0?"text-emerald-400":"text-red-400"}`}>
                          R$ {liq.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                        </span>
                        <Ic n="chevRight" size={14} cls="text-slate-500"/>
                      </div>
                    </button>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal visualizar registro */}
      {viewRec && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`font-bold text-lg ${dark?"text-white":"text-slate-800"}`}>
                  {viewRec.tipo==="adiantamento"?"💵 Adiantamento":"💰 Pagamento"}
                </h3>
                <p className="text-xs text-slate-400">{formatarData(viewRec.dataRecebimento)} · {fmtComp(viewRec.competencia)}</p>
              </div>
              <button onClick={()=>setViewRec(null)} className="text-slate-400 hover:text-white p-1"><Ic n="x" size={18}/></button>
            </div>
            <div className="space-y-2">
              {[
                {l:"Salário Bruto", v:viewRec.salario, pos:true, obs:""},
                {l:"Hora Extra", v:viewRec.horaExtra||"0", pos:true, obs:""},
                {l:"Outros acréscimos", v:viewRec.acrescimos, pos:true, obs:viewRec.acrescimosObs||""},
                {l:"INSS", v:viewRec.inss, pos:false, obs:""},
                {l:"IRRF", v:viewRec.irrf, pos:false, obs:""},
                {l:"Vale Transporte", v:viewRec.vt, pos:false, obs:""},
                {l:"Vale Refeição", v:viewRec.vr, pos:false, obs:""},
                {l:"Adiantamento descontado", v:viewRec.adiantamento, pos:false, obs:""},
                {l:"Outros descontos", v:viewRec.outros, pos:false, obs:viewRec.outrosObs||""},
              ].filter(i=>Number(i.v)>0).map((item,i)=>(
                <div key={i} className="py-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{item.l}</span>
                    <span className={`font-mono text-sm font-semibold ${item.pos?"text-emerald-400":"text-red-400"}`}>
                      {item.pos?"+ ":"- "}R$ {Number(item.v).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                    </span>
                  </div>
                  {item.obs && <p className="text-xs text-slate-500 italic mt-0.5">"{item.obs}"</p>}
                </div>
              ))}
              <div className={`flex justify-between py-3 px-3 rounded-xl mt-2 ${dark?"bg-slate-700/50":"bg-slate-100"}`}>
                <span className={`font-semibold ${dark?"text-white":"text-slate-800"}`}>Líquido</span>
                <span className="font-mono font-bold text-emerald-400 text-lg">
                  R$ {calcLiquidoRec(viewRec).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Btn onClick={()=>abrirEditar(viewRec)} cls="flex-1" v="secondary" sz="sm">
                <Ic n="edit" size={14}/> Editar
              </Btn>
              <Btn onClick={()=>excluir(viewRec.id)} cls="flex-1" v="danger" sz="sm">
                <Ic n="trash" size={14}/> Excluir
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Modal formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center sm:items-center p-0 sm:p-4 overflow-y-auto">
          <div className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <h3 className={`font-bold text-lg ${dark?"text-white":"text-slate-800"}`}>
              {editId?"Editar":form.tipo==="adiantamento"?"Novo Adiantamento":"Novo Pagamento"}
            </h3>

            {/* Data e competência */}
            <div className="grid grid-cols-2 gap-3">
              <Inp label="Data recebimento" type="date" value={form.dataRecebimento} onChange={v=>setForm(p=>({...p,dataRecebimento:v}))}/>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Mês vigente</label>
                <input type="month" value={form.competencia} onChange={e=>setForm(p=>({...p,competencia:e.target.value}))}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"/>
              </div>
            </div>

            {/* Tipo */}
            <div className="flex gap-2">
              {(["adiantamento","pagamento"] as const).map(t=>(
                <button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all
                    ${form.tipo===t?"bg-blue-600 text-white border-blue-500":"border-slate-600 text-slate-400 hover:border-blue-500"}`}>
                  {t==="adiantamento"?"💵 Adiantamento":"💰 Pagamento"}
                </button>
              ))}
            </div>

            {/* Valores positivos */}
            <div className={`p-3 rounded-xl space-y-3 ${dark?"bg-emerald-900/20 border border-emerald-500/20":"bg-emerald-50"}`}>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">+ Entradas</p>
              <Inp label="Salário / Valor bruto (R$)" type="number" value={form.salario} onChange={v=>setForm(p=>({...p,salario:v}))}/>
              <Inp label="Hora Extra (R$)" type="number" value={form.horaExtra||""} onChange={v=>setForm(p=>({...p,horaExtra:v}))}/>
              <Inp label="Outros acréscimos (R$)" type="number" value={form.acrescimos} onChange={v=>setForm(p=>({...p,acrescimos:v}))}/>
              {(Number(form.acrescimos)>0) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Observação (outros acréscimos)</label>
                  <textarea value={form.acrescimosObs||""} onChange={e=>setForm(p=>({...p,acrescimosObs:e.target.value}))}
                    placeholder="Descreva o acréscimo..." rows={2}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none transition-all"/>
                </div>
              )}
            </div>

            {/* Descontos */}
            <div className={`p-3 rounded-xl space-y-3 ${dark?"bg-red-900/20 border border-red-500/20":"bg-red-50"}`}>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">- Descontos</p>
              <div className="grid grid-cols-2 gap-3">
                <Inp label="INSS (R$)" type="number" value={form.inss} onChange={v=>setForm(p=>({...p,inss:v}))}/>
                <Inp label="IRRF (R$)" type="number" value={form.irrf} onChange={v=>setForm(p=>({...p,irrf:v}))}/>
                <Inp label="Vale Transp. (R$)" type="number" value={form.vt} onChange={v=>setForm(p=>({...p,vt:v}))}/>
                <Inp label="Vale Refei. (R$)" type="number" value={form.vr} onChange={v=>setForm(p=>({...p,vr:v}))}/>
              </div>
              <Inp label="Outros descontos (R$)" type="number" value={form.outros} onChange={v=>setForm(p=>({...p,outros:v}))}/>
              {(Number(form.outros)>0) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Observação (outros descontos)</label>
                  <textarea value={form.outrosObs||""} onChange={e=>setForm(p=>({...p,outrosObs:e.target.value}))}
                    placeholder="Descreva o desconto..." rows={2}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none transition-all"/>
                </div>
              )}
              {form.tipo==="pagamento" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Adiantamento recebido (R$)</label>
                  <input
                    type="number"
                    value={form.adiantamento}
                    placeholder={adiantHint ? adiantHint : "0"}
                    onChange={e=>setForm(p=>({...p,adiantamento:e.target.value}))}
                    className={`bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all
                      ${form.adiantamento?"text-white":"text-slate-500"}`}
                  />
                  {adiantHint && !form.adiantamento && (
                    <span className="text-xs text-slate-500">💡 Último adiantamento registrado: R$ {Number(adiantHint).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
                  )}
                </div>
              )}
            </div>

            {/* Preview líquido */}
            {Number(form.salario)>0 && (
              <div className={`flex justify-between py-3 px-4 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-100"}`}>
                <span className={`font-semibold text-sm ${dark?"text-white":"text-slate-700"}`}>Líquido calculado</span>
                <span className="font-mono font-bold text-emerald-400">
                  R$ {calcLiquidoRec({...form as Recebimento, id:0}).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Btn onClick={salvar} cls="flex-1" v="success">
                <Ic n="check" size={15}/>{editId?"Atualizar":"Salvar"}
              </Btn>
              <Btn v="secondary" onClick={()=>{setShowForm(false);setEditId(null);}} cls="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: RELATÓRIO / HISTÓRICO
// ============================================================
function TelaRelatorio({ config, registros, setRegistros, periodos, setPeriodos, dark }: {
  config: Config; registros: Record<string,RegistroDia>; setRegistros: React.Dispatch<React.SetStateAction<Record<string,RegistroDia>>>;
  periodos: Periodo[]; setPeriodos: React.Dispatch<React.SetStateAction<Periodo[]>>; dark: boolean;
}) {
  const [showFechar, setShowFechar] = useState(false);
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [expandido, setExpandido] = useState<string|null>(null);
  const [rhPeriodoId, setRhPeriodoId] = useState<string|null>(null);
  const [rhDia, setRhDia] = useState<string|null>(null);
  const [rhVals, setRhVals] = useState<(string|null)[]>([null,null,null,null]);

  const periodoAberto = periodos.find(p=>!p.fechado)||null;

  // Dias do período aberto com marcações
  const diasAbertos = periodoAberto ? (() => {
    const dias: string[] = [];
    let d = periodoAberto.inicio;
    while(d <= (periodoAberto.fim||hojeStr())) {
      if(registros[d]) dias.push(d);
      d = addDiasStr(d,1);
      if(d > hojeStr()) break;
    }
    return dias;
  })() : Object.keys(registros).filter(d=>{
    return !periodos.some(p=>p.fechado&&d>=p.inicio&&d<=p.fim);
  }).sort();

  function fecharPeriodo() {
    if(!fInicio||!fFim) return;
    // Verifica dias incompletos
    const incompletos: string[] = [];
    let d = fInicio;
    while(d<=fFim) {
      const r=registros[d];
      if(r && r.batidas.some(b=>b) && r.batidas.some(b=>!b) && !r.ausencia) incompletos.push(d);
      d=addDiasStr(d,1);
    }
    if(incompletos.length>0) {
      const ok=window.confirm(`⚠️ ${incompletos.length} dia(s) com marcações incompletas:\n${incompletos.map(formatarData).join(", ")}\n\nDeseja fechar mesmo assim?`);
      if(!ok) return;
    }
    // Resumo
    let totalMin=0, faltas=0, atestados=0;
    d=fInicio;
    while(d<=fFim){
      const r=registros[d];
      if(r){
        const s=calcSaldo(r.batidas,config.escala);
        if(s!==null) totalMin+=s;
        if(r.ausencia==="falta") faltas++;
        if(r.ausencia==="atestado") atestados++;
      }
      d=addDiasStr(d,1);
    }
    const msg=`📊 Resumo do período ${formatarData(fInicio)} a ${formatarData(fFim)}:\n\nSaldo banco de horas: ${minToHHMM(totalMin)}\nFaltas: ${faltas}\nAtestados: ${atestados}\n\nConfirmar fechamento?`;
    if(!window.confirm(msg)) return;

    const novo: Periodo = {id: Date.now().toString(), inicio:fInicio, fim:fFim, fechado:true};
    setPeriodos(prev=>{
      const sem=prev.filter(p=>!(!p.fechado));
      return [...sem, novo];
    });
    setShowFechar(false);
    setFInicio(""); setFFim("");
  }

  function salvarRH() {
    if(!rhDia) return;
    const r=registros[rhDia]||{batidas:[null,null,null,null],editado:[false,false,false,false],ausencia:"",observacao:""};
    setRegistros(prev=>({...prev,[rhDia]:{...r,rhDivergencias:rhVals}}));
    setRhDia(null); setRhVals([null,null,null,null]);
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-bold ${dark?"text-white":"text-slate-800"}`}>Relatório</h2>
        <Btn onClick={()=>setShowFechar(true)} v="warning" sz="sm"><Ic n="lock" size={14}/>Fechar Período</Btn>
      </div>

      {/* Período Aberto */}
      <Card cls={`border-slate-700/50 overflow-hidden ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
        <button onClick={()=>setExpandido(expandido==="aberto"?null:"aberto")}
          className={`w-full flex items-center justify-between p-4 ${dark?"border-b border-slate-700/50":"border-b border-slate-200"}`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className={`font-semibold ${dark?"text-white":"text-slate-800"}`}>Período Aberto</span>
            <Badge color="green">{diasAbertos.length} dias</Badge>
          </div>
          <Ic n={expandido==="aberto"?"chevUp":"chevDown"} size={16} cls="text-slate-400"/>
        </button>
        {expandido==="aberto" && (
          <div className="divide-y divide-slate-700/30">
            {diasAbertos.length===0 ? (
              <p className="text-slate-400 text-sm text-center py-6">Nenhuma marcação no período aberto.</p>
            ) : diasAbertos.map(dia=>{
              const r=registros[dia];
              const s=calcSaldo(r.batidas,config.escala);
              return (
                <div key={dia} className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-sm font-medium ${dark?"text-white":"text-slate-700"}`}>{formatarData(dia)} · {DIAS_SEMANA[strParaData(dia).getDay()]}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {r.batidas.map((b,i)=>(
                          <span key={i} className={`text-xs font-mono ${b?(dark?"text-blue-300":"text-blue-600"):"text-slate-500"}`}>
                            {NOMES_BATIDAS[i].slice(0,3)}: {b||"--:--"}
                          </span>
                        ))}
                      </div>
                    </div>
                    {s!==null && <span className={`font-mono text-sm font-bold ${s>=0?"text-emerald-400":"text-red-400"}`}>{minToHHMM(s)}</span>}
                  </div>
                  {r.observacao && <p className="text-xs text-slate-400 mt-1 italic">"{r.observacao}"</p>}
                  {r.ausencia && <Badge color={r.ausencia==="falta"?"red":r.ausencia==="atestado"?"yellow":"blue"}>{r.ausencia}</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Períodos Fechados */}
      {periodos.filter(p=>p.fechado).slice().reverse().map(periodo=>{
        const diasPeriodo: string[] = [];
        let d=periodo.inicio;
        while(d<=periodo.fim){
          if(registros[d]) diasPeriodo.push(d);
          d=addDiasStr(d,1);
        }
        const saldoTotal=diasPeriodo.reduce((acc,dia)=>acc+(calcSaldo(registros[dia].batidas,config.escala)||0),0);
        const isExp=expandido===periodo.id;

        return (
          <Card key={periodo.id} cls={`border-slate-700/50 overflow-hidden ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <button onClick={()=>setExpandido(isExp?null:periodo.id)}
              className={`w-full flex items-center justify-between p-4 ${dark?"border-b border-slate-700/50":"border-b border-slate-200"} ${!isExp?"border-b-0":""}`}>
              <div className="flex items-center gap-2">
                <Ic n="lock" size={14} cls="text-slate-500"/>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${dark?"text-white":"text-slate-800"}`}>{formatarData(periodo.inicio)} → {formatarData(periodo.fim)}</p>
                  <p className="text-xs text-slate-400">{diasPeriodo.length} dias · Saldo: <span className={saldoTotal>=0?"text-emerald-400":"text-red-400"}>{minToHHMM(saldoTotal)}</span></p>
                </div>
              </div>
              <Ic n={isExp?"chevUp":"chevDown"} size={16} cls="text-slate-400"/>
            </button>

            {isExp && (
              <div className="p-4 space-y-3">
                {diasPeriodo.map(dia=>{
                  const r=registros[dia];
                  const s=calcSaldo(r.batidas,config.escala);
                  const temRH=r.rhDivergencias?.some(v=>v);
                  return (
                    <div key={dia} className={`p-3 rounded-xl ${dark?"bg-slate-700/30":"bg-slate-100"}`}>
                      <div className="flex justify-between items-start mb-2">
                        <p className={`text-sm font-medium ${dark?"text-white":"text-slate-700"}`}>{formatarData(dia)}</p>
                        <div className="flex items-center gap-2">
                          {s!==null && <span className={`font-mono text-xs font-bold ${s>=0?"text-emerald-400":"text-red-400"}`}>{minToHHMM(s)}</span>}
                          <button onClick={()=>{setRhDia(dia);setRhPeriodoId(periodo.id);setRhVals(r.rhDivergencias||[null,null,null,null]);}}
                            className={`text-xs px-2 py-1 rounded-lg border transition-all ${temRH?"border-yellow-500/30 text-yellow-400":"border-slate-600 text-slate-400 hover:text-white"}`}>
                            {temRH?"⚠️ RH":"+ RH"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {NOMES_BATIDAS.map((nome,i)=>{
                          const meu=r.batidas[i];
                          const rh=r.rhDivergencias?.[i];
                          const diverge=rh&&rh!==meu;
                          return (
                            <div key={i} className={`text-center p-1.5 rounded-lg ${diverge?"bg-yellow-500/10 border border-yellow-500/20":dark?"bg-slate-700/50":"bg-white"}`}>
                              <p className="text-xs text-slate-500 mb-0.5">{nome.slice(0,3)}</p>
                              <p className={`font-mono text-xs font-bold ${meu?(dark?"text-blue-300":"text-blue-600"):"text-slate-600"}`}>{meu||"--:--"}</p>
                              {diverge && <p className="text-xs text-yellow-400 font-mono">{rh}</p>}
                            </div>
                          );
                        })}
                      </div>
                      {r.observacao && <p className="text-xs text-slate-400 mt-2 italic">"{r.observacao}"</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {/* Modal fechar período */}
      {showFechar && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <h3 className={`font-bold text-lg ${dark?"text-white":"text-slate-800"}`}>Fechar Período</h3>
            <Inp label="Data de Início" type="date" value={fInicio} onChange={setFInicio}/>
            <Inp label="Data de Fim" type="date" value={fFim} onChange={setFFim}/>
            <div className="flex gap-3 pt-2">
              <Btn onClick={fecharPeriodo} cls="flex-1" v="warning">Fechar</Btn>
              <Btn v="secondary" onClick={()=>setShowFechar(false)} cls="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Modal RH */}
      {rhDia && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <div className="flex justify-between items-center">
              <h3 className={`font-bold ${dark?"text-white":"text-slate-800"}`}>Conferência RH · {formatarData(rhDia)}</h3>
              <button onClick={()=>setRhDia(null)} className="text-slate-400 hover:text-white"><Ic n="x" size={18}/></button>
            </div>
            <p className="text-xs text-slate-400">Insira apenas as marcações que divergem da folha do RH. Deixe em branco o que estiver correto.</p>
            <div className="space-y-3">
              {NOMES_BATIDAS.map((nome,i)=>{
                const meu=registros[rhDia]?.batidas[i];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">{nome}</p>
                      <p className={`font-mono text-sm ${dark?"text-blue-300":"text-blue-600"}`}>Meu: {meu||"--:--"}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-yellow-400 mb-1">RH (se divergir)</p>
                      <input type="time" value={rhVals[i]||""} onChange={e=>{const v=[...rhVals];v[i]=e.target.value||null;setRhVals(v);}}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-2">
              <Btn onClick={salvarRH} cls="flex-1" v="warning">Salvar</Btn>
              <Btn v="secondary" onClick={()=>setRhDia(null)} cls="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: FÉRIAS
// ============================================================
function TelaFerias({ config, ferias, setFerias, dark }: {
  config: Config; ferias: {historico:{id:number;inicio:string;fim:string;obs:string}[]};
  setFerias: React.Dispatch<React.SetStateAction<{historico:{id:number;inicio:string;fim:string;obs:string}[]}>>; dark: boolean;
}) {
  const [form, setForm] = useState({inicio:"",fim:"",obs:""});
  const [show, setShow] = useState(false);
  const admissao=config.admissao?new Date(config.admissao):null;
  const hoje=new Date();
  let diasAdq=0, prog=0, iniP: Date|null=null, fimP: Date|null=null;
  if(admissao){
    const meses=(hoje.getTime()-admissao.getTime())/(1000*60*60*24*30.44);
    const periodos=Math.floor(meses/12);
    diasAdq=periodos*30;
    prog=Math.min(100,(meses%12/12)*100);
    iniP=new Date(admissao); iniP.setFullYear(admissao.getFullYear()+periodos);
    fimP=new Date(iniP); fimP.setFullYear(iniP.getFullYear()+1);
  }
  const diasTirados=(ferias.historico||[]).reduce((a,f)=>a+Math.round((new Date(f.fim).getTime()-new Date(f.inicio).getTime())/(1000*60*60*24))+1,0);
  const diasDisp=Math.max(0,diasAdq-diasTirados);
  const bruto=Number(config.salarioBruto)||0;
  const inss=calcINSS(bruto), irrf=calcIRRF(bruto,inss), liq=bruto-inss-irrf;
  const valorFerias=liq+(liq/3);

  return (
    <div className="space-y-4 pb-6">
      <h2 className={`text-xl font-bold ${dark?"text-white":"text-slate-800"}`}>Férias</h2>
      <Card cls={`p-5 border-slate-700/50 ${dark?"bg-gradient-to-br from-sky-900/30 to-slate-800/50":"bg-sky-50 border-sky-200"}`}>
        {admissao?(
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[{l:"Adquiridos",v:diasAdq},{l:"Tirados",v:diasTirados},{l:"Disponíveis",v:diasDisp,em:true}].map((item,i)=>(
                <div key={i} className={`text-center p-3 rounded-xl ${dark?"bg-slate-700/50":"bg-white"}`}>
                  <p className={`text-2xl font-bold ${item.em?"text-emerald-400":dark?"text-white":"text-slate-800"}`}>{item.v}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.l}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Período aquisitivo</span><span>{Math.round(prog)}%</span>
            </div>
            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-1000" style={{width:`${prog}%`}}/>
            </div>
            {iniP&&fimP&&<p className="text-xs text-slate-400 mt-1">{formatarData(iniP.toISOString().slice(0,10))} → {formatarData(fimP.toISOString().slice(0,10))}</p>}
          </>
        ):<p className="text-slate-400 text-sm">Configure a data de admissão nas configurações.</p>}
      </Card>
      <Card cls={`p-5 border-emerald-500/20 ${dark?"bg-emerald-900/20":"bg-emerald-50 border-emerald-200"}`}>
        <h3 className="font-semibold text-emerald-300 mb-3">Valor Estimado de Férias</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Salário líquido</span><span className="font-mono text-white">R$ {liq.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">+ 1/3 constitucional</span><span className="font-mono text-emerald-400">R$ {(liq/3).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
          <div className="flex justify-between pt-2 border-t border-emerald-500/20">
            <span className="font-semibold text-emerald-300">Total estimado</span>
            <span className="font-mono font-bold text-emerald-400 text-lg">R$ {valorFerias.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
          </div>
        </div>
      </Card>
      <Btn onClick={()=>setShow(true)} cls="w-full" sz="lg"><Ic n="plus" size={16}/>Registrar Férias</Btn>
      {(ferias.historico||[]).map(f=>{
        const dias=Math.round((new Date(f.fim).getTime()-new Date(f.inicio).getTime())/(1000*60*60*24))+1;
        return (
          <Card key={f.id} cls={`p-4 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
            <div className="flex justify-between items-start">
              <div><p className={`font-medium ${dark?"text-white":"text-slate-700"}`}>{formatarData(f.inicio)} → {formatarData(f.fim)}</p>
              {f.obs&&<p className="text-xs text-slate-400 mt-0.5">{f.obs}</p>}</div>
              <Badge color="blue">{dias} dias</Badge>
            </div>
          </Card>
        );
      })}
      {show&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
            <h3 className={`font-bold ${dark?"text-white":"text-slate-800"}`}>Registrar Férias</h3>
            <Inp label="Início" type="date" value={form.inicio} onChange={v=>setForm(p=>({...p,inicio:v}))}/>
            <Inp label="Fim" type="date" value={form.fim} onChange={v=>setForm(p=>({...p,fim:v}))}/>
            <Inp label="Observação" value={form.obs} onChange={v=>setForm(p=>({...p,obs:v}))}/>
            <div className="flex gap-3">
              <Btn onClick={()=>{setFerias(p=>({...p,historico:[...p.historico,{...form,id:Date.now()}]}));setShow(false);}} cls="flex-1" v="success">Salvar</Btn>
              <Btn v="secondary" onClick={()=>setShow(false)} cls="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: CONFIGURAÇÕES
// ============================================================
function TelaConfig({ config, setConfig, dark, setDark }: {
  config: Config; setConfig: React.Dispatch<React.SetStateAction<Config>>; dark: boolean; setDark: (v:boolean)=>void;
}) {
  const [aba, setAba] = useState("perfil");
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Config>(config);
  const [novaNotif, setNovaNotif] = useState({label:"",horario:"",antecedencia:5,mensagem:""});
  const [showNovaNotif, setShowNovaNotif] = useState(false);

  function iniciarEdicao() { setRascunho(config); setEditando(true); }
  function salvar() { setConfig(rascunho); setEditando(false); }
  function cancelar() { setRascunho(config); setEditando(false); }
  const upd = (k: keyof Config, v: unknown) => setRascunho(p=>({...p,[k]:v}));

  // Componente de campo somente leitura
  function Campo({ label, value }: { label: string; value: string|number }) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`text-sm font-medium ${dark?"text-slate-200":"text-slate-700"} ${!value?"text-slate-500 italic":""}`}>
          {value||"Não informado"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-bold ${dark?"text-white":"text-slate-800"}`}>Configurações</h2>
        {!editando ? (
          <Btn onClick={iniciarEdicao} v="secondary" sz="sm"><Ic n="edit" size={14}/>Editar</Btn>
        ) : (
          <div className="flex gap-2">
            <Btn onClick={cancelar} v="ghost" sz="sm">Cancelar</Btn>
            <Btn onClick={salvar} v="success" sz="sm"><Ic n="check" size={14}/>Salvar</Btn>
          </div>
        )}
      </div>

      <div className={`flex gap-1 p-1 rounded-xl ${dark?"bg-slate-800/50":"bg-slate-100"}`}>
        {["perfil","escala","notif"].map(a=>(
          <button key={a} onClick={()=>setAba(a)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-all duration-200
              ${aba===a?"bg-blue-600 text-white shadow":dark?"text-slate-400 hover:text-white":"text-slate-500"}`}>
            {a==="notif"?"Notificações":a.charAt(0).toUpperCase()+a.slice(1)}
          </button>
        ))}
      </div>

      {aba==="perfil" && (
        <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
          <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Dados Pessoais</h3>
          {editando ? (
            <div className="space-y-4">
              <Inp label="Nome" value={rascunho.nome} onChange={v=>upd("nome",v)} placeholder="Seu nome"/>
              <Inp label="Empresa" value={rascunho.empresa} onChange={v=>upd("empresa",v)}/>
              <Inp label="Cargo" value={rascunho.cargo} onChange={v=>upd("cargo",v)}/>
              <Inp label="Data de admissão" type="date" value={rascunho.admissao} onChange={v=>upd("admissao",v)}/>
              <Inp label="Salário bruto (R$)" type="number" value={rascunho.salarioBruto} onChange={v=>upd("salarioBruto",v)}/>
              <div className="grid grid-cols-2 gap-3">
                <Inp label="Dia pagamento" type="number" value={rascunho.pagamentoDia} onChange={v=>upd("pagamentoDia",Number(v))}/>
                <Inp label="Dia adiantamento" type="number" value={rascunho.adiantamentoDia} onChange={v=>upd("adiantamentoDia",Number(v))}/>
              </div>
              <Sel label="Adicional hora extra" value={rascunho.adicionalHE} onChange={v=>upd("adicionalHE",Number(v))}
                opts={[{value:50,label:"50% (padrão CLT)"},{value:100,label:"100% (feriado)"}]}/>
              <div className="flex gap-3">
                <div className="flex-1"><Inp label="Tolerância (min)" type="number" value={rascunho.tolerancia} onChange={v=>upd("tolerancia",Number(v))}/></div>
                <div className="flex-1"><Sel label="Tipo" value={rascunho.toleranciaTipo} onChange={v=>upd("toleranciaTipo",v as "marcacao"|"dia")}
                  opts={[{value:"marcacao",label:"Por marcação"},{value:"dia",label:"Por dia"}]}/></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nome" value={config.nome}/>
                <Campo label="Empresa" value={config.empresa}/>
                <Campo label="Cargo" value={config.cargo}/>
                <Campo label="Admissão" value={formatarData(config.admissao)}/>
                <Campo label="Salário Bruto" value={config.salarioBruto?`R$ ${Number(config.salarioBruto).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}/>
                <Campo label="Dia Pagamento" value={config.pagamentoDia?`Dia ${config.pagamentoDia}`:""}/>
                <Campo label="Dia Adiantamento" value={config.adiantamentoDia?`Dia ${config.adiantamentoDia}`:""}/>
                <Campo label="Adicional HE" value={`${config.adicionalHE}%`}/>
                <Campo label="Tolerância" value={`${config.tolerancia}min (${config.toleranciaTipo==="marcacao"?"por marcação":"por dia"})`}/>
              </div>
            </div>
          )}
        </Card>
      )}

      {aba==="escala" && (
        <Card cls={`p-5 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
          <h3 className={`font-semibold mb-4 ${dark?"text-white":"text-slate-800"}`}>Escala de Trabalho</h3>
          {editando ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Dias da Semana</label>
                <div className="flex gap-2 flex-wrap">
                  {DIAS_SEMANA.map((d,i)=>(
                    <button key={i} onClick={()=>{
                      const dias=rascunho.escala.dias.includes(i)?rascunho.escala.dias.filter(x=>x!==i):[...rascunho.escala.dias,i];
                      upd("escala",{...rascunho.escala,dias});
                    }} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${rascunho.escala.dias.includes(i)?"bg-blue-600 text-white":dark?"bg-slate-700 text-slate-400":"bg-slate-200 text-slate-500"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Inp label="Entrada" type="time" value={rascunho.escala.entrada} onChange={v=>upd("escala",{...rascunho.escala,entrada:v})}/>
                <Inp label="Saída Almoço" type="time" value={rascunho.escala.saidaAlmoco} onChange={v=>upd("escala",{...rascunho.escala,saidaAlmoco:v})}/>
                <Inp label="Volta Almoço" type="time" value={rascunho.escala.voltaAlmoco} onChange={v=>upd("escala",{...rascunho.escala,voltaAlmoco:v})}/>
                <Inp label="Saída" type="time" value={rascunho.escala.saida} onChange={v=>upd("escala",{...rascunho.escala,saida:v})}/>
              </div>
              <Inp label="Dia de fechamento" type="number" value={rascunho.fechamentoDia} onChange={v=>upd("fechamentoDia",Number(v))} hint="Ex: 25"/>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Dias trabalhados</p>
                <div className="flex gap-2 flex-wrap">
                  {DIAS_SEMANA.map((d,i)=>(
                    <span key={i} className={`px-3 py-1.5 rounded-xl text-xs font-medium
                      ${config.escala.dias.includes(i)?"bg-blue-600/30 text-blue-300 border border-blue-500/30":dark?"bg-slate-700/30 text-slate-600":"bg-slate-100 text-slate-400"}`}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Entrada" value={config.escala.entrada}/>
                <Campo label="Saída Almoço" value={config.escala.saidaAlmoco}/>
                <Campo label="Volta Almoço" value={config.escala.voltaAlmoco}/>
                <Campo label="Saída" value={config.escala.saida}/>
                <Campo label="Fechamento" value={`Dia ${config.fechamentoDia}`}/>
              </div>
            </div>
          )}
        </Card>
      )}

      {aba==="notif" && (
        <div className="space-y-3">
          {config.notificacoes.map(n=>(
            <Card key={n.id} cls={`p-4 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`text-sm font-medium ${dark?"text-white":"text-slate-700"}`}>{n.label}</p>
                  <p className="text-xs text-slate-400">{n.mensagem}</p>
                  <p className="text-xs text-blue-400 mt-0.5">⏰ {n.horario} · {n.antecedencia}min antes</p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle value={n.ativa} onChange={v=>setConfig(p=>({...p,notificacoes:p.notificacoes.map(x=>x.id===n.id?{...x,ativa:v}:x)}))}/>
                  <button onClick={()=>setConfig(p=>({...p,notificacoes:p.notificacoes.filter(x=>x.id!==n.id)}))} className="text-slate-500 hover:text-red-400 p-1">
                    <Ic n="trash" size={14}/>
                  </button>
                </div>
              </div>
            </Card>
          ))}
          <Btn onClick={()=>setShowNovaNotif(true)} cls="w-full" v="secondary" sz="sm">
            <Ic n="plus" size={14}/> Adicionar Notificação
          </Btn>
          {showNovaNotif && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark?"bg-slate-800 border border-slate-700":"bg-white"}`}>
                <h3 className={`font-bold ${dark?"text-white":"text-slate-800"}`}>Nova Notificação</h3>
                <Inp label="Label" value={novaNotif.label} onChange={v=>setNovaNotif(p=>({...p,label:v}))} placeholder="Ex: Almoço"/>
                <Inp label="Horário" type="time" value={novaNotif.horario} onChange={v=>setNovaNotif(p=>({...p,horario:v}))}/>
                <Inp label="Antecedência (min)" type="number" value={novaNotif.antecedencia} onChange={v=>setNovaNotif(p=>({...p,antecedencia:Number(v)}))}/>
                <Inp label="Mensagem" value={novaNotif.mensagem} onChange={v=>setNovaNotif(p=>({...p,mensagem:v}))} placeholder="Ex: Hora do almoço!"/>
                <div className="flex gap-3">
                  <Btn onClick={()=>{
                    setConfig(p=>({...p,notificacoes:[...p.notificacoes,{...novaNotif,id:Date.now(),ativa:true}]}));
                    setShowNovaNotif(false);
                    setNovaNotif({label:"",horario:"",antecedencia:5,mensagem:""});
                  }} cls="flex-1" v="success">Salvar</Btn>
                  <Btn v="secondary" onClick={()=>setShowNovaNotif(false)} cls="flex-1">Cancelar</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão salvar fixo quando editando */}
      {editando && (
        <div className="flex gap-3 pt-2">
          <Btn onClick={cancelar} v="secondary" cls="flex-1">Cancelar</Btn>
          <Btn onClick={salvar} v="success" cls="flex-1"><Ic n="check" size={16}/>Salvar Configurações</Btn>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BACKUP
// ============================================================
function TelaBackup({ config, setConfig, registros, setRegistros, financeiro, setFinanceiro, ferias, setFerias, periodos, setPeriodos, dark }: {
  config: Config; setConfig: React.Dispatch<React.SetStateAction<Config>>;
  registros: Record<string,RegistroDia>; setRegistros: React.Dispatch<React.SetStateAction<Record<string,RegistroDia>>>;
  financeiro: {recebimentos:Recebimento[]}; setFinanceiro: React.Dispatch<React.SetStateAction<{recebimentos:Recebimento[]}>>;
  ferias: {historico:{id:number;inicio:string;fim:string;obs:string}[]}; setFerias: React.Dispatch<React.SetStateAction<{historico:{id:number;inicio:string;fim:string;obs:string}[]}>>;
  periodos: Periodo[]; setPeriodos: React.Dispatch<React.SetStateAction<Periodo[]>>;
  dark: boolean;
}) {
  const [alert, setAlert] = useState("");

  function exportar(){
    const blob=new Blob([JSON.stringify({config,registros,financeiro,ferias,periodos,em:new Date().toISOString()},null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`meuponto_${hojeStr()}.json`; a.click();
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target?.result as string);
        if(d.config) setConfig(d.config);
        if(d.registros) setRegistros(d.registros);
        if(d.financeiro) setFinanceiro(d.financeiro);
        if(d.ferias) setFerias(d.ferias);
        if(d.periodos) setPeriodos(d.periodos);
        setAlert("✅ Importado com sucesso!");
      } catch { setAlert("❌ Arquivo inválido."); }
      setTimeout(()=>setAlert(""),3000);
    };
    r.readAsText(f);
  }

  return (
    <div className="space-y-4 pb-6">
      <h2 className={`text-xl font-bold ${dark?"text-white":"text-slate-800"}`}>Backup</h2>
      <Card cls={`p-5 space-y-4 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
        <p className="text-sm text-slate-400">Exporte todos os seus dados em JSON e guarde em local seguro.</p>
        <Btn onClick={exportar} cls="w-full" sz="lg"><Ic n="download" size={16}/>Baixar Backup JSON</Btn>
      </Card>
      <Card cls={`p-5 space-y-4 border-slate-700/50 ${dark?"bg-slate-800/50":"bg-white border-slate-200"}`}>
        <p className="text-sm text-slate-400">Restaure a partir de um backup anterior.</p>
        <label className={`block w-full py-3 px-5 rounded-xl text-center text-sm font-semibold border-2 border-dashed cursor-pointer transition-all
          ${dark?"border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400":"border-slate-300 text-slate-500"}`}>
          <Ic n="upload" size={16} cls="inline mr-2"/>Selecionar JSON
          <input type="file" accept=".json" onChange={importar} className="hidden"/>
        </label>
        {alert && <p className={`text-sm text-center py-2 px-3 rounded-xl ${alert.includes("✅")?"bg-emerald-500/20 text-emerald-300":"bg-red-500/20 text-red-300"}`}>{alert}</p>}
      </Card>
      <Card cls={`p-4 border-red-500/20 ${dark?"bg-red-900/10":"bg-red-50"}`}>
        <div className="flex gap-2 items-start mb-4">
          <Ic n="lock" size={14} cls="text-red-400 mt-0.5"/>
          <p className="text-xs text-slate-400">Todos os dados ficam armazenados localmente no seu dispositivo. Nenhuma informação é enviada para servidores externos.</p>
        </div>
        <Btn
          v="danger"
          cls="w-full"
          sz="md"
          onClick={() => {
            const ok = window.confirm(
              "⚠️ ATENÇÃO\n\nEsta ação apagará TODOS os seus dados:\n• Registros de ponto\n• Configurações\n• Financeiro\n• Férias\n• Períodos\n\nEsta ação não pode ser desfeita!\n\nDeseja continuar?"
            );
            if (!ok) return;
            const ok2 = window.confirm("Tem certeza absoluta? Todos os dados serão perdidos permanentemente.");
            if (!ok2) return;
            localStorage.removeItem("mp_config_v2");
            localStorage.removeItem("mp_registros_v2");
            localStorage.removeItem("mp_financeiro_v2");
            localStorage.removeItem("mp_ferias_v2");
            localStorage.removeItem("mp_periodos_v2");
            window.location.reload();
          }}
        >
          <Ic n="trash" size={16}/> Apagar Todos os Dados
        </Btn>
      </Card>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function MeuPonto() {
  const [config, setConfig] = useLocalStorage<Config>("mp_config_v2", DEFAULT_CONFIG);
  const [registros, setRegistros] = useLocalStorage<Record<string,RegistroDia>>("mp_registros_v2", {});
  const [financeiro, setFinanceiro] = useLocalStorage<{recebimentos:Recebimento[]}>("mp_financeiro_v2", {recebimentos:[]});
  const [ferias, setFerias] = useLocalStorage<{historico:{id:number;inicio:string;fim:string;obs:string}[]}>("mp_ferias_v2", {historico:[]});
  const [periodos, setPeriodos] = useLocalStorage<Periodo[]>("mp_periodos_v2", []);
  const [dark, setDark] = useState(true);
  const [aba, setAba] = useState("ponto"); // tela principal
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(()=>{
    try{ const c=localStorage.getItem("mp_config_v2"); if(c) setDark(JSON.parse(c).darkMode!==false); } catch{}
  },[]);
  useEffect(()=>{ setConfig(p=>({...p,darkMode:dark})); },[dark]);

  // Todas as abas possíveis (nav + drawer)
  const navItems = [
    {key:"inicio", icon:"home", label:"Início"},
    {key:"ponto", icon:"clock", label:"Ponto"},
    {key:"financeiro", icon:"dollar", label:"Financeiro"},
  ];

  const drawerItems = [
    {key:"relatorio", icon:"file", label:"Relatório"},
    {key:"ferias", icon:"beach", label:"Férias"},
    {key:"config", icon:"settings", label:"Configurações"},
    {key:"backup", icon:"download", label:"Backup"},
  ];

  // Label da aba atual para o header quando é uma tela do drawer
  const drawerLabel = drawerItems.find(d=>d.key===aba)?.label;

  function navegarPara(key: string) {
    setAba(key);
    setDrawerOpen(false);
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${dark?"bg-slate-900 text-white":"bg-slate-50 text-slate-900"}`}
      style={{fontFamily:"'Sora', system-ui, sans-serif"}}>

      {/* Fundo decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10 ${dark?"bg-blue-600":"bg-blue-300"}`}/>
        <div className={`absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-8 ${dark?"bg-indigo-800":"bg-indigo-200"}`}/>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${dark?"bg-slate-900/80 border-slate-700/50":"bg-white/80 border-slate-200"}`}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Botão voltar quando estiver em tela do drawer */}
            {drawerLabel && (
              <button onClick={()=>setAba("ponto")} className={`p-2 rounded-xl transition-colors mr-1 ${dark?"hover:bg-slate-700 text-slate-400":"hover:bg-slate-100 text-slate-500"}`}>
                <Ic n="chevLeft" size={18}/>
              </button>
            )}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Ic n="clock" size={16} cls="text-white"/>
            </div>
            <span className="font-bold text-base tracking-tight">{drawerLabel || "MeuPonto"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setDark(!dark)} className={`p-2 rounded-xl transition-colors ${dark?"hover:bg-slate-700 text-slate-400":"hover:bg-slate-100 text-slate-500"}`}>
              <Ic n={dark?"sun":"moon"} size={18}/>
            </button>
            <button onClick={()=>setDrawerOpen(true)} className={`p-2 rounded-xl transition-colors ${dark?"hover:bg-slate-700 text-slate-400":"hover:bg-slate-100 text-slate-500"}`}>
              <Ic n="menu" size={20}/>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-lg mx-auto px-4 pt-5 pb-24 relative">
        {aba==="inicio" && <TelaInicio config={config} registros={registros} dark={dark}/>}
        {aba==="ponto" && <TelaPonto config={config} registros={registros} setRegistros={setRegistros} periodos={periodos} dark={dark}/>}
        {aba==="financeiro" && <TelaFinanceiro config={config} registros={registros} financeiro={financeiro} setFinanceiro={setFinanceiro} dark={dark}/>}
        {aba==="relatorio" && <TelaRelatorio config={config} registros={registros} setRegistros={setRegistros} periodos={periodos} setPeriodos={setPeriodos} dark={dark}/>}
        {aba==="ferias" && <TelaFerias config={config} ferias={ferias} setFerias={setFerias} dark={dark}/>}
        {aba==="config" && <TelaConfig config={config} setConfig={setConfig} dark={dark} setDark={setDark}/>}
        {aba==="backup" && <TelaBackup config={config} setConfig={setConfig} registros={registros} setRegistros={setRegistros} financeiro={financeiro} setFinanceiro={setFinanceiro} ferias={ferias} setFerias={setFerias} periodos={periodos} setPeriodos={setPeriodos} dark={dark}/>}
      </main>

      {/* Nav Bottom — só mostra quando estiver nas 3 abas principais */}
      {!drawerLabel && (
        <nav className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t ${dark?"bg-slate-900/90 border-slate-700/50":"bg-white/90 border-slate-200"}`}>
          <div className="max-w-lg mx-auto flex">
            {navItems.map(item=>(
              <button key={item.key} onClick={()=>navegarPara(item.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200
                  ${aba===item.key?"text-blue-500":dark?"text-slate-500 hover:text-slate-300":"text-slate-400 hover:text-slate-600"}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-200 ${aba===item.key?"bg-blue-500/15 scale-110":""}`}>
                  <Ic n={item.icon} size={20}/>
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Drawer — apenas menu de navegação */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={()=>setDrawerOpen(false)}>
          <div className={`w-64 h-full shadow-2xl flex flex-col ${dark?"bg-slate-800":"bg-white"}`}
            onClick={e=>e.stopPropagation()}>
            {/* Header drawer */}
            <div className={`px-4 py-4 border-b flex justify-between items-center ${dark?"border-slate-700":"border-slate-200"}`}>
              <span className={`font-bold ${dark?"text-white":"text-slate-800"}`}>Menu</span>
              <button onClick={()=>setDrawerOpen(false)}
                className={`p-2 rounded-xl ${dark?"hover:bg-slate-700 text-slate-400":"hover:bg-slate-100 text-slate-500"}`}>
                <Ic n="x" size={18}/>
              </button>
            </div>
            {/* Links do drawer — abrem como página completa */}
            <div className="flex-1 p-2 space-y-1">
              {drawerItems.map(item=>(
                <button key={item.key} onClick={()=>navegarPara(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all
                    ${aba===item.key
                      ?"bg-blue-600 text-white"
                      :dark?"hover:bg-slate-700/50 text-slate-300":"hover:bg-slate-100 text-slate-700"}`}>
                  <Ic n={item.icon} size={18} cls={aba===item.key?"text-white":"text-blue-400"}/>
                  <span className="font-medium">{item.label}</span>
                  <Ic n="chevRight" size={14} cls={`ml-auto ${aba===item.key?"text-white/60":"text-slate-500"}`}/>
                </button>
              ))}
            </div>
            {/* Rodapé do drawer — toggle de tema */}
            <div className={`p-4 border-t space-y-3 ${dark?"border-slate-700":"border-slate-200"}`}>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Ic n={dark?"moon":"sun"} size={16} cls={dark?"text-blue-400":"text-yellow-400"}/>
                  <span className={`text-sm font-medium ${dark?"text-slate-300":"text-slate-600"}`}>
                    {dark?"Tema escuro":"Tema claro"}
                  </span>
                </div>
                <Toggle value={dark} onChange={setDark}/>
              </div>
              <p className="text-xs text-slate-500 text-center">MeuPonto v2.0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}