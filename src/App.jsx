import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Upload, Smartphone, Activity, Radio, RotateCcw,
  Play, Pause, AlertTriangle, ChevronRight, ChevronDown, Plus, CheckCircle2, Loader2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./lib/supabaseClient";

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .zap-display { font-family: 'Space Grotesk', sans-serif; }
    .zap-body { font-family: 'Inter', system-ui, sans-serif; }
    .zap-mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes zap-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    .zap-live { animation: zap-pulse 1.6s ease-in-out infinite; }
    @keyframes zap-spin { to { transform: rotate(360deg); } }
    .zap-spin { animation: zap-spin 0.8s linear infinite; }
  `}</style>
);

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

// ---------- data layer ----------

function useZapData() {
  const [nichos, setNichos] = useState([]);
  const [numeros, setNumeros] = useState([]);
  const [cobertura, setCobertura] = useState([]);
  const [diarias, setDiarias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [n, num, cov, dia] = await Promise.all([
        supabase.from("zap_nichos").select("id, nome").order("nome"),
        supabase.from("zap_vw_numeros").select("*").order("instancia"),
        supabase.from("zap_vw_nichos_cobertura").select("*"),
        supabase.from("zap_vw_entradas_diarias").select("*").order("dia", { ascending: true }),
      ]);
      if (n.error) throw n.error;
      if (num.error) throw num.error;
      if (cov.error) throw cov.error;
      if (dia.error) throw dia.error;
      setNichos(n.data ?? []);
      setNumeros(num.data ?? []);
      setCobertura(cov.data ?? []);
      setDiarias(dia.data ?? []);
    } catch (e) {
      setErro(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return { nichos, numeros, cobertura, diarias, loading, erro, recarregar: carregar };
}

// ---------- ui bits ----------

function Led({ color, live = false }) {
  return <span className={`inline-block h-[7px] w-[7px] rounded-full ${live ? "zap-live" : ""}`} style={{ background: color, boxShadow: `0 0 6px ${color}99` }} />;
}

function Dosimeter({ value, max }) {
  const segments = 20;
  const filled = Math.round((value / Math.max(max, 1)) * segments);
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

function StatusEditor({ numero, onChanged }) {
  const [salvando, setSalvando] = useState(false);
  const mudar = async (e) => {
    const novoStatus = e.target.value;
    if (novoStatus === numero.status) return;
    setSalvando(true);
    const { error } = await supabase.from("zap_numeros").update({ status: novoStatus }).eq("id", numero.id);
    setSalvando(false);
    if (!error) onChanged();
  };
  const cor = STATUS_STYLE[numero.status]?.color ?? C.pausado;
  return (
    <select
      value={numero.status}
      onChange={mudar}
      disabled={salvando}
      className="zap-mono text-[11px] uppercase tracking-wide rounded-[3px] pl-1.5 pr-1 py-1 outline-none cursor-pointer"
      style={{ color: cor, background: "transparent", border: `1px solid ${cor}55`, opacity: salvando ? 0.5 : 1 }}
    >
      {Object.keys(STATUS_STYLE).map((s) => (
        <option key={s} value={s} style={{ color: "#000" }}>{STATUS_STYLE[s].label}</option>
      ))}
    </select>
  );
}

function NichoTag({ nicho }) {
  return (
    <span className="px-1.5 py-[2px] rounded-[3px] text-[10px] zap-mono uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.06)", color: C.sub }}>
      {nicho}
    </span>
  );
}

function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center" style={{ color: C.sub }}>
      <Loader2 size={14} className="zap-spin" />
      <span className="text-[12px] zap-body">{label ?? "Carregando..."}</span>
    </div>
  );
}

function ErroAviso({ mensagem }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-[4px] text-[12px] zap-body mb-4" style={{ color: C.banido, background: "rgba(225,88,80,0.08)", border: `1px solid ${C.banido}33` }}>
      <AlertTriangle size={13} /> {mensagem}
    </div>
  );
}

function EmptyState({ titulo, sub }) {
  return (
    <div className="py-12 text-center">
      <div className="text-[13px] zap-body mb-1" style={{ color: C.text }}>{titulo}</div>
      <div className="text-[12px] zap-body" style={{ color: C.sub }}>{sub}</div>
    </div>
  );
}

function CoverageStrip({ numeros, cobertura, loading }) {
  const total = numeros.reduce((a, n) => a + n.entrou, 0);
  const catalogoTotal = cobertura.reduce((a, c) => a + c.total_grupos, 0);
  const pct = catalogoTotal > 0 ? total / catalogoTotal : 0;
  const ticks = 25;
  return (
    <div className="rounded-[6px] px-6 py-5 mb-8" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[10px] zap-mono uppercase tracking-[0.16em] mb-1.5" style={{ color: C.sub }}>Cobertura do catálogo</div>
          {loading ? (
            <div className="text-[13px] zap-mono" style={{ color: C.sub }}>carregando...</div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="zap-display text-[32px] leading-none font-semibold zap-mono tabular-nums" style={{ color: C.text }}>{total.toLocaleString("pt-BR")}</span>
              <span className="text-[15px] zap-mono" style={{ color: C.sub }}>/ {catalogoTotal.toLocaleString("pt-BR")} grupos</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          {numeros.map((n) => (
            <div key={n.id} title={`${n.instancia} · ${n.nicho} · ${STATUS_STYLE[n.status]?.label ?? n.status}`} className="w-[10px] h-6 rounded-[2px]" style={{ background: STATUS_STYLE[n.status]?.color ?? C.pausado, opacity: n.status === "cheio" ? 0.5 : 1 }} />
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

// ---------- Importar ----------

function NichoSelector({ nichos, value, onChange, onCriado }) {
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNicho, setNovoNicho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const criar = async () => {
    const nome = novoNicho.trim().toUpperCase();
    if (!nome) return;
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.from("zap_nichos").insert({ nome }).select().single();
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "esse nicho já existe" : error.message);
      return;
    }
    onCriado(data);
    onChange(data.id);
    setCriandoNovo(false);
    setNovoNicho("");
  };

  if (criandoNovo) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={novoNicho}
            onChange={(e) => setNovoNicho(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            placeholder="ex: FR, ES, MX..."
            className="px-3 py-2 rounded-[4px] text-[13px] zap-mono outline-none w-32"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.ativo}55`, color: C.text }}
          />
          <button onClick={criar} disabled={salvando} className="text-[12px] px-2.5 py-2 rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "criando..." : "Criar"}
          </button>
          <button onClick={() => { setCriandoNovo(false); setErro(null); }} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
        </div>
        {erro && <div className="text-[11px] mt-1.5" style={{ color: C.banido }}>{erro}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {nichos.length === 0 && (
        <span className="text-[12px] zap-body" style={{ color: C.sub }}>nenhum nicho criado ainda</span>
      )}
      {nichos.map((n) => (
        <button
          key={n.id}
          onClick={() => onChange(n.id)}
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono uppercase transition-colors"
          style={{
            border: `1px solid ${value === n.id ? C.ativo : C.line}`,
            background: value === n.id ? "rgba(53,196,138,0.1)" : "transparent",
            color: value === n.id ? C.ativo : C.sub,
          }}
        >
          {value === n.id && <CheckCircle2 size={11} className="inline mr-1 -mt-0.5" />}
          {n.nome}
        </button>
      ))}
      <button onClick={() => setCriandoNovo(true)} className="flex items-center gap-1 px-3 py-2 rounded-[4px] text-[12px] zap-body transition-colors" style={{ border: `1px dashed ${C.line}`, color: C.sub }}>
        <Plus size={12} /> novo nicho
      </button>
    </div>
  );
}

function ImportarTab({ nichos, onDadosMudaram }) {
  const [links, setLinks] = useState("");
  const [nichoId, setNichoId] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const count = links.split("\n").map((l) => l.trim()).filter(Boolean).length;

  const importar = async () => {
    const linkList = [...new Set(links.split("\n").map((l) => l.trim()).filter(Boolean))];
    if (!nichoId || linkList.length === 0) return;
    setImportando(true);
    setErro(null);
    setResultado(null);
    const rows = linkList.map((link_convite) => ({ link_convite, nicho_id: nichoId }));
    const { data, error } = await supabase
      .from("zap_grupos")
      .upsert(rows, { onConflict: "link_convite", ignoreDuplicates: true })
      .select("id");
    setImportando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    const novos = data.length;
    const repetidos = linkList.length - novos;
    setResultado({ novos, repetidos });
    setLinks("");
    onDadosMudaram();
  };

  return (
    <div className="max-w-[680px]">
      <Header title="Importar grupos" sub="Cole os links de convite (um por linha) ou envie a planilha exportada. Duplicados são ignorados." />
      <Card className="p-5 mb-4">
        <div className="mb-5">
          <div className="text-[12px] zap-body mb-2.5" style={{ color: C.text }}>
            Nicho desses grupos <span style={{ color: C.sub }}>— obrigatório</span>
          </div>
          <NichoSelector nichos={nichos} value={nichoId} onChange={setNichoId} onCriado={onDadosMudaram} />
          {!nichoId && (
            <div className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: C.aquecendo }}>
              <AlertTriangle size={11} /> selecione um nicho existente ou crie um novo antes de importar
            </div>
          )}
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
            onClick={importar}
            disabled={!nichoId || count === 0 || importando}
            className="px-4 py-2 text-[13px] rounded-[4px] font-medium zap-body transition-opacity"
            style={{ background: C.ativo, color: "#06110B", opacity: !nichoId || count === 0 || importando ? 0.35 : 1, cursor: !nichoId || count === 0 || importando ? "not-allowed" : "pointer" }}
          >
            {importando ? "importando..." : "Importar para o catálogo"}
          </button>
        </div>
        {erro && <ErroAviso mensagem={erro} />}
        {resultado !== null && (
          <div className="mt-3 space-y-1">
            <div className="text-[12px] flex items-center gap-1.5" style={{ color: C.ativo }}>
              <CheckCircle2 size={13} /> {resultado.novos} {resultado.novos === 1 ? "grupo novo importado" : "grupos novos importados"}
            </div>
            {resultado.repetidos > 0 && (
              <div className="text-[12px] flex items-center gap-1.5" style={{ color: C.sub }}>
                <AlertTriangle size={12} /> {resultado.repetidos} já {resultado.repetidos === 1 ? "estava" : "estavam"} no catálogo — ignorado{resultado.repetidos === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Números ----------

function NichoBlock({ nicho, numeros, totalCatalogo, onRecarregar }) {
  const [aberto, setAberto] = useState(true);
  const [recuperandoId, setRecuperandoId] = useState(null);
  const cobertos = numeros.reduce((a, n) => a + n.entrou, 0);
  const semNumero = Math.max(totalCatalogo - cobertos, 0);
  const capacidadeDisponivel = numeros
    .filter((n) => n.status === "ativo" || n.status === "aquecendo")
    .reduce((a, n) => a + (n.limite_grupos - n.entrou), 0);
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
        numeros.length === 0 ? (
          <div className="px-4 py-6 text-[12px] zap-body" style={{ color: C.sub }}>Nenhum número cadastrado neste nicho ainda.</div>
        ) : (
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
                <React.Fragment key={n.id}>
                  <tr style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.instancia}</td>
                    <td className="px-4 py-3"><StatusEditor numero={n} onChanged={onRecarregar} /></td>
                    <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>
                      {n.entrou.toLocaleString("pt-BR")}<span style={{ color: C.sub }}> / {n.limite_grupos.toLocaleString("pt-BR")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Dosimeter value={n.hoje} max={n.limite_entradas_dia} />
                        <span className="zap-mono text-[11px]" style={{ color: C.sub }}>{n.hoje}/{n.limite_entradas_dia}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n.status === "banido" && (
                        <button
                          onClick={() => setRecuperandoId(recuperandoId === n.id ? null : n.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body"
                          style={{ border: `1px solid ${C.banido}55`, color: C.banido }}
                        >
                          <RotateCcw size={12} strokeWidth={2} /> Recuperar número
                        </button>
                      )}
                    </td>
                  </tr>
                  {recuperandoId === n.id && (
                    <RecuperarNumeroForm
                      numeroPerdido={n}
                      onFeito={onRecarregar}
                      onFechar={() => setRecuperandoId(null)}
                    />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )
      )}
    </Card>
  );
}

function RecuperarNumeroForm({ numeroPerdido, onFeito, onFechar }) {
  const [instancia, setInstancia] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [criado, setCriado] = useState(null);
  const [metodo, setMetodo] = useState("qr");
  const [telefone, setTelefone] = useState("");

  const recuperar = async () => {
    const nome = instancia.trim();
    if (!nome) return;
    setSalvando(true);
    setErro(null);
    try {
      const { data: novoNumero, error: e1 } = await supabase
        .from("zap_numeros")
        .insert({ instancia: nome, nicho_id: numeroPerdido.nicho_id, status: "aquecendo" })
        .select()
        .single();
      if (e1) throw e1;

      const { data: gruposDoPerdido, error: e2 } = await supabase
        .from("zap_entradas")
        .select("grupo_id")
        .eq("numero_id", numeroPerdido.id)
        .eq("status", "entrou");
      if (e2) throw e2;

      if (gruposDoPerdido.length > 0) {
        const rows = gruposDoPerdido.map((g) => ({ grupo_id: g.grupo_id, numero_id: novoNumero.id, status: "pendente" }));
        const { error: e3 } = await supabase.from("zap_entradas").insert(rows);
        if (e3) throw e3;
      }

      setCriado({ instancia: nome, total: gruposDoPerdido.length });
      onFeito(gruposDoPerdido.length);
    } catch (e) {
      setErro(e.code === "23505" ? "essa instância já existe" : e.message ?? String(e));
    } finally {
      setSalvando(false);
    }
  };

  if (criado) {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: "rgba(225,88,80,0.04)" }}>
          <div className="text-[12px] mb-1" style={{ color: C.text }}>
            Conectando <span className="zap-mono">{criado.instancia}</span> · {criado.total} grupos pendentes de reentrada
          </div>
          <QrConector
            instanceName={criado.instancia}
            phoneNumber={metodo === "codigo" ? telefone.trim() : null}
            onConectado={async () => {
              await supabase.from("zap_numeros").update({ status: "ativo" }).eq("instancia", criado.instancia);
              onFeito(criado.total);
            }}
          />
          <button onClick={onFechar} className="text-[12px] mt-1" style={{ color: C.sub }}>fechar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={5} className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: "rgba(225,88,80,0.04)" }}>
        <div className="text-[12px] mb-2.5" style={{ color: C.sub }}>
          Recuperando <span className="zap-mono" style={{ color: C.text }}>{numeroPerdido.instancia}</span> — os{" "}
          <span style={{ color: C.text }}>{numeroPerdido.entrou}</span> grupos onde ele já tinha entrado vão ficar
          marcados como <span className="zap-mono">pendente</span> pro número novo, não o catálogo inteiro.
        </div>
        <MetodoConexao metodo={metodo} setMetodo={setMetodo} telefone={telefone} setTelefone={setTelefone} />
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={instancia}
            onChange={(e) => setInstancia(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && recuperar()}
            placeholder="nome do número novo (ex: zap-08)"
            className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none flex-1 max-w-[240px]"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
          />
          <button onClick={recuperar} disabled={salvando || !instancia.trim() || (metodo === "codigo" && !telefone.trim())} className="px-3 py-2 text-[12px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "recuperando..." : `Recuperar ${numeroPerdido.entrou} grupos`}
          </button>
          <button onClick={onFechar} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
        </div>
        {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
      </td>
    </tr>
  );
}

function QrConector({ instanceName, phoneNumber, onConectado }) {
  const [qr, setQr] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [status, setStatus] = useState("gerando"); // gerando | aguardando | conectado | erro
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let poll = null;

    const iniciar = async () => {
      const { data, error } = await supabase.functions.invoke("zap-evolution", {
        body: { action: "create", instanceName, phoneNumber: phoneNumber || undefined },
      });
      if (cancelado) return;
      if (error || data?.error) {
        setErro(data?.error ?? error.message);
        setStatus("erro");
        return;
      }
      setQr(data.qrcode);
      setPairingCode(data.pairingCode);
      setStatus("aguardando");

      poll = setInterval(async () => {
        const { data: s, error: e2 } = await supabase.functions.invoke("zap-evolution", {
          body: { action: "status", instanceName },
        });
        if (cancelado) return;
        if (e2 || s?.error) return;
        if (s.state === "open") {
          clearInterval(poll);
          setStatus("conectado");
          onConectado();
        }
      }, 4000);
    };

    iniciar();
    return () => { cancelado = true; if (poll) clearInterval(poll); };
  }, [instanceName, phoneNumber]);

  if (status === "erro") return <ErroAviso mensagem={`Erro ao conectar no Evolution: ${erro}`} />;
  if (status === "conectado") {
    return (
      <div className="flex items-center gap-2 text-[12px]" style={{ color: C.ativo }}>
        <CheckCircle2 size={14} /> Conectado! Número ativo.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {status === "gerando" && <Spinner label={phoneNumber ? "Gerando código..." : "Gerando QR code..."} />}
      {status === "aguardando" && pairingCode && (
        <>
          <div className="zap-mono text-[24px] tracking-[0.15em] px-4 py-2 rounded-[4px]" style={{ background: "rgba(255,255,255,0.06)", color: C.text }}>
            {pairingCode}
          </div>
          <span className="text-[11px] zap-body text-center max-w-[220px]" style={{ color: C.sub }}>
            No WhatsApp do computador: Aparelhos conectados → Conectar com número de telefone → digite esse código · verificando a cada 4s
          </span>
        </>
      )}
      {status === "aguardando" && !pairingCode && qr && (
        <>
          <img
            src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
            alt="QR code do WhatsApp"
            className="rounded-[4px]"
            style={{ width: 180, height: 180, border: `1px solid ${C.line}` }}
          />
          <span className="text-[11px] zap-body" style={{ color: C.sub }}>Escaneie no WhatsApp do celular · verificando a cada 4s</span>
        </>
      )}
      {status === "aguardando" && !pairingCode && !qr && (
        <ErroAviso mensagem="Instância criada, mas o Evolution não devolveu QR/código. Confira o painel do Evolution direto." />
      )}
    </div>
  );
}

function MetodoConexao({ metodo, setMetodo, telefone, setTelefone }) {
  return (
    <div className="mb-3">
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setMetodo("qr")}
          className="px-3 py-1.5 rounded-[4px] text-[11px] zap-mono uppercase"
          style={{ border: `1px solid ${metodo === "qr" ? C.ativo : C.line}`, background: metodo === "qr" ? "rgba(53,196,138,0.1)" : "transparent", color: metodo === "qr" ? C.ativo : C.sub }}
        >
          QR code
        </button>
        <button
          onClick={() => setMetodo("codigo")}
          className="px-3 py-1.5 rounded-[4px] text-[11px] zap-mono uppercase"
          style={{ border: `1px solid ${metodo === "codigo" ? C.ativo : C.line}`, background: metodo === "codigo" ? "rgba(53,196,138,0.1)" : "transparent", color: metodo === "codigo" ? C.ativo : C.sub }}
        >
          Código (Whatsapp no PC)
        </button>
      </div>
      {metodo === "codigo" && (
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="número com DDI, ex: 5511999999999"
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none w-full"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        />
      )}
    </div>
  );
}

function NovoNumeroForm({ nichos, onCriado, onFechar }) {
  const [instancia, setInstancia] = useState("");
  const [nichoId, setNichoId] = useState(nichos[0]?.id ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [criado, setCriado] = useState(null); // { instancia } depois de gravar no banco
  const [metodo, setMetodo] = useState("qr");
  const [telefone, setTelefone] = useState("");

  const salvar = async () => {
    if (!instancia.trim() || !nichoId) return;
    if (metodo === "codigo" && !telefone.trim()) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("zap_numeros").insert({ instancia: instancia.trim(), nicho_id: nichoId, status: "aquecendo" });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "essa instância já existe" : error.message);
      return;
    }
    setCriado({ instancia: instancia.trim() });
    onCriado();
  };

  if (criado) {
    return (
      <Card className="p-4 mb-4">
        <div className="text-[12px] mb-1" style={{ color: C.text }}>
          Conectando <span className="zap-mono">{criado.instancia}</span>
        </div>
        <QrConector
          instanceName={criado.instancia}
          phoneNumber={metodo === "codigo" ? telefone.trim() : null}
          onConectado={async () => {
            await supabase.from("zap_numeros").update({ status: "ativo" }).eq("instancia", criado.instancia);
            onCriado();
          }}
        />
        <button onClick={onFechar} className="text-[12px] mt-2" style={{ color: C.sub }}>fechar</button>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4">
      <MetodoConexao metodo={metodo} setMetodo={setMetodo} telefone={telefone} setTelefone={setTelefone} />
      <div className="flex items-center gap-3 flex-wrap">
        <input
          autoFocus
          value={instancia}
          onChange={(e) => setInstancia(e.target.value)}
          placeholder="nome da instância (ex: zap-07)"
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none flex-1 min-w-[160px]"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        />
        <select
          value={nichoId ?? ""}
          onChange={(e) => setNichoId(Number(e.target.value))}
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        >
          {nichos.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
        </select>
        <button onClick={salvar} disabled={salvando || !instancia.trim() || !nichoId || (metodo === "codigo" && !telefone.trim())} className="px-3 py-2 text-[12px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "salvando..." : "Salvar"}
        </button>
        <button onClick={onFechar} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
      </div>
      {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
    </Card>
  );
}

function NumerosTab({ nichos, numeros, cobertura, loading, onRecarregar }) {
  const [criando, setCriando] = useState(false);

  const porNicho = useMemo(() => {
    const grupos = {};
    numeros.forEach((n) => { (grupos[n.nicho] ||= []).push(n); });
    return grupos;
  }, [numeros]);

  const totalPorNicho = useMemo(() => {
    const m = {};
    cobertura.forEach((c) => { m[c.nome] = c.total_grupos; });
    return m;
  }, [cobertura]);

  const nichosComNumero = Object.keys(porNicho);
  const nichosSemNumero = nichos.filter((n) => !nichosComNumero.includes(n.nome));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Header title="Números" sub={`${numeros.length} números cadastrados · limite de 1.000 grupos e 100 entradas/dia cada, por nicho`} />
        <button onClick={() => setCriando((c) => !c)} disabled={nichos.length === 0} className="px-3 py-2 text-[12px] rounded-[4px] zap-body transition-colors shrink-0" style={{ border: `1px solid ${C.line}`, color: C.sub, opacity: nichos.length === 0 ? 0.4 : 1 }}>
          + Cadastrar número
        </button>
      </div>

      {criando && <NovoNumeroForm nichos={nichos} onCriado={onRecarregar} onFechar={() => setCriando(false)} />}

      {loading ? (
        <Spinner />
      ) : nichos.length === 0 ? (
        <EmptyState titulo="Nenhum nicho criado ainda" sub="Crie um nicho na aba Importar grupos antes de cadastrar números." />
      ) : (
        <>
          {nichosComNumero.map((nicho) => (
            <NichoBlock key={nicho} nicho={nicho} numeros={porNicho[nicho]} totalCatalogo={totalPorNicho[nicho] ?? 0} onRecarregar={onRecarregar} />
          ))}
          {nichosSemNumero.map((n) => (
            <NichoBlock key={n.id} nicho={n.nome} numeros={[]} totalCatalogo={totalPorNicho[n.nome] ?? 0} onRecarregar={onRecarregar} />
          ))}
        </>
      )}
    </div>
  );
}

// ---------- Progresso ----------

function ProgressoTab({ numeros, cobertura, diarias, loading }) {
  const total = numeros.reduce((a, n) => a + n.entrou, 0);
  const catalogoTotal = cobertura.reduce((a, c) => a + c.total_grupos, 0);

  const chartData = diarias.map((d) => ({
    dia: new Date(d.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    entradas: d.entradas,
  }));

  return (
    <div>
      <Header title="Progresso de entrada" sub={`${total.toLocaleString("pt-BR")} de ${catalogoTotal.toLocaleString("pt-BR")} grupos do catálogo já têm um número dentro`} />
      <Card className="p-5 mb-4">
        <div className="zap-mono text-[10px] uppercase tracking-wide mb-3" style={{ color: C.sub }}>Entradas por dia</div>
        {loading ? (
          <Spinner />
        ) : chartData.length === 0 ? (
          <EmptyState titulo="Ainda sem entradas registradas" sub="O gráfico aparece assim que os números começarem a entrar nos grupos." />
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
                <Line type="monotone" dataKey="entradas" stroke={C.ativo} strokeWidth={2} dot={{ r: 3, fill: C.ativo }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card>
        {loading ? (
          <Spinner />
        ) : numeros.length === 0 ? (
          <EmptyState titulo="Nenhum número cadastrado" sub="Cadastre números na aba Números para ver o progresso aqui." />
        ) : (
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
              {numeros.map((n) => {
                const pct = Math.round((n.entrou / n.limite_grupos) * 100);
                return (
                  <tr key={n.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.instancia}</td>
                    <td className="px-4 py-3"><NichoTag nicho={n.nicho} /></td>
                    <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{n.entrou}</td>
                    <td className="px-4 py-3 zap-mono" style={{ color: C.sub }}>{n.limite_grupos - n.entrou}</td>
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
        )}
      </Card>
    </div>
  );
}

// ---------- Operação (ainda mockada — combinado deixar pra depois) ----------

function OperacaoTab({ nichos }) {
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState(true);
  const [nichoNome, setNichoNome] = useState(nichos[0]?.nome ?? "");

  return (
    <div className="max-w-[680px]">
      <Header title="Operação" sub="Disparo contínuo por nicho. Você pode ter mais de um anúncio rodando ao mesmo tempo, um por nicho. (dados de exemplo — ainda não ligado)" />
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
          <div className="flex gap-2 flex-wrap">
            {nichos.length === 0 && <span className="text-[12px]" style={{ color: C.sub }}>crie um nicho primeiro</span>}
            {nichos.map((n) => (
              <button key={n.id} onClick={() => setNichoNome(n.nome)} className="px-3 py-1.5 rounded-[4px] text-[12px] zap-mono uppercase" style={{ border: `1px solid ${nichoNome === n.nome ? C.ativo : C.line}`, background: nichoNome === n.nome ? "rgba(53,196,138,0.1)" : "transparent", color: nichoNome === n.nome ? C.ativo : C.sub }}>
                {n.nome}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={`Mensagem para os grupos do nicho ${nichoNome || "..."}...`}
          className="w-full h-24 rounded-[4px] px-3 py-2 text-[13px] zap-body outline-none resize-none mb-4"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        />
        <button
          onClick={() => setRodando((r) => !r)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[4px] text-[13px] font-medium zap-body transition-opacity hover:opacity-90"
          style={{ background: rodando ? "rgba(255,255,255,0.06)" : C.ativo, color: rodando ? C.text : "#06110B" }}
        >
          {rodando ? <Pause size={14} /> : <Play size={14} />}
          {rodando ? "Pausar disparo" : `Iniciar disparo contínuo · ${nichoNome}`}
        </button>
      </Card>

      <div className="text-[11px] zap-mono uppercase tracking-wide mb-2" style={{ color: C.sub }}>Anúncios ativos agora (exemplo)</div>
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
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("numeros");
  const { nichos, numeros, cobertura, diarias, loading, erro, recarregar } = useZapData();

  const Content = useMemo(() => {
    switch (tab) {
      case "importar":
        return <ImportarTab nichos={nichos} onDadosMudaram={recarregar} />;
      case "progresso":
        return <ProgressoTab numeros={numeros} cobertura={cobertura} diarias={diarias} loading={loading} />;
      case "operacao":
        return <OperacaoTab nichos={nichos} />;
      default:
        return <NumerosTab nichos={nichos} numeros={numeros} cobertura={cobertura} loading={loading} onRecarregar={recarregar} />;
    }
  }, [tab, nichos, numeros, cobertura, diarias, loading, recarregar]);

  return (
    <div className="min-h-screen w-full zap-body" style={{ background: C.bg, color: C.text }}>
      {FONTS}
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <CoverageStrip numeros={numeros} cobertura={cobertura} loading={loading} />
        {erro && <ErroAviso mensagem={`Erro ao carregar dados: ${erro}`} />}
        <div className="flex gap-8">
          <Nav tab={tab} setTab={setTab} />
          <div className="flex-1 min-w-0">{Content}</div>
        </div>
      </div>
    </div>
  );
}
