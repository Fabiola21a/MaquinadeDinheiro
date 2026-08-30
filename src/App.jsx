import React, { useState, useMemo } from "react";
import {
  Upload, Smartphone, Activity, Radio, RotateCcw,
  Play, Pause, AlertTriangle, ChevronRight, ChevronDown, Plus, CheckCircle2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .zap-display { font-family: 'Space Grotesk', sans-serif; }
    .zap-body { font-family: 'Inter', system-ui, sans-serif; }
    .zap-mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes zap-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    .zap-live { animation: zap-pulse 1.6s ease-in-out infinite; }
  `}</style>
);

// ---- mock data (preview — dados reais virão do Supabase em produção) ----
const NICHOS_EXISTENTES = ["BR", "US"];
const CATALOGO_POR_NICHO = { BR: 3400, US: 1412 };

const NUMEROS = [
  { id: 1, instancia: "zap-01", nicho: "BR", status: "ativo",     entrou: 940,  limite: 1000, hoje: 74,  meta_dia: 100 },
  { id: 2, instancia: "zap-02", nicho: "BR", status: "ativo",     entrou: 612,  limite: 1000, hoje: 100, meta_dia: 100 },
  { id: 3, instancia: "zap-03", nicho: "BR", status: "aquecendo", entrou: 180,  limite: 1000, hoje: 41,  meta_dia: 100 },
  { id: 4, instancia: "zap-04", nicho: "BR", status: "cheio",     entrou: 1000, limite: 1000, hoje: 0,   meta_dia: 100 },
  { id: 5, instancia: "zap-05", nicho: "BR", status: "banido",    entrou: 337,  limite: 1000, hoje: 0,   meta_dia: 100 },
  { id: 6, instancia: "zap-06", nicho: "US", status: "ativo",     entrou: 205,  limite: 1000, hoje: 88,  meta_dia: 100 },
];

const RITMO_7D = [
  { dia: "23/08", entradas: 480 },
  { dia: "24/08", entradas: 512 },
  { dia: "25/08", entradas: 397 },
  { dia: "26/08", entradas: 505 },
  { dia: "27/08", entradas: 460 },
  { dia: "28/08", entradas: 420 },
  { dia: "29/08", entradas: 303 },
];

const C = {
  bg: "#0A0C0E", panel: "#12151A", line: "rgba(255,255,255,0.07)",
  ativo: "#35C48A", aquecendo: "#E3A83B", cheio: "#5E7A93", banido: "#E15850", pausado: "#6B7280",
  text: "#ECEEF2", sub: "#8A93A3",
};

const STATUS_STYLE = {
  ativo:     { color: C.ativo,     label: "ativo" },
  aquecendo: { color: C.aquecendo, label: "aquecendo" },
  cheio:     { color: C.cheio,     label: "cheio" },
  banido:    { color: C.banido,    label: "banido" },
  pausado:   { color: C.pausado,   label: "pausado" },
};

function Led({ color, live = false }) {
  return <span className={`inline-block h-[7px] w-[7px] rounded-full ${live ? "zap-live" : ""}`} style={{ background: color, boxShadow: `0 0 6px ${color}99` }} />;
}

function Dosimeter({ value, max }) {
  const segments = 20;
  const filled = Math.round((value / max) * segments);
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className="h-3 w-[4px] rounded-[1px]" style={{ background: i < filled ? C.ativo : "rgba(255,255,255,0.09)" }} />
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pausado;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-[3px] text-[11px] tracking-wide zap-mono uppercase" style={{ color: s.color }}>
      <Led color={s.color} live={status === "ativo"} />
      {s.label}
    </span>
  );
}

function NichoTag({ nicho }) {
  return (
    <span className="px-1.5 py-[2px] rounded-[3px] text-[10px] zap-mono uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.06)", color: C.sub }}>
      {nicho}
    </span>
  );
}

function CoverageStrip() {
  const total = NUMEROS.reduce((a, n) => a + n.entrou, 0);
  const catalogoTotal = Object.values(CATALOGO_POR_NICHO).reduce((a, b) => a + b, 0);
  const pct = total / catalogoTotal;
  const ticks = 25;
  return (
    <div className="rounded-[6px] px-6 py-5 mb-8" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[10px] zap-mono uppercase tracking-[0.16em] mb-1.5" style={{ color: C.sub }}>Cobertura do catálogo</div>
          <div className="flex items-baseline gap-2">
            <span className="zap-display text-[32px] leading-none font-semibold zap-mono tabular-nums" style={{ color: C.text }}>{total.toLocaleString("pt-BR")}</span>
            <span className="text-[15px] zap-mono" style={{ color: C.sub }}>/ {catalogoTotal.toLocaleString("pt-BR")} grupos</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {NUMEROS.map((n) => (
            <div key={n.id} title={`${n.instancia} · ${n.nicho} · ${STATUS_STYLE[n.status].label}`} className="w-[10px] h-6 rounded-[2px]" style={{ background: STATUS_STYLE[n.status].color, opacity: n.status === "cheio" ? 0.5 : 1 }} />
          ))}
        </div>
      </div>
      <div className="relative h-[6px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct * 100}%`, background: C.ativo }} />
        <div className="absolute inset-0 flex justify-between px-[1px]">
          {Array.from({ length: ticks }).map((_, i) => <div key={i} className="w-px h-full" style={{ background: "rgba(10,12,14,0.5)" }} />)}
        </div>
      </div>
    </div>
  );
}

function Nav({ tab, setTab }) {
  const items = [
    { id: "importar", label: "Importar grupos", icon: Upload, n: "01" },
    { id: "numeros", label: "Números", icon: Smartphone, n: "02" },
    { id: "progresso", label: "Progresso de entrada", icon: Activity, n: "03" },
    { id: "operacao", label: "Operação", icon: Radio, n: "04" },
  ];
  return (
    <div className="w-[236px] shrink-0 pr-5" style={{ borderRight: `1px solid ${C.line}` }}>
      <div className="mb-9 pl-1">
        <div className="zap-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: C.sub }}>Torre de controle</div>
        <div className="zap-display text-[16px] font-medium mt-1" style={{ color: C.text }}>Máquina de Dinheiro</div>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="flex items-center gap-3 px-2 py-2.5 rounded-[4px] text-left transition-colors" style={{ background: active ? "rgba(255,255,255,0.05)" : "transparent", color: active ? C.text : C.sub }}>
              <span className="zap-mono text-[10px]" style={{ color: active ? C.ativo : "rgba(255,255,255,0.2)" }}>{it.n}</span>
              <Icon size={14} strokeWidth={1.75} />
              <span className="text-[13px] zap-body flex-1">{it.label}</span>
              {active && <ChevronRight size={12} style={{ color: C.sub }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-[6px] ${className}`} style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${C.line}` }}>{children}</div>;
}

function Header({ title, sub }) {
  return (
    <div className="mb-6">
      <h1 className="zap-display text-[17px] font-medium mb-1" style={{ color: C.text }}>{title}</h1>
      <p className="text-[13px] zap-body" style={{ color: C.sub }}>{sub}</p>
    </div>
  );
}

function NichoSelector({ value, onChange }) {
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNicho, setNovoNicho] = useState("");

  if (criandoNovo) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={novoNicho}
          onChange={(e) => setNovoNicho(e.target.value.toUpperCase())}
          placeholder="ex: FR, ES, MX..."
          className="px-3 py-2 rounded-[4px] text-[13px] zap-mono outline-none w-32"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.ativo}55`, color: C.text }}
        />
        <button
          onClick={() => { if (novoNicho.trim()) { onChange(novoNicho.trim()); setCriandoNovo(false); setNovoNicho(""); } }}
          className="text-[12px] px-2.5 py-2 rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B" }}
        >
          Criar
        </button>
        <button onClick={() => setCriandoNovo(false)} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {NICHOS_EXISTENTES.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono uppercase transition-colors"
          style={{
            border: `1px solid ${value === n ? C.ativo : C.line}`,
            background: value === n ? "rgba(53,196,138,0.1)" : "transparent",
            color: value === n ? C.ativo : C.sub,
          }}
        >
          {value === n && <CheckCircle2 size={11} className="inline mr-1 -mt-0.5" />}
          {n} <span style={{ color: C.sub, opacity: 0.7 }}>· {CATALOGO_POR_NICHO[n]?.toLocaleString("pt-BR") ?? 0}</span>
        </button>
      ))}
      <button onClick={() => setCriandoNovo(true)} className="flex items-center gap-1 px-3 py-2 rounded-[4px] text-[12px] zap-body transition-colors" style={{ border: `1px dashed ${C.line}`, color: C.sub }}>
        <Plus size={12} /> novo nicho
      </button>
    </div>
  );
}

function ImportarTab() {
  const [links, setLinks] = useState("");
  const [nicho, setNicho] = useState(null);
  const count = links.split("\n").map((l) => l.trim()).filter(Boolean).length;

  return (
    <div className="max-w-[680px]">
      <Header title="Importar grupos" sub="Cole os links de convite (um por linha) ou envie a planilha exportada. Duplicados são ignorados." />
      <Card className="p-5 mb-4">
        <div className="mb-5">
          <div className="text-[12px] zap-body mb-2.5" style={{ color: C.text }}>
            Nicho desses grupos <span style={{ color: C.sub }}>— obrigatório</span>
          </div>
          <NichoSelector value={nicho} onChange={setNicho} />
          {!nicho && (
            <div className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: C.aquecendo }}>
              <AlertTriangle size={11} /> selecione um nicho existente ou crie um novo antes de importar
            </div>
          )}
        </div>

        <div className="rounded-[4px] py-8 flex flex-col items-center justify-center mb-4" style={{ border: `1px dashed ${C.line}` }}>
          <Upload size={20} className="mb-2" style={{ color: C.sub, opacity: 0.6 }} strokeWidth={1.5} />
          <div className="text-[13px] zap-body" style={{ color: C.sub }}>Arraste o arquivo .xlsx ou .csv aqui</div>
          <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>ou cole os links abaixo</div>
        </div>
        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="w-full h-32 rounded-[4px] px-3 py-2 text-[12px] zap-mono outline-none resize-none"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] zap-mono" style={{ color: C.sub }}>{count} {count === 1 ? "link detectado" : "links detectados"}</span>
          <button
            disabled={!nicho || count === 0}
            className="px-4 py-2 text-[13px] rounded-[4px] font-medium zap-body transition-opacity"
            style={{ background: C.ativo, color: "#06110B", opacity: !nicho || count === 0 ? 0.35 : 1, cursor: !nicho || count === 0 ? "not-allowed" : "pointer" }}
          >
            Importar para o catálogo {nicho ? `· ${nicho}` : ""}
          </button>
        </div>
      </Card>
    </div>
  );
}

function NichoBlock({ nicho, numeros }) {
  const [aberto, setAberto] = useState(true);
  const totalCatalogo = CATALOGO_POR_NICHO[nicho] ?? 0;
  const cobertos = numeros.reduce((a, n) => a + n.entrou, 0);
  const semNumero = Math.max(totalCatalogo - cobertos, 0);
  const capacidadeDisponivel = numeros
    .filter((n) => n.status === "ativo" || n.status === "aquecendo")
    .reduce((a, n) => a + (n.limite - n.entrou), 0);
  const faltaCapacidade = Math.max(semNumero - capacidadeDisponivel, 0);
  const numerosASugerir = Math.ceil(faltaCapacidade / 1000);

  return (
    <Card className="mb-4 overflow-hidden">
      <button onClick={() => setAberto((a) => !a)} className="w-full flex items-center justify-between px-4 py-3.5" style={{ borderBottom: aberto ? `1px solid ${C.line}` : "none" }}>
        <div className="flex items-center gap-3">
          <ChevronDown size={14} style={{ color: C.sub, transform: aberto ? "none" : "rotate(-90deg)" }} />
          <span className="zap-display text-[14px] font-medium" style={{ color: C.text }}>{nicho}</span>
          <span className="text-[11px] zap-mono" style={{ color: C.sub }}>{numeros.length} números</span>
        </div>
        <div className="flex items-center gap-5 text-[12px] zap-mono">
          <span style={{ color: C.sub }}>
            cobertos <span style={{ color: C.text }}>{cobertos.toLocaleString("pt-BR")}</span> / {totalCatalogo.toLocaleString("pt-BR")}
          </span>
          <span style={{ color: semNumero > 0 ? C.aquecendo : C.sub }}>
            sem número <span className="font-semibold">{semNumero.toLocaleString("pt-BR")}</span>
          </span>
          {faltaCapacidade > 0 ? (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-[3px]" style={{ color: C.banido, background: "rgba(225,88,80,0.1)" }}>
              <AlertTriangle size={11} /> comprar +{numerosASugerir} número{numerosASugerir > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-[3px]" style={{ color: C.ativo, background: "rgba(53,196,138,0.1)" }}>
              <CheckCircle2 size={11} /> capacidade atual cobre o resto
            </span>
          )}
        </div>
      </button>

      {aberto && (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left zap-mono text-[10px] uppercase tracking-wide" style={{ color: C.sub }}>
              <th className="px-4 py-3 font-normal">Instância</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Grupos</th>
              <th className="px-4 py-3 font-normal">Ritmo hoje</th>
              <th className="px-4 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {numeros.map((n) => (
              <tr key={n.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.instancia}</td>
                <td className="px-4 py-3"><StatusPill status={n.status} /></td>
                <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>
                  {n.entrou.toLocaleString("pt-BR")}<span style={{ color: C.sub }}> / {n.limite.toLocaleString("pt-BR")}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Dosimeter value={n.hoje} max={n.meta_dia} />
                    <span className="zap-mono text-[11px]" style={{ color: C.sub }}>{n.hoje}/{n.meta_dia}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {n.status === "banido" && (
                    <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body" style={{ border: `1px solid ${C.banido}55`, color: C.banido }}>
                      <RotateCcw size={12} strokeWidth={2} /> Recuperar número
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function NumerosTab() {
  const porNicho = useMemo(() => {
    const grupos = {};
    NUMEROS.forEach((n) => { (grupos[n.nicho] ||= []).push(n); });
    return grupos;
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Header title="Números" sub={`${NUMEROS.length} números cadastrados · limite de 1.000 grupos e 100 entradas/dia cada, por nicho`} />
        <button className="px-3 py-2 text-[12px] rounded-[4px] zap-body transition-colors shrink-0" style={{ border: `1px solid ${C.line}`, color: C.sub }}>
          + Cadastrar número
        </button>
      </div>
      {Object.entries(porNicho).map(([nicho, numeros]) => (
        <NichoBlock key={nicho} nicho={nicho} numeros={numeros} />
      ))}
    </div>
  );
}

function ProgressoTab() {
  const total = NUMEROS.reduce((a, n) => a + n.entrou, 0);
  const catalogoTotal = Object.values(CATALOGO_POR_NICHO).reduce((a, b) => a + b, 0);
  return (
    <div>
      <Header title="Progresso de entrada" sub={`${total.toLocaleString("pt-BR")} de ${catalogoTotal.toLocaleString("pt-BR")} grupos do catálogo já têm um número dentro`} />
      <Card className="p-5 mb-4">
        <div className="zap-mono text-[10px] uppercase tracking-wide mb-3" style={{ color: C.sub }}>Entradas por dia — últimos 7 dias</div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={RITMO_7D} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
              <Line type="monotone" dataKey="entradas" stroke={C.ativo} strokeWidth={2} dot={{ r: 3, fill: C.ativo }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left zap-mono text-[10px] uppercase tracking-wide" style={{ color: C.sub }}>
              <th className="px-4 py-3 font-normal">Instância</th>
              <th className="px-4 py-3 font-normal">Nicho</th>
              <th className="px-4 py-3 font-normal">Entrou</th>
              <th className="px-4 py-3 font-normal">Faltam</th>
              <th className="px-4 py-3 font-normal">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {NUMEROS.map((n) => {
              const pct = Math.round((n.entrou / n.limite) * 100);
              return (
                <tr key={n.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.instancia}</td>
                  <td className="px-4 py-3"><NichoTag nicho={n.nicho} /></td>
                  <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.entrou}</td>
                  <td className="px-4 py-3 zap-mono" style={{ color: C.sub }}>{n.limite - n.entrou}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-40">
                      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STATUS_STYLE[n.status]?.color ?? C.ativo }} />
                      </div>
                      <span className="text-[11px] zap-mono w-8" style={{ color: C.sub }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function OperacaoTab() {
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState(true);
  const [nicho, setNicho] = useState("BR");
  return (
    <div className="max-w-[680px]">
      <Header title="Operação" sub="Disparo contínuo por nicho. Você pode ter mais de um anúncio rodando ao mesmo tempo, um por nicho." />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Led color={rodando ? C.ativo : C.pausado} live={rodando} />
            <span className="text-[13px] zap-body" style={{ color: C.text }}>{rodando ? "Transmitindo" : "Pausado"}</span>
          </div>
          <span className="text-[11px] zap-mono" style={{ color: C.sub }}>ciclo 03</span>
        </div>
        <div className="mb-4">
          <div className="text-[12px] zap-body mb-2" style={{ color: C.sub }}>Nicho deste anúncio</div>
          <div className="flex gap-2">
            {NICHOS_EXISTENTES.map((n) => (
              <button key={n} onClick={() => setNicho(n)} className="px-3 py-1.5 rounded-[4px] text-[12px] zap-mono uppercase" style={{ border: `1px solid ${nicho === n ? C.ativo : C.line}`, background: nicho === n ? "rgba(53,196,138,0.1)" : "transparent", color: nicho === n ? C.ativo : C.sub }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={`Mensagem para os grupos do nicho ${nicho}...`}
          className="w-full h-24 rounded-[4px] px-3 py-2 text-[13px] zap-body outline-none resize-none mb-4"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        />
        <button
          onClick={() => setRodando((r) => !r)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[4px] text-[13px] font-medium zap-body transition-opacity hover:opacity-90"
          style={{ background: rodando ? "rgba(255,255,255,0.06)" : C.ativo, color: rodando ? C.text : "#06110B" }}
        >
          {rodando ? <Pause size={14} /> : <Play size={14} />}
          {rodando ? "Pausar disparo" : `Iniciar disparo contínuo · ${nicho}`}
        </button>
      </Card>

      <div className="text-[11px] zap-mono uppercase tracking-wide mb-2" style={{ color: C.sub }}>Anúncios ativos agora</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Led color={C.ativo} live />
            <span className="text-[12px] zap-mono">BR · ciclo 03</span>
          </div>
          <span className="text-[11px] zap-mono" style={{ color: C.sub }}>2.184 enviados</span>
        </Card>
        <Card className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Led color={C.pausado} />
            <span className="text-[12px] zap-mono">US · pausado</span>
          </div>
          <span className="text-[11px] zap-mono" style={{ color: C.sub }}>140 enviados</span>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] zap-mono uppercase tracking-wide mb-1.5" style={{ color: C.sub }}>Enviados no ciclo</div>
          <div className="text-xl zap-mono" style={{ color: C.text }}>2.184</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] zap-mono uppercase tracking-wide mb-1.5" style={{ color: C.sub }}>Total de grupos ({nicho})</div>
          <div className="text-xl zap-mono" style={{ color: C.text }}>2.274</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] zap-mono uppercase tracking-wide mb-1.5" style={{ color: C.sub }}>Taxa de erro</div>
          <div className="text-xl zap-mono flex items-center gap-1.5" style={{ color: C.aquecendo }}><AlertTriangle size={14} />1.3%</div>
        </Card>
      </div>
    </div>
  );
}

export default function ZapAdminPreview() {
  const [tab, setTab] = useState("numeros");
  const Content = useMemo(() => {
    switch (tab) {
      case "importar": return ImportarTab;
      case "progresso": return ProgressoTab;
      case "operacao": return OperacaoTab;
      default: return NumerosTab;
    }
  }, [tab]);

  return (
    <div className="min-h-screen w-full zap-body" style={{ background: C.bg, color: C.text }}>
      {FONTS}
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <CoverageStrip />
        <div className="flex gap-8">
          <Nav tab={tab} setTab={setTab} />
          <div className="flex-1 min-w-0"><Content /></div>
        </div>
      </div>
    </div>
  );
}
