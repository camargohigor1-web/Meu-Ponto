"use client";

import { useState, useEffect } from "react";

// ============================================================
// CONSTANTES E DADOS FISCAIS 2025
// ============================================================
const INSS_TABELA_2025 = [
  { ate: 1518.0, aliquota: 7.5 },
  { ate: 2793.88, aliquota: 9.0 },
  { ate: 4190.83, aliquota: 12.0 },
  { ate: 8157.41, aliquota: 14.0 },
];

const IRRF_TABELA_2025 = [
  { ate: 2259.2, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 7.5, deducao: 169.44 },
  { ate: 3751.05, aliquota: 15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 22.5, deducao: 662.77 },
  { ate: Infinity, aliquota: 27.5, deducao: 896.0 },
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const DEFAULT_CONFIG = {
  nome: "",
  empresa: "",
  cargo: "",
  admissao: "",
  salarioBruto: "",
  escala: { dias: [1,2,3,4,5], entrada: "08:00", saidaAlmoco: "12:00", voltaAlmoco: "13:00", saida: "17:00" },
  tolerancia: 5,
  almocoDuracao: 60,
  fechamentoDia: 25,
  pagamentoDia: 5,
  adiantamentoDia: 20,
  adicionalHE: 50,
  darkMode: true,
};

// ============================================================
// UTILITÁRIOS
// ============================================================
function calcINSS(bruto: number): number {
  let inss = 0;
  let base = bruto;
  let ant = 0;
  for (const faixa of INSS_TABELA_2025) {
    if (base <= 0) break;
    const faixaVal = Math.min(base, faixa.ate - ant);
    inss += faixaVal * (faixa.aliquota / 100);
    base -= faixaVal;
    ant = faixa.ate;
    if (bruto <= faixa.ate) break;
  }
  return Math.min(inss, 8157.41 * 0.14);
}

function calcIRRF(bruto: number, inss: number): number {
  const base = bruto - inss;
  for (const faixa of IRRF_TABELA_2025) {
    if (base <= faixa.ate) {
      return Math.max(0, base * (faixa.aliquota / 100) - faixa.deducao);
    }
  }
  return 0;
}

function faixaINSS(bruto: number): number {
  for (const f of INSS_TABELA_2025) {
    if (bruto <= f.ate) return f.aliquota;
  }
  return 14;
}

function faixaIRRF(base: number): number {
  for (const f of IRRF_TABELA_2025) {
    if (base <= f.ate) return f.aliquota;
  }
  return 27.5;
}

function minToHHMM(min: number): string {
  const neg = min < 0;
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${neg ? "-" : "+"}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function parseHHMM(str: string): number {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hojeStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatarData(str: string): string {
  if (!str) return "";
  const [y,m,d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function diferencaMin(real: string, padrao: string): number {
  return parseHHMM(real) - parseHHMM(padrao);
}

function calcSaldoDia(batidas: string[], escala: typeof DEFAULT_CONFIG.escala): number | null {
  if (!batidas || batidas.length < 4) return null;
  const [e, sa, va, s] = batidas;
  if (!e || !sa || !va || !s) return null;
  const trabalhado = (parseHHMM(s) - parseHHMM(va)) + (parseHHMM(sa) - parseHHMM(e));
  const previsto = (parseHHMM(escala.saida) - parseHHMM(escala.voltaAlmoco)) + (parseHHMM(escala.saidaAlmoco) - parseHHMM(escala.entrada));
  return trabalhado - previsto;
}

function useLocalStorage<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

// ============================================================
// ÍCONES SVG inline
// ============================================================
const Icon = ({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    home: <><rect x="3" y="9" width="18" height="13" rx="2"/><path d="m3 9 9-6 9 6"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    dollar: <><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    beach: <><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><path d="m4.2 10.6 2.6-5.4"/><path d="m19.8 10.6-2.6-5.4"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></>,
    award: <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

// ============================================================
// COMPONENTES BASE
// ============================================================
function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border backdrop-blur-sm transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    gray: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${colors[color]}`}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", className = "", disabled = false, size = "md" }: {
  children: React.ReactNode; onClick?: () => void; variant?: string; className?: string; disabled?: boolean; size?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-40";
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };
  const variants: Record<string, string> = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white active:scale-95",
    ghost: "text-slate-300 hover:text-white hover:bg-slate-700/50 active:scale-95",
    danger: "bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 active:scale-95",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95",
  };
  return <button disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>{children}</button>;
}

function Input({ label, value, onChange, type = "text", placeholder = "", hint = "" }: {
  label?: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
      />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label?: string; value: string | number; onChange: (v: string) => void; options: { value: string | number; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className="text-sm text-slate-300">{label}</span>
      <div onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? "bg-blue-600" : "bg-slate-700"}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-6" : "translate-x-1"}`}/>
      </div>
    </label>
  );
}

// ============================================================
// TELA: DASHBOARD
// ============================================================
function Dashboard({ config, registros, dark }: { config: typeof DEFAULT_CONFIG; registros: Record<string, any>; dark: boolean }) {
  // ✅ CORREÇÃO: inicia como null para evitar erro de hidratação
  const [hora, setHora] = useState<Date | null>(null);

  useEffect(() => {
    setHora(new Date());
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hoje = hojeStr();
  const regHoje = registros[hoje] || { batidas: ["","","",""] };
  const escala = config.escala;

  const saldoHoje = calcSaldoDia(regHoje.batidas, escala);
  const primeiroBaterIdx = regHoje.batidas.findIndex((b: string) => !b);
  const nomes = ["Entrada","Saída Almoço","Volta Almoço","Saída"];

  // ✅ CORREÇÃO: usa hora com fallback seguro
  const horaAtual = hora ?? new Date(0);
  const saudacao = horaAtual.getHours() < 12 ? "Bom dia" : horaAtual.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const emojis = horaAtual.getHours() < 12 ? "☀️" : horaAtual.getHours() < 18 ? "🌤️" : "🌙";

  const hoje_d = new Date();
  const diasSemana = Array.from({length:7}, (_,i) => {
    const d = new Date(hoje_d); d.setDate(hoje_d.getDate() - hoje_d.getDay() + i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  const saldoSemana = diasSemana.reduce((acc, dia) => {
    const r = registros[dia];
    if (!r) return acc;
    const s = calcSaldoDia(r.batidas, escala);
    return acc + (s || 0);
  }, 0);

  const ano = hoje_d.getFullYear(), mes = hoje_d.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasMes = new Date(ano, mes+1, 0).getDate();
  const celulas = Array.from({length: primeiroDia + diasMes}, (_,i) => i < primeiroDia ? null : i - primeiroDia + 1);

  function statusDia(d: number) {
    const str = `${ano}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const r = registros[str];
    if (!r) return null;
    if (r.ausencia === "atestado") return "🟡";
    if (r.ausencia === "ferias") return "🏖️";
    if (r.ausencia === "feriado") return "🔵";
    if (r.ausencia === "falta") return "❌";
    const s = calcSaldoDia(r.batidas, escala);
    if (s !== null) return "✅";
    return null;
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header Saudação */}
      <Card className={`p-5 border-blue-500/20 ${dark ? "bg-gradient-to-br from-blue-900/40 to-slate-900/60" : "bg-gradient-to-br from-blue-50 to-white"}`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-blue-400 font-medium uppercase tracking-widest mb-1">{emojis} {saudacao}</p>
            <h2 className={`text-xl font-bold ${dark ? "text-white" : "text-slate-800"}`}>
              {config.nome || "Bem-vindo ao MeuPonto"}
            </h2>
            {config.empresa && <p className="text-sm text-slate-400 mt-0.5">{config.empresa} · {config.cargo}</p>}
          </div>
          <div className="text-right">
            {/* ✅ CORREÇÃO: exibe "--:--" enquanto hora é null (SSR) */}
            <div className={`text-2xl font-bold font-mono tabular-nums ${dark ? "text-white" : "text-slate-800"}`}>
              {hora
                ? `${String(hora.getHours()).padStart(2,"0")}:${String(hora.getMinutes()).padStart(2,"0")}`
                : "--:--"}
            </div>
            <div className="text-xs text-slate-400">
              {hora ? `${String(hora.getSeconds()).padStart(2,"0")}s` : "--"}
            </div>
          </div>
        </div>
      </Card>

      {/* Card do Dia */}
      <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Hoje · {formatarData(hoje)}</h3>
          {primeiroBaterIdx >= 0 && primeiroBaterIdx < 4 && (
            <Badge color="blue">Próximo: {nomes[primeiroBaterIdx]}</Badge>
          )}
          {primeiroBaterIdx === -1 && <Badge color="green">Dia completo ✓</Badge>}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {nomes.map((n, i) => (
            <div key={i} className={`text-center p-2 rounded-xl ${dark ? "bg-slate-700/50" : "bg-slate-100"}`}>
              <div className="text-xs text-slate-400 mb-1">{n}</div>
              <div className={`text-sm font-mono font-bold ${regHoje.batidas[i] ? (dark ? "text-blue-300" : "text-blue-600") : "text-slate-500"}`}>
                {regHoje.batidas[i] || "--:--"}
              </div>
            </div>
          ))}
        </div>
        {saldoHoje !== null && (
          <div className={`flex items-center justify-between p-3 rounded-xl ${saldoHoje >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <span className="text-sm text-slate-300">Saldo do dia</span>
            <span className={`font-bold font-mono ${saldoHoje >= 0 ? "text-emerald-400" : "text-red-400"}`}>{minToHHMM(saldoHoje)}</span>
          </div>
        )}
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={`p-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="trending" size={16} className="text-blue-400"/>
            <span className="text-xs text-slate-400">Saldo Semana</span>
          </div>
          <div className={`text-xl font-bold font-mono ${saldoSemana >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {minToHHMM(saldoSemana)}
          </div>
        </Card>
        <Card className={`p-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="dollar" size={16} className="text-emerald-400"/>
            <span className="text-xs text-slate-400">Salário Bruto</span>
          </div>
          <div className={`text-xl font-bold ${dark ? "text-white" : "text-slate-800"}`}>
            {config.salarioBruto ? `R$ ${Number(config.salarioBruto).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "—"}
          </div>
        </Card>
      </div>

      {/* Mini Calendário */}
      <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
        <h3 className={`font-semibold mb-4 ${dark ? "text-white" : "text-slate-800"}`}>{MESES[mes]} {ano}</h3>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {DIAS_SEMANA.map(d => <div key={d} className="text-xs text-slate-500 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {celulas.map((d, i) => {
            if (!d) return <div key={i}/>;
            const st = statusDia(d);
            const isHoje = d === hoje_d.getDate();
            return (
              <div key={i} className={`relative h-9 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                ${isHoje ? "bg-blue-600 text-white ring-2 ring-blue-400" : dark ? "text-slate-300 hover:bg-slate-700/50" : "text-slate-600 hover:bg-slate-100"}`}>
                {st ? <span className="text-base leading-none">{st}</span> : d}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
          <span>✅ OK</span><span>❌ Falta</span><span>🟡 Atestado</span><span>🔵 Feriado</span><span>🏖️ Férias</span>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// TELA: PONTO
// ============================================================
function TelaPonto({ config, registros, setRegistros, dark }: {
  config: typeof DEFAULT_CONFIG; registros: Record<string, any>; setRegistros: (v: any) => void; dark: boolean;
}) {
  const hoje = hojeStr();
  const [reg, setReg] = useState(() => registros[hoje] || { batidas: ["","","",""], obs: ["","","",""], editado: [false,false,false,false], ausencia: "" });
  // ✅ CORREÇÃO: inicia como null
  const [hora, setHora] = useState<Date | null>(null);
  const [pulso, setPulso] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    setHora(new Date());
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function salvar(novoReg: any) {
    setReg(novoReg);
    setRegistros((prev: any) => ({ ...prev, [hoje]: novoReg }));
  }

  function baterPonto() {
    if (!hora) return;
    const idx = reg.batidas.findIndex((b: string) => !b);
    if (idx < 0) return;
    const h = String(hora.getHours()).padStart(2,"0");
    const m = String(hora.getMinutes()).padStart(2,"0");
    const novas = [...reg.batidas]; novas[idx] = `${h}:${m}`;
    salvar({ ...reg, batidas: novas });
    setPulso(true); setTimeout(() => setPulso(false), 600);
  }

  function salvarEdicao() {
    if (editIdx === null) return;
    const novas = [...reg.batidas]; novas[editIdx] = editVal;
    const edit = [...reg.editado]; edit[editIdx] = true;
    salvar({ ...reg, batidas: novas, editado: edit });
    setEditIdx(null);
  }

  const proxIdx = reg.batidas.findIndex((b: string) => !b);
  const nomes = ["Entrada","Saída Almoço","Volta Almoço","Saída"];
  const padroes = [config.escala.entrada, config.escala.saidaAlmoco, config.escala.voltaAlmoco, config.escala.saida];
  const saldo = calcSaldoDia(reg.batidas, config.escala);

  // ✅ CORREÇÃO: countdown usa hora com guard
  let countdown: number | null = null;
  if (hora && !reg.batidas[3] && reg.batidas[2]) {
    const saidaMin = parseHHMM(config.escala.saida);
    const agoMin = hora.getHours()*60 + hora.getMinutes();
    countdown = saidaMin - agoMin;
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Botão principal */}
      <Card className={`p-8 text-center border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
        {proxIdx >= 0 ? (
          <>
            <p className="text-sm text-slate-400 mb-2">Próximo registro</p>
            <p className={`text-xl font-bold mb-6 ${dark ? "text-white" : "text-slate-800"}`}>{nomes[proxIdx]}</p>
            <button
              onClick={baterPonto}
              className={`relative w-36 h-36 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg shadow-2xl transition-all duration-200 active:scale-90
                ${pulso ? "scale-110 shadow-blue-500/50" : "hover:scale-105"}
                bg-gradient-to-br from-blue-500 to-blue-700`}
            >
              <div className={`absolute inset-0 rounded-full bg-blue-500/30 ${pulso ? "animate-ping" : ""}`}/>
              <span className="relative z-10 flex flex-col items-center">
                <Icon name="clock" size={28} className="mb-1"/>
                Bater
              </span>
            </button>
            {/* ✅ CORREÇÃO: exibe "--:--:--" enquanto hora é null */}
            <p className="text-xs text-slate-500 mt-4">
              {hora
                ? `${String(hora.getHours()).padStart(2,"0")}:${String(hora.getMinutes()).padStart(2,"0")}:${String(hora.getSeconds()).padStart(2,"0")}`
                : "--:--:--"}
            </p>
          </>
        ) : (
          <div className="py-4">
            <div className="text-4xl mb-3">🎉</div>
            <p className={`text-lg font-bold ${dark ? "text-white" : "text-slate-800"}`}>Ponto completo hoje!</p>
            <p className="text-sm text-slate-400 mt-1">Todas as batidas registradas</p>
          </div>
        )}
      </Card>

      {/* Countdown */}
      {countdown !== null && (
        <Card className={`p-4 border-blue-500/20 ${dark ? "bg-blue-900/20" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-300">⏱ Faltam para saída</span>
            <span className={`font-mono font-bold text-lg ${countdown > 0 ? "text-blue-400" : "text-emerald-400"}`}>
              {countdown > 0 ? minToHHMM(countdown).replace("+","") : "Pode sair!"}
            </span>
          </div>
        </Card>
      )}

      {/* Batidas do dia */}
      <Card className={`border-slate-700/50 overflow-hidden ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
        <div className={`p-4 border-b ${dark ? "border-slate-700/50" : "border-slate-200"}`}>
          <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Registros de hoje</h3>
        </div>
        {nomes.map((nome, i) => {
          const batida = reg.batidas[i];
          const padrao = padroes[i];
          const diff = batida ? diferencaMin(batida, padrao) : null;
          return (
            <div key={i} className={`flex items-center justify-between p-4 ${dark ? "border-b border-slate-700/30 last:border-0" : "border-b border-slate-100 last:border-0"}`}>
              <div>
                <p className={`text-sm font-medium ${dark ? "text-white" : "text-slate-700"}`}>{nome}</p>
                <p className="text-xs text-slate-500">Padrão: {padrao}</p>
                {reg.editado[i] && <span className="text-xs text-yellow-400">✏ Editado</span>}
              </div>
              <div className="flex items-center gap-3">
                {batida ? (
                  <>
                    <div className="text-right">
                      <p className={`font-mono font-bold ${dark ? "text-blue-300" : "text-blue-600"}`}>{batida}</p>
                      {diff !== null && <p className={`text-xs ${diff < 0 ? "text-red-400" : diff > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                        {diff === 0 ? "No horário" : `${diff > 0 ? "+" : ""}${diff}min`}
                      </p>}
                    </div>
                    <button onClick={() => { setEditIdx(i); setEditVal(batida); }} className="text-slate-500 hover:text-blue-400 transition-colors">
                      <Icon name="edit" size={14}/>
                    </button>
                  </>
                ) : (
                  <span className="text-slate-600 font-mono">--:--</span>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Saldo do dia */}
      {saldo !== null && (
        <Card className={`p-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <div className="flex justify-between items-center">
            <span className={dark ? "text-slate-300" : "text-slate-600"}>Saldo do dia</span>
            <span className={`font-mono font-bold text-lg ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{minToHHMM(saldo)}</span>
          </div>
        </Card>
      )}

      {/* Ausência */}
      <Card className={`p-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
        <Select
          label="Ausência / Ocorrência"
          value={reg.ausencia || ""}
          onChange={v => salvar({...reg, ausencia: v})}
          options={[
            {value:"",label:"Nenhuma"},
            {value:"falta",label:"❌ Falta injustificada"},
            {value:"atestado",label:"🟡 Atestado médico"},
            {value:"feriado",label:"🔵 Feriado"},
            {value:"ferias",label:"🏖️ Férias"},
            {value:"folga",label:"🔄 Folga compensada"},
          ]}
        />
      </Card>

      {/* Modal edição */}
      {editIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark ? "bg-slate-800 border border-slate-700" : "bg-white"}`}>
            <h3 className={`font-bold ${dark ? "text-white" : "text-slate-800"}`}>Editar {nomes[editIdx]}</h3>
            <Input label="Horário" type="time" value={editVal} onChange={setEditVal}/>
            <div className="flex gap-3">
              <Btn onClick={salvarEdicao} className="flex-1">Salvar</Btn>
              <Btn variant="secondary" onClick={() => setEditIdx(null)} className="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: FINANCEIRO
// ============================================================
function TelaFinanceiro({ config, financeiro, setFinanceiro, dark }: {
  config: typeof DEFAULT_CONFIG; financeiro: any; setFinanceiro: (v: any) => void; dark: boolean;
}) {
  const [aba, setAba] = useState("resumo");
  const [formMes, setFormMes] = useState({ competencia: "", salario: "", adiantamento: "", inss: "", irrf: "", vt: "", vr: "", outros: "" });
  const [mostrarForm, setMostrarForm] = useState(false);

  const bruto = Number(config.salarioBruto) || 0;
  const inssCalc = calcINSS(bruto);
  const irrfCalc = calcIRRF(bruto, inssCalc);
  const liquido = bruto - inssCalc - irrfCalc;

  function adicionarRecebimento() {
    const novo = { ...formMes, id: Date.now() };
    setFinanceiro((prev: any) => ({ ...prev, recebimentos: [...(prev.recebimentos||[]), novo] }));
    setMostrarForm(false);
    setFormMes({ competencia:"",salario:"",adiantamento:"",inss:"",irrf:"",vt:"",vr:"",outros:"" });
  }

  const recebimentos = financeiro.recebimentos || [];
  const mediaLiquida = recebimentos.length
    ? recebimentos.reduce((a: number, r: any) => a + (Number(r.salario)||0) - (Number(r.inss)||0) - (Number(r.irrf)||0) - (Number(r.vt)||0) - (Number(r.vr)||0) - (Number(r.outros)||0), 0) / recebimentos.length
    : liquido;

  return (
    <div className="space-y-5 pb-6">
      <div className={`flex gap-1 p-1 rounded-xl ${dark ? "bg-slate-800/50" : "bg-slate-100"}`}>
        {["resumo","tabelas","historico"].map(a => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all duration-200
            ${aba === a ? "bg-blue-600 text-white shadow" : dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
            {a === "tabelas" ? "Tabelas Fiscais" : a.charAt(0).toUpperCase()+a.slice(1)}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <>
          <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
            <h3 className={`font-semibold mb-4 ${dark ? "text-white" : "text-slate-800"}`}>Simulação Salarial</h3>
            <div className="space-y-3">
              {[
                { label: "Salário Bruto", value: bruto, color: "text-white" },
                { label: `INSS (${faixaINSS(bruto)}%)`, value: -inssCalc, color: "text-red-400" },
                { label: `IRRF (${faixaIRRF(bruto-inssCalc)}%)`, value: -irrfCalc, color: "text-red-400" },
              ].map((item, i) => (
                <div key={i} className={`flex justify-between items-center py-2 ${i < 2 ? (dark ? "border-b border-slate-700/50" : "border-b border-slate-200") : ""}`}>
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className={`font-mono font-bold ${item.color}`}>
                    {item.value < 0 ? "-" : ""}R$ {Math.abs(item.value).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center py-3 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold text-emerald-300">Salário Líquido Estimado</span>
                <span className="font-mono font-bold text-emerald-400 text-lg">R$ {liquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
              </div>
            </div>
          </Card>

          {recebimentos.length > 0 && (
            <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Média Real Recebida</h3>
                <Badge color="green">Histórico</Badge>
              </div>
              <p className="text-3xl font-bold text-emerald-400 font-mono">R$ {mediaLiquida.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
              <p className="text-xs text-slate-400 mt-1">Baseado em {recebimentos.length} recebimento(s)</p>
            </Card>
          )}

          <Btn onClick={() => setMostrarForm(true)} className="w-full" size="lg">
            <Icon name="plus" size={18}/> Registrar Recebimento
          </Btn>
        </>
      )}

      {aba === "tabelas" && (
        <div className="space-y-5">
          <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="info" size={16} className="text-blue-400"/>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Tabela INSS 2025</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">O desconto é calculado de forma progressiva por faixa de salário.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-700">
                    <th className="text-left py-2">Faixa salarial</th>
                    <th className="text-right py-2">Alíquota</th>
                    <th className="text-right py-2">Você paga</th>
                  </tr>
                </thead>
                <tbody>
                  {INSS_TABELA_2025.map((f, i) => {
                    const ant = i > 0 ? INSS_TABELA_2025[i-1].ate : 0;
                    const naFaixa = bruto >= ant && bruto <= f.ate;
                    return (
                      <tr key={i} className={`border-b border-slate-700/30 ${naFaixa ? "bg-blue-500/10" : ""}`}>
                        <td className={`py-2 text-left ${naFaixa ? "text-blue-300 font-semibold" : "text-slate-400"}`}>
                          {naFaixa ? "◀ " : ""}Até R$ {f.ate.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                        </td>
                        <td className={`py-2 text-right ${naFaixa ? "text-blue-300 font-semibold" : "text-slate-400"}`}>{f.aliquota}%</td>
                        <td className={`py-2 text-right font-mono ${naFaixa ? "text-blue-300 font-semibold" : "text-slate-500"}`}>
                          {naFaixa ? `R$ ${inssCalc.toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className={`p-5 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="info" size={16} className="text-yellow-400"/>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Tabela IRRF 2025</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">Calculado sobre o salário bruto menos o desconto do INSS.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-700">
                    <th className="text-left py-2">Base de cálculo</th>
                    <th className="text-right py-2">Alíquota</th>
                    <th className="text-right py-2">Dedução</th>
                  </tr>
                </thead>
                <tbody>
                  {IRRF_TABELA_2025.map((f, i) => {
                    const base = bruto - inssCalc;
                    const naFaixa = base <= f.ate && (i === 0 || base > IRRF_TABELA_2025[i-1].ate);
                    return (
                      <tr key={i} className={`border-b border-slate-700/30 ${naFaixa ? "bg-yellow-500/10" : ""}`}>
                        <td className={`py-2 text-left ${naFaixa ? "text-yellow-300 font-semibold" : "text-slate-400"}`}>
                          {naFaixa ? "◀ " : ""}
                          {f.ate === Infinity ? "Acima de R$ 4.664,68" : `Até R$ ${f.ate.toLocaleString("pt-BR",{minimumFractionDigits:2})}`}
                        </td>
                        <td className={`py-2 text-right ${naFaixa ? "text-yellow-300 font-semibold" : "text-slate-400"}`}>{f.aliquota}%</td>
                        <td className="py-2 text-right font-mono text-slate-500">
                          {f.deducao > 0 ? `R$ ${f.deducao.toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {irrfCalc > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-300">Seu IRRF estimado: <span className="font-bold font-mono">R$ {irrfCalc.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></p>
              </div>
            )}
          </Card>
        </div>
      )}

      {aba === "historico" && (
        <div className="space-y-3">
          {recebimentos.length === 0 ? (
            <Card className={`p-8 text-center border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
              <Icon name="dollar" size={32} className="text-slate-600 mx-auto mb-3"/>
              <p className="text-slate-400">Nenhum recebimento registrado</p>
              <Btn onClick={() => { setAba("resumo"); setMostrarForm(true); }} className="mt-4" variant="secondary">
                Adicionar primeiro
              </Btn>
            </Card>
          ) : (
            recebimentos.slice().reverse().map((r: any) => {
              const liq = (Number(r.salario)||0) - (Number(r.inss)||0) - (Number(r.irrf)||0) - (Number(r.vt)||0) - (Number(r.vr)||0) - (Number(r.outros)||0);
              return (
                <Card key={r.id} className={`p-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>{r.competencia || "Sem data"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Bruto: R$ {Number(r.salario).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
                      {r.adiantamento && <p className="text-xs text-slate-400">+ Adiant.: R$ {Number(r.adiantamento).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-mono font-bold">R$ {liq.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
                      <p className="text-xs text-slate-500">líquido</p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark ? "bg-slate-800 border border-slate-700" : "bg-white"}`}>
            <h3 className={`font-bold text-lg ${dark ? "text-white" : "text-slate-800"}`}>Registrar Recebimento</h3>
            <Input label="Competência (ex: Jan/2025)" value={formMes.competencia} onChange={v => setFormMes(p=>({...p,competencia:v}))}/>
            <Input label="Salário Bruto (R$)" type="number" value={formMes.salario} onChange={v => setFormMes(p=>({...p,salario:v}))}/>
            <Input label="Adiantamento (R$)" type="number" value={formMes.adiantamento} onChange={v => setFormMes(p=>({...p,adiantamento:v}))}/>
            <div className="grid grid-cols-2 gap-3">
              <Input label="INSS (R$)" type="number" value={formMes.inss} onChange={v => setFormMes(p=>({...p,inss:v}))}/>
              <Input label="IRRF (R$)" type="number" value={formMes.irrf} onChange={v => setFormMes(p=>({...p,irrf:v}))}/>
              <Input label="Vale Transp. (R$)" type="number" value={formMes.vt} onChange={v => setFormMes(p=>({...p,vt:v}))}/>
              <Input label="Vale Refei. (R$)" type="number" value={formMes.vr} onChange={v => setFormMes(p=>({...p,vr:v}))}/>
            </div>
            <Input label="Outros descontos (R$)" type="number" value={formMes.outros} onChange={v => setFormMes(p=>({...p,outros:v}))}/>
            <div className="flex gap-3 pt-2">
              <Btn onClick={adicionarRecebimento} className="flex-1" variant="success">Salvar</Btn>
              <Btn variant="secondary" onClick={() => setMostrarForm(false)} className="flex-1">Cancelar</Btn>
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
  config: typeof DEFAULT_CONFIG; ferias: any; setFerias: (v: any) => void; dark: boolean;
}) {
  const [form, setForm] = useState({ inicio: "", fim: "", obs: "" });
  const [mostrarForm, setMostrarForm] = useState(false);

  const admissao = config.admissao ? new Date(config.admissao) : null;
  const hoje = new Date();

  let diasAdquiridos = 0, progressoPerc = 0, inicioPeriodo: Date | null = null, fimPeriodo: Date | null = null;
  if (admissao) {
    const mesesTrabalhados = (hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const periodosCompletos = Math.floor(mesesTrabalhados / 12);
    diasAdquiridos = periodosCompletos * 30;
    const mesesNoPeriodoAtual = mesesTrabalhados % 12;
    progressoPerc = Math.min(100, (mesesNoPeriodoAtual / 12) * 100);
    inicioPeriodo = new Date(admissao); inicioPeriodo.setFullYear(admissao.getFullYear() + periodosCompletos);
    fimPeriodo = new Date(inicioPeriodo); fimPeriodo.setFullYear(inicioPeriodo.getFullYear() + 1);
  }

  const diasTirados = (ferias.historico||[]).reduce((a: number, f: any) => {
    const d1 = new Date(f.inicio), d2 = new Date(f.fim);
    return a + Math.round((d2.getTime()-d1.getTime())/(1000*60*60*24)) + 1;
  }, 0);
  const diasDisponiveis = Math.max(0, diasAdquiridos - diasTirados);

  const bruto = Number(config.salarioBruto) || 0;
  const inss = calcINSS(bruto);
  const irrf = calcIRRF(bruto, inss);
  const liquido = bruto - inss - irrf;
  const valorFerias = liquido + (liquido / 3);

  function adicionarFerias() {
    setFerias((prev: any) => ({ ...prev, historico: [...(prev.historico||[]), { ...form, id: Date.now() }] }));
    setMostrarForm(false);
    setForm({ inicio:"", fim:"", obs:"" });
  }

  return (
    <div className="space-y-5 pb-6">
      <Card className={`p-5 border-slate-700/50 ${dark ? "bg-gradient-to-br from-sky-900/30 to-slate-800/50" : "bg-gradient-to-br from-sky-50 to-white border-sky-200"}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏖️</span>
          <h3 className={`font-bold text-lg ${dark ? "text-white" : "text-slate-800"}`}>Férias</h3>
        </div>
        {admissao ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Dias adquiridos", value: diasAdquiridos },
                { label: "Dias tirados", value: diasTirados },
                { label: "Disponíveis", value: diasDisponiveis },
              ].map((item, i) => (
                <div key={i} className={`text-center p-3 rounded-xl ${dark ? "bg-slate-700/50" : "bg-white"}`}>
                  <p className={`text-2xl font-bold ${i === 2 ? "text-emerald-400" : dark ? "text-white" : "text-slate-800"}`}>{item.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Período aquisitivo</span>
                <span>{Math.round(progressoPerc)}%</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-1000" style={{width:`${progressoPerc}%`}}/>
              </div>
              {inicioPeriodo && fimPeriodo && (
                <p className="text-xs text-slate-400 mt-1">
                  {formatarData(inicioPeriodo.toISOString().slice(0,10))} → {formatarData(fimPeriodo.toISOString().slice(0,10))}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-slate-400 text-sm">Configure a data de admissão nas configurações para ver seu período aquisitivo.</p>
        )}
      </Card>

      <Card className={`p-5 border-emerald-500/20 ${dark ? "bg-emerald-900/20" : "bg-emerald-50 border-emerald-200"}`}>
        <h3 className="font-semibold text-emerald-300 mb-3">Valor Estimado de Férias</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Salário líquido</span><span className="font-mono text-white">R$ {liquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">+ 1/3 constitucional</span><span className="font-mono text-emerald-400">R$ {(liquido/3).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
          <div className="flex justify-between pt-2 border-t border-emerald-500/20">
            <span className="font-semibold text-emerald-300">Total estimado</span>
            <span className="font-mono font-bold text-emerald-400 text-lg">R$ {valorFerias.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
          </div>
        </div>
      </Card>

      <Btn onClick={() => setMostrarForm(true)} className="w-full" size="lg">
        <Icon name="plus" size={18}/> Registrar Férias Tiradas
      </Btn>

      {(ferias.historico||[]).length > 0 && (
        <Card className={`border-slate-700/50 overflow-hidden ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <div className={`p-4 border-b ${dark ? "border-slate-700/50" : "border-slate-200"}`}>
            <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Histórico</h3>
          </div>
          {(ferias.historico||[]).map((f: any) => {
            const dias = Math.round((new Date(f.fim).getTime() - new Date(f.inicio).getTime()) / (1000*60*60*24)) + 1;
            return (
              <div key={f.id} className={`p-4 ${dark ? "border-b border-slate-700/30 last:border-0" : "border-b border-slate-100 last:border-0"}`}>
                <div className="flex justify-between">
                  <div>
                    <p className={`font-medium ${dark ? "text-white" : "text-slate-700"}`}>{formatarData(f.inicio)} → {formatarData(f.fim)}</p>
                    {f.obs && <p className="text-xs text-slate-400 mt-0.5">{f.obs}</p>}
                  </div>
                  <Badge color="blue">{dias} dias</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${dark ? "bg-slate-800 border border-slate-700" : "bg-white"}`}>
            <h3 className={`font-bold ${dark ? "text-white" : "text-slate-800"}`}>Registrar Férias</h3>
            <Input label="Data de Início" type="date" value={form.inicio} onChange={v => setForm(p=>({...p,inicio:v}))}/>
            <Input label="Data de Fim" type="date" value={form.fim} onChange={v => setForm(p=>({...p,fim:v}))}/>
            <Input label="Observação (opcional)" value={form.obs} onChange={v => setForm(p=>({...p,obs:v}))}/>
            <div className="flex gap-3">
              <Btn onClick={adicionarFerias} className="flex-1" variant="success">Salvar</Btn>
              <Btn variant="secondary" onClick={() => setMostrarForm(false)} className="flex-1">Cancelar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA: CONFIGURAÇÕES + BACKUP
// ============================================================
function TelaConfig({ config, setConfig, registros, setRegistros, financeiro, setFinanceiro, ferias, setFerias, dark, setDark }: {
  config: typeof DEFAULT_CONFIG; setConfig: (v: any) => void; registros: any; setRegistros: (v: any) => void;
  financeiro: any; setFinanceiro: (v: any) => void; ferias: any; setFerias: (v: any) => void;
  dark: boolean; setDark: (v: boolean) => void;
}) {
  const [aba, setAba] = useState("perfil");
  const [importAlert, setImportAlert] = useState("");

  function exportar() {
    const dados = { config, registros, financeiro, ferias, exportadoEm: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `meuponto_backup_${hojeStr()}.json`; a.click();
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.config) setConfig(d.config);
        if (d.registros) setRegistros(d.registros);
        if (d.financeiro) setFinanceiro(d.financeiro);
        if (d.ferias) setFerias(d.ferias);
        setImportAlert("✅ Backup importado com sucesso!");
      } catch { setImportAlert("❌ Arquivo inválido."); }
      setTimeout(() => setImportAlert(""), 3000);
    };
    reader.readAsText(file);
  }

  const abas = [
    { key: "perfil", label: "Perfil" },
    { key: "escala", label: "Escala" },
    { key: "backup", label: "Backup" },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className={`flex gap-1 p-1 rounded-xl ${dark ? "bg-slate-800/50" : "bg-slate-100"}`}>
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200
            ${aba === a.key ? "bg-blue-600 text-white shadow" : dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "perfil" && (
        <Card className={`p-5 space-y-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <div className="flex justify-between items-center">
            <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Dados Pessoais</h3>
            <Toggle value={dark} onChange={setDark} label={dark ? "🌙" : "☀️"}/>
          </div>
          <Input label="Seu nome" value={config.nome} onChange={v => setConfig((p: any)=>({...p,nome:v}))} placeholder="Ex: João da Silva"/>
          <Input label="Empresa" value={config.empresa} onChange={v => setConfig((p: any)=>({...p,empresa:v}))} placeholder="Ex: Empresa LTDA"/>
          <Input label="Cargo" value={config.cargo} onChange={v => setConfig((p: any)=>({...p,cargo:v}))} placeholder="Ex: Analista"/>
          <Input label="Data de admissão" type="date" value={config.admissao} onChange={v => setConfig((p: any)=>({...p,admissao:v}))}/>
          <Input label="Salário bruto (R$)" type="number" value={config.salarioBruto} onChange={v => setConfig((p: any)=>({...p,salarioBruto:v}))} placeholder="Ex: 3500"/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dia pagamento" type="number" value={config.pagamentoDia} onChange={v => setConfig((p: any)=>({...p,pagamentoDia:v}))}/>
            <Input label="Dia adiantamento" type="number" value={config.adiantamentoDia} onChange={v => setConfig((p: any)=>({...p,adiantamentoDia:v}))}/>
          </div>
          <Select label="Adicional hora extra" value={config.adicionalHE} onChange={v => setConfig((p: any)=>({...p,adicionalHE:Number(v)}))}
            options={[{value:50,label:"50% (padrão CLT)"},{value:100,label:"100% (folga/feriado)"}]}/>
          <Input label="Tolerância de ponto (minutos)" type="number" value={config.tolerancia} onChange={v => setConfig((p: any)=>({...p,tolerancia:Number(v)}))}/>
        </Card>
      )}

      {aba === "escala" && (
        <Card className={`p-5 space-y-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
          <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Escala de Trabalho</h3>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Dias da Semana</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS_SEMANA.map((d, i) => (
                <button key={i} onClick={() => {
                  const dias = config.escala.dias.includes(i) ? config.escala.dias.filter((x: number)=>x!==i) : [...config.escala.dias, i];
                  setConfig((p: any) => ({...p, escala: {...p.escala, dias}}));
                }} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${config.escala.dias.includes(i) ? "bg-blue-600 text-white" : dark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Entrada" type="time" value={config.escala.entrada} onChange={v => setConfig((p: any)=>({...p,escala:{...p.escala,entrada:v}}))}/>
            <Input label="Saída Almoço" type="time" value={config.escala.saidaAlmoco} onChange={v => setConfig((p: any)=>({...p,escala:{...p.escala,saidaAlmoco:v}}))}/>
            <Input label="Volta Almoço" type="time" value={config.escala.voltaAlmoco} onChange={v => setConfig((p: any)=>({...p,escala:{...p.escala,voltaAlmoco:v}}))}/>
            <Input label="Saída" type="time" value={config.escala.saida} onChange={v => setConfig((p: any)=>({...p,escala:{...p.escala,saida:v}}))}/>
          </div>
          <Input label="Dia de fechamento do período" type="number" value={config.fechamentoDia} onChange={v => setConfig((p: any)=>({...p,fechamentoDia:Number(v)}))} hint="Ex: 25 para fechar todo dia 25"/>
        </Card>
      )}

      {aba === "backup" && (
        <div className="space-y-4">
          <Card className={`p-5 space-y-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <Icon name="download" size={18} className="text-blue-400"/>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Exportar Backup</h3>
            </div>
            <p className="text-sm text-slate-400">Baixa um arquivo JSON com todos os seus dados. Guarde em local seguro.</p>
            <Btn onClick={exportar} className="w-full" size="lg">
              <Icon name="download" size={18}/> Baixar Backup JSON
            </Btn>
          </Card>

          <Card className={`p-5 space-y-4 border-slate-700/50 ${dark ? "bg-slate-800/50" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <Icon name="upload" size={18} className="text-emerald-400"/>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Importar Backup</h3>
            </div>
            <p className="text-sm text-slate-400">Restaura seus dados a partir de um backup JSON anteriormente exportado.</p>
            <label className={`block w-full py-3 px-5 rounded-xl text-center text-sm font-semibold border-2 border-dashed cursor-pointer transition-all
              ${dark ? "border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400" : "border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600"}`}>
              <Icon name="upload" size={18} className="inline mr-2 -mt-0.5"/>
              Selecionar arquivo JSON
              <input type="file" accept=".json" onChange={importar} className="hidden"/>
            </label>
            {importAlert && <div className={`text-sm text-center py-2 px-3 rounded-xl ${importAlert.includes("✅") ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{importAlert}</div>}
          </Card>

          <Card className={`p-5 border-red-500/20 ${dark ? "bg-red-900/10" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="info" size={16} className="text-red-400"/>
              <span className="text-sm font-semibold text-red-400">Privacidade</span>
            </div>
            <p className="text-xs text-slate-400">Todos os dados ficam armazenados localmente no seu dispositivo (localStorage). Nenhuma informação é enviada para servidores externos.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function MeuPonto() {
  const [config, setConfig] = useLocalStorage("mp_config", DEFAULT_CONFIG);
  const [registros, setRegistros] = useLocalStorage("mp_registros", {});
  const [financeiro, setFinanceiro] = useLocalStorage("mp_financeiro", { recebimentos: [] });
  const [ferias, setFerias] = useLocalStorage("mp_ferias", { historico: [] });

  // ✅ CORREÇÃO: dark mode inicia como true (padrão) e só lê localStorage no cliente via useEffect
  const [dark, setDark] = useState(true);
  const [aba, setAba] = useState("home");

  useEffect(() => {
    try {
      const c = localStorage.getItem("mp_config");
      if (c) setDark(JSON.parse(c).darkMode !== false);
    } catch {}
  }, []);

  useEffect(() => { setConfig((p: any) => ({...p, darkMode: dark})); }, [dark]);

  const navItems = [
    { key: "home", icon: "home", label: "Início" },
    { key: "ponto", icon: "clock", label: "Ponto" },
    { key: "financeiro", icon: "dollar", label: "Financeiro" },
    { key: "ferias", icon: "beach", label: "Férias" },
    { key: "config", icon: "settings", label: "Config" },
  ];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${dark ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"}`}
      style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10 ${dark ? "bg-blue-600" : "bg-blue-300"}`}/>
        <div className={`absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-8 ${dark ? "bg-indigo-800" : "bg-indigo-200"}`}/>
      </div>

      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${dark ? "bg-slate-900/80 border-slate-700/50" : "bg-white/80 border-slate-200"}`}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Icon name="clock" size={16} className="text-white"/>
            </div>
            <span className="font-bold text-base tracking-tight">MeuPonto</span>
          </div>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-xl transition-colors ${dark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
            <Icon name={dark ? "sun" : "moon"} size={18}/>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 pb-24 relative">
        {aba === "home" && <Dashboard config={config} registros={registros} dark={dark}/>}
        {aba === "ponto" && <TelaPonto config={config} registros={registros} setRegistros={setRegistros} dark={dark}/>}
        {aba === "financeiro" && <TelaFinanceiro config={config} financeiro={financeiro} setFinanceiro={setFinanceiro} dark={dark}/>}
        {aba === "ferias" && <TelaFerias config={config} ferias={ferias} setFerias={setFerias} dark={dark}/>}
        {aba === "config" && <TelaConfig config={config} setConfig={setConfig} registros={registros} setRegistros={setRegistros} financeiro={financeiro} setFinanceiro={setFinanceiro} ferias={ferias} setFerias={setFerias} dark={dark} setDark={setDark}/>}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t transition-colors ${dark ? "bg-slate-900/90 border-slate-700/50" : "bg-white/90 border-slate-200"}`}>
        <div className="max-w-lg mx-auto flex">
          {navItems.map(item => (
            <button key={item.key} onClick={() => setAba(item.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200
                ${aba === item.key ? "text-blue-500" : dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${aba === item.key ? "bg-blue-500/15 scale-110" : ""}`}>
                <Icon name={item.icon} size={20}/>
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}