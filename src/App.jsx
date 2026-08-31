import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Upload, Smartphone, Activity, Radio, RotateCcw,
  Play, Pause, AlertTriangle, ChevronRight, ChevronDown, Plus, CheckCircle2, Loader2, Contact, Trash2, Pencil, Zap
} from "lucide-react";
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
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [n, num, cov, dia, chp] = await Promise.all([
        supabase.from("zap_nichos").select("id, nome").order("nome"),
        supabase.from("zap_vw_numeros").select("*").order("instancia"),
        supabase.from("zap_vw_nichos_cobertura").select("*"),
        supabase.from("zap_vw_entradas_diarias").select("*").order("dia", { ascending: true }),
        supabase.from("zap_chips").select("*, zap_numeros(instancia, status)").order("criado_em"),
      ]);
      if (n.error) throw n.error;
      if (num.error) throw num.error;
      if (cov.error) throw cov.error;
      if (dia.error) throw dia.error;
      if (chp.error) throw chp.error;
      setNichos(n.data ?? []);
      setNumeros(num.data ?? []);
      setCobertura(cov.data ?? []);
      setDiarias(dia.data ?? []);
      setChips(chp.data ?? []);
    } catch (e) {
      setErro(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return { nichos, numeros, cobertura, diarias, chips, loading, erro, recarregar: carregar };
}

// ---------- ui bits ----------

function Led({ color, live = false }) {
  return <span className={`inline-block h-[7px] w-[7px] rounded-full ${live ? "zap-live" : ""}`} style={{ background: color, boxShadow: `0 0 6px ${color}99` }} />;
}

function EditableLimite({ numero, campo, onChanged }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(numero[campo]);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const novo = Number(valor);
    if (!novo || novo === numero[campo]) { setEditando(false); return; }
    setSalvando(true);

    const patch = { [campo]: novo };
    // reflete "cheio" na hora, sem esperar o próximo tick do cron — só mexe em
    // status automático (ativo/aquecendo/cheio), nunca em banido/pausado (manuais)
    if (campo === "limite_grupos" && ["ativo", "aquecendo", "cheio"].includes(numero.status)) {
      if (numero.entrou >= novo) patch.status = "cheio";
      else if (numero.status === "cheio") patch.status = "ativo";
    }

    const { error } = await supabase.from("zap_numeros").update(patch).eq("id", numero.id);
    setSalvando(false);
    setEditando(false);
    if (!error) onChanged();
  };

  if (editando) {
    return (
      <input
        autoFocus
        type="number"
        min={1}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => e.key === "Enter" && salvar()}
        disabled={salvando}
        className="w-16 px-1.5 py-0.5 rounded-[3px] zap-mono text-[11px] outline-none"
        style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${C.ativo}`, color: C.text }}
      />
    );
  }
  return (
    <button onClick={() => setEditando(true)} className="zap-mono underline decoration-dotted" style={{ color: C.sub, textUnderlineOffset: 2 }} title="clique para editar">
      {numero[campo].toLocaleString("pt-BR")}
    </button>
  );
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
        <option key={s} value={s} style={{ background: C.panel, color: C.text }}>{STATUS_STYLE[s].label}</option>
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
    { id: "chips", label: "Cadastro de números", icon: Contact, n: "01" },
    { id: "importar", label: "Importar grupos", icon: Upload, n: "02" },
    { id: "numeros", label: "Progresso de entrada", icon: Activity, n: "03" },
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

function DeletarNumeroButton({ numero, onDeletado }) {
  const [confirmando, setConfirmando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const deletar = async () => {
    setDeletando(true);
    // limpa no Evolution também (libera o nome pra reuso)
    await supabase.functions.invoke("zap-evolution", { body: { action: "delete", instanceName: numero.instancia } });
    await supabase.from("zap_entradas").delete().eq("numero_id", numero.id);
    await supabase.from("zap_numeros").delete().eq("id", numero.id);
    setDeletando(false);
    onDeletado();
  };

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[11px]" style={{ color: C.sub }}>
          apaga e os {numero.entrou} grupos voltam pra "sem número"
        </span>
        <button onClick={deletar} disabled={deletando} className="px-2 py-1 text-[11px] rounded-[4px] zap-body" style={{ background: C.banido, color: "#fff", opacity: deletando ? 0.6 : 1 }}>
          {deletando ? "..." : "confirmar"}
        </button>
        <button onClick={() => setConfirmando(false)} className="text-[11px]" style={{ color: C.sub }}>cancelar</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body"
      style={{ border: `1px solid ${C.line}`, color: C.sub }}
    >
      <RotateCcw size={12} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
      Deletar número
    </button>
  );
}

function NichoBlock({ nicho, numeros, totalCatalogo, onRecarregar }) {
  const [aberto, setAberto] = useState(true);
  const cobertos = numeros.reduce((a, n) => a + n.entrou, 0);
  const semNumero = Math.max(totalCatalogo - cobertos, 0);
  // conta simples: quantos números o nicho precisa no total (catálogo ÷ limite
  // padrão, arredondado pra cima) menos quantos já existem — conta todos os
  // números, seja qual for o status (pausado é temporário, não perde a vaga).
  const LIMITE_PADRAO_NOVO_NUMERO = 900;
  const numerosNecessarios = Math.ceil(totalCatalogo / LIMITE_PADRAO_NOVO_NUMERO);
  const numerosASugerir = Math.max(numerosNecessarios - numeros.length, 0);

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
          {numerosASugerir > 0 ? (
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
                      {n.entrou.toLocaleString("pt-BR")}<span style={{ color: C.sub }}> / </span>
                      <EditableLimite numero={n} campo="limite_grupos" onChanged={onRecarregar} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Dosimeter value={n.hoje} max={n.limite_entradas_dia} />
                        <span className="zap-mono text-[11px]" style={{ color: C.sub }}>
                          {n.hoje}/<EditableLimite numero={n} campo="limite_entradas_dia" onChanged={onRecarregar} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeletarNumeroButton numero={n} onDeletado={onRecarregar} />
                    </td>
                  </tr>
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
  const [conectando, setConectando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState(null);
  const [metodo, setMetodo] = useState("qr");
  const [telefone, setTelefone] = useState("");

  const iniciarConexao = () => {
    if (!instancia.trim()) return;
    if (metodo === "codigo" && !telefone.trim()) return;
    setErro(null);
    setConectando(true);
  };

  const cancelarConexao = async () => {
    setCancelando(true);
    await supabase.functions.invoke("zap-evolution", { body: { action: "delete", instanceName: instancia.trim() } });
    setCancelando(false);
    setConectando(false);
  };

  const salvarAposConectar = async () => {
    const nome = instancia.trim();
    try {
      const { data: novoNumero, error: e1 } = await supabase
        .from("zap_numeros")
        .insert({ instancia: nome, nicho_id: numeroPerdido.nicho_id, status: "ativo" })
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

      onFeito(gruposDoPerdido.length);
    } catch (e) {
      setErro(e.code === "23505" ? "essa instância já existe" : e.message ?? String(e));
    }
  };

  if (conectando) {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: "rgba(225,88,80,0.04)" }}>
          <div className="text-[12px] mb-1" style={{ color: C.text }}>
            Conectando <span className="zap-mono">{instancia.trim()}</span> · {numeroPerdido.entrou} grupos ficam pendentes só depois de conectar
          </div>
          <QrConector
            instanceName={instancia.trim()}
            phoneNumber={metodo === "codigo" ? telefone.trim() : null}
            onConectado={salvarAposConectar}
          />
          <button onClick={cancelarConexao} disabled={cancelando} className="text-[12px] mt-1" style={{ color: C.sub }}>
            {cancelando ? "cancelando..." : "cancelar"}
          </button>
          {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
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
            onKeyDown={(e) => e.key === "Enter" && iniciarConexao()}
            placeholder="nome do número novo (ex: zap-08)"
            className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none flex-1 max-w-[240px]"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
          />
          <button onClick={iniciarConexao} disabled={!instancia.trim() || (metodo === "codigo" && !telefone.trim())} className="px-3 py-2 text-[12px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B" }}>
            Conectar
          </button>
          <button onClick={onFechar} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
        </div>
        {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
      </td>
    </tr>
  );
}

function QrConector({ instanceName, phoneNumber, onConectado, acao = "create" }) {
  const [qr, setQr] = useState(null);
  const [qrRaw, setQrRaw] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [status, setStatus] = useState("gerando"); // gerando | aguardando | conectado | erro
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let poll = null;

    const iniciar = async () => {
      const { data, error } = await supabase.functions.invoke("zap-evolution", {
        body: { action: acao, instanceName, phoneNumber: phoneNumber || undefined },
      });
      if (cancelado) return;
      if (error || data?.error) {
        setErro(data?.error ?? error.message);
        setStatus("erro");
        return;
      }
      setQr(data.qrcode);
      setQrRaw(data.qrRaw);
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
  const qrImgSrc = qr
    ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`)
    : qrRaw
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrRaw)}`
      : null;

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
      {status === "aguardando" && !pairingCode && qrImgSrc && (
        <>
          <img
            src={qrImgSrc}
            alt="QR code do WhatsApp"
            className="rounded-[4px]"
            style={{ width: 200, height: 200, border: `1px solid ${C.line}`, background: "#fff" }}
          />
          <span className="text-[11px] zap-body" style={{ color: C.sub }}>Escaneie no WhatsApp do celular · verificando a cada 4s</span>
        </>
      )}
      {status === "aguardando" && !pairingCode && !qrImgSrc && (
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

function PuxarNumeroForm({ chips, nichos, onCriado, onFechar }) {
  const disponiveis = chips.filter(
    (c) => !c.zap_numero_id && c.nome && (!c.aquecimento_iniciado_em || c.aquecimento_concluido)
  );
  const [chipId, setChipId] = useState(disponiveis[0]?.id ?? null);
  const [nichoId, setNichoId] = useState(nichos[0]?.id ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const puxar = async () => {
    const chip = disponiveis.find((c) => c.id === chipId);
    if (!chip || !nichoId) return;
    setSalvando(true);
    setErro(null);
    const { data: novoNumero, error: e1 } = await supabase
      .from("zap_numeros")
      .insert({ instancia: chip.nome, nicho_id: nichoId, status: "aquecendo" })
      .select()
      .single();
    if (e1) {
      setSalvando(false);
      setErro(e1.code === "23505" ? "já existe uma instância com esse nome" : e1.message);
      return;
    }
    const { error: e2 } = await supabase.from("zap_chips").update({ zap_numero_id: novoNumero.id }).eq("id", chip.id);
    setSalvando(false);
    if (e2) {
      setErro(e2.message);
      return;
    }
    onCriado();
    onFechar();
  };

  if (disponiveis.length === 0) {
    return (
      <Card className="p-4 mb-4">
        <div className="text-[12px]" style={{ color: C.sub }}>
          Nenhum chip disponível pra puxar — todos já estão em uso, ou você ainda não cadastrou/conectou nenhum.
          Vá em <span style={{ color: C.text }}>Cadastro de números</span> pra criar e conectar um novo chip primeiro.
        </div>
        <button onClick={onFechar} className="text-[12px] mt-2" style={{ color: C.sub }}>fechar</button>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={chipId ?? ""}
          onChange={(e) => setChipId(Number(e.target.value))}
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none flex-1 min-w-[160px]"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        >
          {disponiveis.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel, color: C.text }}>{c.nome} · {c.numero}</option>)}
        </select>
        <select
          value={nichoId ?? ""}
          onChange={(e) => setNichoId(Number(e.target.value))}
          className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
        >
          {nichos.map((n) => <option key={n.id} value={n.id} style={{ background: C.panel, color: C.text }}>{n.nome}</option>)}
        </select>
        <button onClick={puxar} disabled={salvando || !chipId || !nichoId} className="px-3 py-2 text-[12px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "puxando..." : "Puxar número"}
        </button>
        <button onClick={onFechar} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
      </div>
      <div className="text-[11px] mt-2" style={{ color: C.sub }}>
        A conexão (QR/código) já deve estar feita no Cadastro de números — aqui só entra pro sistema de grupos.
      </div>
      {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
    </Card>
  );
}

function NumerosTab({ nichos, numeros, cobertura, chips, loading, onRecarregar }) {
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
        <Header title="Progresso de entrada" sub={`${numeros.length} números cadastrados · limite de 900 grupos e 100 entradas/dia cada, por nicho`} />
        <button onClick={() => setCriando((c) => !c)} disabled={nichos.length === 0} className="px-3 py-2 text-[12px] rounded-[4px] zap-body transition-colors shrink-0" style={{ border: `1px solid ${C.line}`, color: C.sub, opacity: nichos.length === 0 ? 0.4 : 1 }}>
          + Puxar número do cadastro
        </button>
      </div>

      {criando && <PuxarNumeroForm chips={chips} nichos={nichos} onCriado={onRecarregar} onFechar={() => setCriando(false)} />}

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

// ---------- Cadastro de números (inventário de chips) ----------

function semanaAquecimento(iniciadoEm) {
  const dias = (Date.now() - new Date(iniciadoEm).getTime()) / (24 * 60 * 60 * 1000);
  return Math.min(Math.floor(dias / 7) + 1, 4);
}

function idadeTexto(criadoEm) {
  const criado = new Date(criadoEm + "T00:00:00");
  const hoje = new Date();
  let meses = (hoje.getFullYear() - criado.getFullYear()) * 12 + (hoje.getMonth() - criado.getMonth());
  let dias = hoje.getDate() - criado.getDate();
  if (dias < 0) {
    meses -= 1;
    const diaAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
    dias += diaAnterior;
  }
  if (meses <= 0 && dias === 0) return "hoje";
  const partes = [];
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
  partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);
  return partes.join(" e ");
}

function NovoChipForm({ onCriado, onFechar }) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [local, setLocal] = useState("");
  const [criadoEm, setCriadoEm] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const salvar = async () => {
    if (!numero.trim()) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("zap_chips").insert({
      numero: numero.trim(),
      nome: nome.trim() || null,
      local: local.trim() || null,
      criado_em: criadoEm,
    });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "esse número já está cadastrado" : error.message);
      return;
    }
    onCriado();
    onFechar();
  };

  return (
    <Card className="p-4 mb-4">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="número (com DDI)" className="px-3 py-2 rounded-[4px] text-[12px] zap-mono outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} />
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="nome / apelido" className="px-3 py-2 rounded-[4px] text-[12px] zap-body outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} />
        <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="local (tablet, Memu, celular...)" className="px-3 py-2 rounded-[4px] text-[12px] zap-body outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} />
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: C.sub }}>criado em</span>
          <input type="date" value={criadoEm} onChange={(e) => setCriadoEm(e.target.value)} className="px-2 py-2 rounded-[4px] text-[12px] zap-mono outline-none flex-1" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={salvar} disabled={salvando || !numero.trim()} className="px-3 py-2 text-[12px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "salvando..." : "Salvar"}
        </button>
        <button onClick={onFechar} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
      </div>
      {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
    </Card>
  );
}

function StatusConexaoChip({ chip, onRecarregar, onEstadoChange }) {
  const [checando, setChecando] = useState(true);
  const [estado, setEstado] = useState(null); // 'open' | outro estado | null
  const [existeNoEvolution, setExisteNoEvolution] = useState(true);
  const [reconectando, setReconectando] = useState(false);
  const [metodo, setMetodo] = useState("qr");
  const [telefone, setTelefone] = useState("");

  // pra chip já vinculado, usa o nome real da instância no Evolution
  // (pode ser diferente do nome do chip, ex: "BR Market" vs "BR-Market");
  // pra chip ainda não vinculado, o nome do chip é o que vai virar a instância.
  const instancia = chip.zap_numeros?.instancia || chip.nome;

  const checar = async () => {
    if (!instancia) { setChecando(false); setEstado(null); onEstadoChange?.(null); return; }
    setChecando(true);
    const { data, error } = await supabase.functions.invoke("zap-evolution", {
      body: { action: "status", instanceName: instancia },
    });
    setChecando(false);
    if (error || data?.error) {
      setExisteNoEvolution(false);
      setEstado(null);
      onEstadoChange?.(null);
      return;
    }
    setExisteNoEvolution(true);
    setEstado(data.state);
    onEstadoChange?.(data.state);
  };

  useEffect(() => { checar(); }, [instancia]);

  if (!instancia) {
    return <span className="text-[11px] zap-mono" style={{ color: C.sub }}>defina um nome pra poder conectar</span>;
  }

  if (reconectando) {
    return (
      <div className="mt-2">
        <MetodoConexao metodo={metodo} setMetodo={setMetodo} telefone={telefone} setTelefone={setTelefone} />
        <QrConector
          acao={existeNoEvolution ? "reconnect" : "create"}
          instanceName={instancia}
          phoneNumber={metodo === "codigo" ? telefone.trim() : null}
          onConectado={async () => {
            if (chip.zap_numero_id) {
              await supabase.from("zap_numeros").update({ status: "ativo" }).eq("id", chip.zap_numero_id);
            }
            setReconectando(false);
            checar();
            onRecarregar();
          }}
        />
        <button onClick={() => setReconectando(false)} className="text-[11px]" style={{ color: C.sub }}>cancelar</button>
      </div>
    );
  }

  if (checando) {
    return <span className="text-[11px] zap-mono" style={{ color: C.sub }}>checando...</span>;
  }

  if (estado === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase" style={{ color: C.ativo }}>
        <Led color={C.ativo} /> conectado
      </span>
    );
  }

  // chip que nunca conectou precisa "amadurecer" 7 dias (contando a idade
  // cadastrada) antes de poder conectar pela primeira vez. Reconexão de um
  // chip que já existiu no Evolution antes não passa por essa trava de novo.
  const idadeDias = (Date.now() - new Date(chip.criado_em + "T00:00:00").getTime()) / (24 * 60 * 60 * 1000);
  const faltamDias = Math.ceil(7 - idadeDias);
  if (!existeNoEvolution && faltamDias > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase" style={{ color: C.sub }}>
        <Led color={C.pausado} /> amadurecendo — faltam {faltamDias} {faltamDias === 1 ? "dia" : "dias"} pra poder conectar
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase" style={{ color: C.banido }}>
        <Led color={C.banido} /> {existeNoEvolution ? "desconectado" : "não conectado"}
      </span>
      <button onClick={() => setReconectando(true)} className="text-[11px] px-2 py-1 rounded-[4px]" style={{ border: `1px solid ${C.banido}55`, color: C.banido }}>
        {existeNoEvolution ? "reconectar" : "conectar"}
      </button>
    </div>
  );
}

function ChipRow({ chip, onRecarregar }) {
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(chip.numero);
  const [nome, setNome] = useState(chip.nome ?? "");
  const [local, setLocal] = useState(chip.local ?? "");
  const [criadoEm, setCriadoEm] = useState(chip.criado_em);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [estadoConexao, setEstadoConexao] = useState(null);
  const [iniciando, setIniciando] = useState(false);

  const iniciarAquecimento = async () => {
    setIniciando(true);
    await supabase.from("zap_chips").update({ aquecimento_iniciado_em: new Date().toISOString() }).eq("id", chip.id);
    setIniciando(false);
    onRecarregar();
  };

  const salvar = async () => {
    if (!numero.trim()) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("zap_chips")
      .update({ numero: numero.trim(), nome: nome.trim() || null, local: local.trim() || null, criado_em: criadoEm })
      .eq("id", chip.id);
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "esse número já está cadastrado" : error.message);
      return;
    }
    setEditando(false);
    onRecarregar();
  };

  const deletar = async () => {
    await supabase.from("zap_chips").delete().eq("id", chip.id);
    onRecarregar();
  };

  if (editando) {
    return (
      <tr style={{ borderTop: `1px solid ${C.line}`, background: "rgba(255,255,255,0.02)" }}>
        <td className="px-4 py-2.5"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="nome" className="w-full px-2 py-1.5 rounded-[4px] text-[12px] zap-body outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} /></td>
        <td className="px-4 py-2.5"><input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="número" className="w-full px-2 py-1.5 rounded-[4px] text-[12px] zap-mono outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} /></td>
        <td className="px-4 py-2.5"><input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="local" className="w-full px-2 py-1.5 rounded-[4px] text-[12px] zap-body outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} /></td>
        <td className="px-4 py-2.5"><input type="date" value={criadoEm} onChange={(e) => setCriadoEm(e.target.value)} className="w-full px-2 py-1.5 rounded-[4px] text-[12px] zap-mono outline-none" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }} /></td>
        <td className="px-4 py-2.5" colSpan={2}>
          <div className="flex items-center gap-2">
            <button onClick={salvar} disabled={salvando || !numero.trim()} className="px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "..." : "salvar"}
            </button>
            <button onClick={() => setEditando(false)} className="text-[11px]" style={{ color: C.sub }}>cancelar</button>
            {erro && <span className="text-[11px]" style={{ color: C.banido }}>{erro}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: `1px solid ${C.line}` }}>
      <td className="px-4 py-3 zap-body" style={{ color: C.text }}>{chip.nome || <span style={{ color: C.sub }}>—</span>}</td>
      <td className="px-4 py-3 zap-mono" style={{ color: C.text }}>{chip.numero}</td>
      <td className="px-4 py-3 zap-body" style={{ color: C.sub }}>{chip.local || "—"}</td>
      <td className="px-4 py-3 zap-mono" style={{ color: C.sub }}>{idadeTexto(chip.criado_em)}</td>
      <td className="px-4 py-3">
        <div>
          {chip.zap_numeros && chip.zap_numeros.status !== "banido" ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase mb-1" style={{ color: C.ativo }}>
              <Led color={C.ativo} /> em uso ({chip.zap_numeros.instancia})
            </span>
          ) : chip.aquecimento_concluido ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase mb-1" style={{ color: C.ativo }}>
              <Led color={C.ativo} /> pronto — disponível pra puxar
            </span>
          ) : chip.aquecimento_iniciado_em ? (
            <div className="mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase" style={{ color: C.aquecendo }}>
                <Led color={C.aquecendo} /> aquecendo — semana {semanaAquecimento(chip.aquecimento_iniciado_em)}/4
              </span>
              <div className="text-[10px] zap-body mt-0.5" style={{ color: C.sub }}>
                começou {new Date(chip.aquecimento_iniciado_em).toLocaleDateString("pt-BR")}
                {chip.proxima_acao_aquecimento && ` · próxima ação ${new Date(chip.proxima_acao_aquecimento).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
          ) : (
            <div className="mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] zap-mono uppercase" style={{ color: C.sub }}>
                <Led color={C.pausado} /> aquecimento não iniciado
              </span>
              {estadoConexao === "open" && (
                <button onClick={iniciarAquecimento} disabled={iniciando} className="block mt-1 text-[11px] px-2 py-1 rounded-[4px]" style={{ border: `1px solid ${C.ativo}55`, color: C.ativo }}>
                  {iniciando ? "iniciando..." : "▶ iniciar aquecimento"}
                </button>
              )}
            </div>
          )}
          <StatusConexaoChip chip={chip} onRecarregar={onRecarregar} onEstadoChange={setEstadoConexao} />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button onClick={() => setEditando(true)} className="p-1.5 rounded-[4px]" style={{ color: C.sub }} title="editar chip">
            <Pencil size={13} />
          </button>
          <button onClick={deletar} className="p-1.5 rounded-[4px]" style={{ color: C.sub }} title="deletar chip">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ChipsTab({ chips, loading, onRecarregar }) {
  const [criando, setCriando] = useState(false);

  const disponiveis = chips.filter((c) => !c.zap_numeros || c.zap_numeros.status === "banido");
  const emUso = chips.filter((c) => c.zap_numeros && c.zap_numeros.status !== "banido");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Header title="Cadastro de números" sub={`${chips.length} chips cadastrados · ${disponiveis.length} disponíveis pra usar agora`} />
        <button onClick={() => setCriando((c) => !c)} className="px-3 py-2 text-[12px] rounded-[4px] zap-body transition-colors shrink-0" style={{ border: `1px solid ${C.line}`, color: C.sub }}>
          + Cadastrar chip
        </button>
      </div>

      {criando && <NovoChipForm onCriado={onRecarregar} onFechar={() => setCriando(false)} />}

      {loading ? (
        <Spinner />
      ) : chips.length === 0 ? (
        <EmptyState titulo="Nenhum chip cadastrado" sub="Cadastre seus números aqui pra ter um inventário de reserva." />
      ) : (
        <Card>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left zap-mono text-[10px] uppercase tracking-wide" style={{ color: C.sub }}>
                <th className="px-4 py-3 font-normal">Nome</th>
                <th className="px-4 py-3 font-normal">Número</th>
                <th className="px-4 py-3 font-normal">Local</th>
                <th className="px-4 py-3 font-normal">Idade</th>
                <th className="px-4 py-3 font-normal">Uso</th>
                <th className="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {[...emUso, ...disponiveis].map((c) => (
                <ChipRow key={c.id} chip={c} onRecarregar={onRecarregar} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------- Operação (ainda mockada — combinado deixar pra depois) ----------

function UploadImagem({ imagemUrl, setImagemUrl }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const paraBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]); // remove o prefixo data:...;base64,
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const enviar = async (file) => {
    if (!file) return;
    setEnviando(true);
    setErro(null);
    try {
      const contentBase64 = await paraBase64(file);
      const { data, error } = await supabase.functions.invoke("zap-github-upload", {
        body: { filename: file.name, contentBase64 },
      });
      if (error || data?.error) throw new Error(data?.error ?? error.message);
      setImagemUrl(data.url);
    } catch (e) {
      setErro(e.message ?? String(e));
    } finally {
      setEnviando(false);
    }
  };

  if (imagemUrl) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <img src={imagemUrl} alt="preview" className="rounded-[4px]" style={{ width: 64, height: 64, objectFit: "cover", border: `1px solid ${C.line}` }} />
        <button onClick={() => setImagemUrl("")} className="text-[12px]" style={{ color: C.sub }}>remover imagem</button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-[4px] cursor-pointer" style={{ border: `1px dashed ${C.line}` }}>
        <Upload size={16} style={{ color: C.sub }} />
        <span className="text-[12px] zap-body" style={{ color: C.sub }}>{enviando ? "enviando..." : "clique pra escolher uma imagem"}</span>
        <input type="file" accept="image/*" className="hidden" disabled={enviando} onChange={(e) => enviar(e.target.files?.[0])} />
      </label>
      {erro && <div className="text-[11px] mt-1.5" style={{ color: C.banido }}>{erro}</div>}
    </div>
  );
}

function OperacaoTab({ nichos }) {
  const [execucoes, setExecucoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [nichoId, setNichoId] = useState(nichos[0]?.id ?? null);
  const [variantes, setVariantes] = useState([""]);
  const [imagemUrl, setImagemUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [distribuicoes, setDistribuicoes] = useState({});

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("zap_disparo_execucoes")
      .select("*, zap_nichos(nome)")
      .neq("status", "concluido")
      .order("iniciado_em", { ascending: false });
    setExecucoes(data ?? []);
    setLoading(false);

    // busca a distribuição de envios por variante, pra cada execução
    const dist = {};
    for (const exec of data ?? []) {
      const { data: linhas } = await supabase
        .from("zap_disparo_log")
        .select("variante_id, zap_disparo_variantes(texto)")
        .eq("execucao_id", exec.id)
        .eq("status", "enviado")
        .not("variante_id", "is", null);
      const contagem = {};
      (linhas ?? []).forEach((l) => {
        const chave = l.zap_disparo_variantes?.texto?.slice(0, 24) ?? `#${l.variante_id}`;
        contagem[chave] = (contagem[chave] ?? 0) + 1;
      });
      dist[exec.id] = contagem;
    }
    setDistribuicoes(dist);
  };

  useEffect(() => { carregar(); }, []);

  const atualizarVariante = (i, valor) => {
    setVariantes((v) => v.map((x, idx) => (idx === i ? valor : x)));
  };
  const adicionarVariante = () => setVariantes((v) => [...v, ""]);
  const removerVariante = (i) => setVariantes((v) => v.filter((_, idx) => idx !== i));

  const iniciar = async () => {
    const textos = variantes.map((v) => v.trim()).filter(Boolean);
    if (!nichoId || textos.length === 0) return;
    setSalvando(true);
    setErro(null);
    const { data: exec, error } = await supabase.from("zap_disparo_execucoes").insert({
      nicho_id: nichoId,
      mensagem: textos[0],
      imagem_url: imagemUrl.trim() || null,
      status: "em_andamento",
      pausado: false,
    }).select().single();
    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    const { error: e2 } = await supabase.from("zap_disparo_variantes").insert(
      textos.map((texto) => ({ execucao_id: exec.id, texto }))
    );
    setSalvando(false);
    if (e2) { setErro(e2.message); return; }
    setVariantes([""]);
    setImagemUrl("");
    setCriando(false);
    carregar();
  };

  const alternarPausa = async (exec) => {
    await supabase.from("zap_disparo_execucoes").update({ pausado: !exec.pausado }).eq("id", exec.id);
    carregar();
  };

  const encerrar = async (exec) => {
    await supabase.from("zap_disparo_execucoes").update({ status: "concluido" }).eq("id", exec.id);
    carregar();
  };

  return (
    <div className="max-w-[680px]">
      <div className="flex items-center justify-between mb-6">
        <Header title="Operação" sub="Disparo contínuo por nicho — pode ter mais de um anúncio rodando ao mesmo tempo, mesmo no mesmo nicho." />
        <button onClick={() => setCriando((c) => !c)} disabled={nichos.length === 0} className="px-3 py-2 text-[12px] rounded-[4px] zap-body transition-colors shrink-0" style={{ border: `1px solid ${C.line}`, color: C.sub, opacity: nichos.length === 0 ? 0.4 : 1 }}>
          + Novo anúncio
        </button>
      </div>

      <Card className="p-4 mb-6">
        <div className="text-[10px] zap-mono uppercase tracking-wide mb-2" style={{ color: C.sub }}>Regras de segurança do disparo</div>
        <ul className="text-[12px] zap-body flex flex-col gap-1" style={{ color: C.sub }}>
          <li>• Delay de <span style={{ color: C.text }}>30 a 60 segundos</span> entre uma mensagem e outra, sempre variando (nunca fixo)</li>
          <li>• Lote de <span style={{ color: C.text }}>10 a 15 mensagens</span>, depois <span style={{ color: C.text }}>pausa de 5 a 10 minutos</span> antes de continuar</li>
          <li>• Cada envio é único: sua versão de texto + emoji/pontuação variados + caractere invisível — nunca duas mensagens idênticas</li>
          <li>• Cada anúncio pertence a <span style={{ color: C.text }}>1 nicho só</span>, mas você pode ter <span style={{ color: C.text }}>vários anúncios simultâneos</span> no mesmo nicho</li>
          <li>• Se o WhatsApp bloquear um número (rate-overlimit), ele para na hora e só tenta de novo no próximo ciclo (6h de Brasília)</li>
        </ul>
      </Card>

      {criando && (
        <Card className="p-5 mb-4">
          <div className="text-[12px] zap-body mb-2" style={{ color: C.sub }}>Nicho deste anúncio</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {nichos.map((n) => (
              <button key={n.id} onClick={() => setNichoId(n.id)} className="px-3 py-1.5 rounded-[4px] text-[12px] zap-mono uppercase" style={{ border: `1px solid ${nichoId === n.id ? C.ativo : C.line}`, background: nichoId === n.id ? "rgba(53,196,138,0.1)" : "transparent", color: nichoId === n.id ? C.ativo : C.sub }}>
                {n.nome}
              </button>
            ))}
          </div>

          <div className="text-[12px] zap-body mb-2" style={{ color: C.sub }}>Versões da mensagem (sorteia uma a cada envio)</div>
          <div className="flex flex-col gap-2 mb-2">
            {variantes.map((v, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[11px] zap-mono mt-2.5" style={{ color: C.sub }}>{i + 1}.</span>
                <textarea
                  value={v}
                  onChange={(e) => atualizarVariante(i, e.target.value)}
                  placeholder="Texto dessa versão..."
                  className="flex-1 h-16 rounded-[4px] px-3 py-2 text-[13px] zap-body outline-none resize-none"
                  style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.line}`, color: C.text }}
                />
                {variantes.length > 1 && (
                  <button onClick={() => removerVariante(i)} className="p-2 mt-1" style={{ color: C.sub }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={adicionarVariante} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.ativo }}>
            <Plus size={12} /> adicionar versão
          </button>

          <div className="text-[12px] zap-body mb-2" style={{ color: C.sub }}>Imagem (opcional)</div>
          <UploadImagem imagemUrl={imagemUrl} setImagemUrl={setImagemUrl} />

          <div className="flex items-center gap-2 mt-4">
            <button onClick={iniciar} disabled={salvando || !nichoId || variantes.every((v) => !v.trim())} className="px-4 py-2 text-[13px] rounded-[4px] font-medium zap-body" style={{ background: C.ativo, color: "#06110B", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "iniciando..." : "Iniciar disparo contínuo"}
            </button>
            <button onClick={() => setCriando(false)} className="text-[12px]" style={{ color: C.sub }}>cancelar</button>
          </div>
          {erro && <div className="text-[11px] mt-2" style={{ color: C.banido }}>{erro}</div>}
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : execucoes.length === 0 ? (
        <EmptyState titulo="Nenhum anúncio rodando" sub="Clique em “+ Novo anúncio” pra começar um disparo contínuo." />
      ) : (
        <div className="flex flex-col gap-3">
          {execucoes.map((exec) => (
            <Card key={exec.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Led color={exec.pausado ? C.pausado : C.ativo} live={!exec.pausado} />
                  <span className="text-[13px] zap-mono uppercase" style={{ color: C.text }}>{exec.zap_nichos?.nome}</span>
                  <span className="text-[11px] zap-mono" style={{ color: C.sub }}>ciclo {exec.ciclo_atual}</span>
                  {exec.imagem_url && <span className="text-[10px] zap-mono px-1.5 py-[2px] rounded-[3px]" style={{ background: "rgba(255,255,255,0.06)", color: C.sub }}>📷 com imagem</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => alternarPausa(exec)} className="px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body" style={{ border: `1px solid ${C.line}`, color: C.sub }}>
                    {exec.pausado ? "retomar" : "pausar"}
                  </button>
                  <button onClick={() => encerrar(exec)} className="px-2.5 py-1.5 text-[11px] rounded-[4px] zap-body" style={{ border: `1px solid ${C.banido}55`, color: C.banido }}>
                    encerrar
                  </button>
                </div>
              </div>
              <div className="text-[12px] zap-body mb-2" style={{ color: C.sub }}>{exec.mensagem}</div>
              <div className="flex items-center gap-4 text-[11px] zap-mono mb-2" style={{ color: C.sub }}>
                <span>enviados <span style={{ color: C.text }}>{exec.total_enviados ?? 0}</span></span>
                <span>erros <span style={{ color: C.text }}>{exec.total_erros ?? 0}</span></span>
              </div>
              {distribuicoes[exec.id] && Object.keys(distribuicoes[exec.id]).length > 1 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] zap-mono pt-2 mb-2" style={{ borderTop: `1px solid ${C.line}`, color: C.sub }}>
                  {Object.entries(distribuicoes[exec.id]).map(([texto, count]) => (
                    <span key={texto}>"{texto}..." <span style={{ color: C.text }}>{count}</span></span>
                  ))}
                </div>
              )}
              <DetalhesPorNumero execucaoId={exec.id} nichoId={exec.nicho_id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function situacaoNumeroDisparo(estado) {
  if (!estado) return { label: "ainda não iniciou", cor: C.sub };
  if (estado.ciclo_completo) return { label: "terminou o ciclo — aguardando reinício", cor: C.aquecendo };
  if (!estado.proxima_acao) return { label: "pronto pra próxima mensagem", cor: C.ativo };
  const faltaMs = new Date(estado.proxima_acao).getTime() - Date.now();
  if (faltaMs <= 0) return { label: "pronto pra próxima mensagem", cor: C.ativo };
  const faltaMin = Math.ceil(faltaMs / 60000);
  if (estado.mensagens_no_lote === 0) return { label: `em pausa entre lotes — volta em ${faltaMin}min`, cor: C.pausado };
  return { label: `próxima msg em ${faltaMin}min`, cor: C.aquecendo };
}

function HistoricoNumero({ execucaoId, numeroId, onFechar }) {
  const [linhas, setLinhas] = useState(null);

  useEffect(() => {
    supabase
      .from("zap_disparo_log")
      .select("id, grupo_id, status, enviado_em, created_at")
      .eq("execucao_id", execucaoId)
      .eq("numero_id", numeroId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setLinhas(data ?? []));
  }, [execucaoId, numeroId]);

  return (
    <div className="px-3 py-2 rounded-[4px] mt-1.5" style={{ background: "rgba(0,0,0,0.25)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] zap-mono uppercase" style={{ color: C.sub }}>últimos envios</span>
        <button onClick={onFechar} className="text-[10px]" style={{ color: C.sub }}>fechar</button>
      </div>
      {linhas === null ? (
        <span className="text-[11px] zap-body" style={{ color: C.sub }}>carregando...</span>
      ) : linhas.length === 0 ? (
        <span className="text-[11px] zap-body" style={{ color: C.sub }}>nenhum envio ainda</span>
      ) : (
        <div className="flex flex-col gap-1">
          {linhas.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-[11px] zap-mono">
              <span style={{ color: l.status === "enviado" ? C.ativo : C.banido }}>grupo #{l.grupo_id} · {l.status}</span>
              <span style={{ color: C.sub }}>{tempoRelativo(l.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetalhesPorNumero({ execucaoId, nichoId }) {
  const [linhas, setLinhas] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(null);

  const carregar = async () => {
    const { data: numeros } = await supabase
      .from("zap_numeros")
      .select("id, instancia, status")
      .eq("nicho_id", nichoId)
      .eq("status", "ativo");

    const { data: estados } = await supabase
      .from("zap_disparo_estado")
      .select("*")
      .eq("execucao_id", execucaoId);

    const porNumero = {};
    (estados ?? []).forEach((e) => { porNumero[e.numero_id] = e; });

    const combinado = await Promise.all(
      (numeros ?? []).map(async (n) => {
        const { count } = await supabase
          .from("zap_disparo_log")
          .select("id", { count: "exact", head: true })
          .eq("execucao_id", execucaoId)
          .eq("numero_id", n.id)
          .eq("status", "enviado");
        return { numero: n, estado: porNumero[n.id], enviados: count ?? 0 };
      })
    );
    setLinhas(combinado);
  };

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 20000);
    return () => clearInterval(intervalo);
  }, [execucaoId, nichoId]);

  if (linhas === null) return <div className="text-[11px] zap-mono pt-2" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>carregando por número...</div>;
  if (linhas.length === 0) return <div className="text-[11px] zap-body pt-2" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>nenhum número ativo nesse nicho</div>;

  return (
    <div className="pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
      {linhas.map(({ numero, estado, enviados }) => {
        const sit = situacaoNumeroDisparo(estado);
        return (
          <div key={numero.id}>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Led color={sit.cor} live={sit.cor === C.ativo} />
                <span className="text-[12px] zap-mono" style={{ color: C.text }}>{numero.instancia}</span>
                <span className="text-[11px] zap-body" style={{ color: C.sub }}>{sit.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] zap-mono" style={{ color: C.sub }}>{enviados} enviados</span>
                <button onClick={() => setHistoricoAberto(historicoAberto === numero.id ? null : numero.id)} className="text-[11px]" style={{ color: C.ativo }}>
                  histórico
                </button>
              </div>
            </div>
            {historicoAberto === numero.id && (
              <HistoricoNumero execucaoId={execucaoId} numeroId={numero.id} onFechar={() => setHistoricoAberto(null)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- helpers ----------

function tempoRelativo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [tab, setTab] = useState("chips");
  const { nichos, numeros, cobertura, diarias, chips, loading, erro, recarregar } = useZapData();

  const Content = useMemo(() => {
    switch (tab) {
      case "importar":
        return <ImportarTab nichos={nichos} onDadosMudaram={recarregar} />;
      case "chips":
        return <ChipsTab chips={chips} loading={loading} onRecarregar={recarregar} />;
      case "operacao":
        return <OperacaoTab nichos={nichos} />;
      default:
        return <NumerosTab nichos={nichos} numeros={numeros} cobertura={cobertura} chips={chips} loading={loading} onRecarregar={recarregar} />;
    }
  }, [tab, nichos, numeros, cobertura, diarias, chips, loading, recarregar]);

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
