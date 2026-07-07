import React, { useState, useEffect, useCallback, useRef } from "react";
import { Flame, ShoppingBag, ShoppingCart, TrendingUp, LogOut, User, Plus, Minus, X } from "lucide-react";

// ---------------------------------------------
// Conexión a Supabase (REST directo, sin librería)
// ---------------------------------------------
const SUPABASE_URL = "https://pwwqpniwmmmefzybvloy.supabase.co";
const SUPABASE_KEY = "sb_publishable_vA11sf6nKHFtJkHEDxZNYw_QaLRevTc";

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase GET falló (${res.status})`);
  return res.json();
}
async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST falló (${res.status})`);
  return res.json();
}
async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH falló (${res.status})`);
}
async function sbDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: sbHeaders,
  });
  if (!res.ok) throw new Error(`Supabase DELETE falló (${res.status})`);
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

const SESSION_KEY = "session";
const POLL_MS = 4000;

// ---------------------------------------------
// Sesión local (solo para recordar quién eres en este dispositivo;
// las cuentas en sí ya viven en Supabase)
// ---------------------------------------------
function getJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Error guardando", key, e);
    return false;
  }
}

async function findUserByEmail(email) {
  const rows = await sbGet(`users?select=*&email=eq.${encodeURIComponent(email)}`);
  return rows[0] || null;
}

// Hash simple sin dependencias del navegador (suficiente para esta demo,
// no es para proteger contraseñas reales en producción).
function hashPassword(pw) {
  let hash = 0;
  const str = `gc-salt-${pw}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function CapIcon({ color = "#E8A33D", size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M6 40C6 24.536 17.536 13 33 13C46.807 13 58 24.193 58 38V40H33.5C24.5 40 15 41.5 6 44V40Z" fill={color} />
      <path d="M6 44C15 41.5 24.5 40 33.5 40H58C58 46 52 50 44 50H20C12 50 6 47 6 44Z" fill="#000" fillOpacity="0.25" />
      <circle cx="33" cy="17" r="3" fill="#000" fillOpacity="0.3" />
    </svg>
  );
}

// ---------------------------------------------
// Pantalla de acceso (registro / inicio de sesión)
// ---------------------------------------------
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Completa correo y contraseña.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const passwordHash = hashPassword(password);

      if (mode === "register") {
        const existing = await findUserByEmail(cleanEmail);
        if (existing) {
          setError("Ya existe una cuenta con ese correo.");
          setLoading(false);
          return;
        }
        const user = { name: name.trim(), email: cleanEmail, password_hash: passwordHash };
        await sbPost("users", user);
        setJSON(SESSION_KEY, { email: cleanEmail });
        setLoading(false);
        onAuthed({ name: user.name, email: user.email, is_admin: user.is_admin });
      } else {
        const user = await findUserByEmail(cleanEmail);
        if (!user || user.password_hash !== passwordHash) {
          setError("Correo o contraseña incorrectos.");
          setLoading(false);
          return;
        }
        setJSON(SESSION_KEY, { email: cleanEmail });
        setLoading(false);
        onAuthed({ name: user.name, email: user.email, is_admin: user.is_admin });
      }
    } catch (e) {
      setError(`Error inesperado: ${e?.message || e}`);
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORTS}</style>
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>{mode === "login" ? "ENTRA AL CLUB" : "CREA TU CUENTA"}</h1>
          <p style={styles.authSub}>
            {mode === "login"
              ? "Inicia sesión para comprar y aparecer en el ranking."
              : "Regístrate para empezar a coleccionar ediciones."}
          </p>

          {mode === "register" && (
            <input
              style={styles.input}
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            style={styles.input}
            placeholder="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div style={styles.authError}>{error}</div>}

          <button style={styles.buyBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>

          <button
            style={styles.authToggle}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>

          <p style={styles.authNote}>
            Tu cuenta y tus compras se guardan en Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------
// Panel de edición del catálogo (solo para admins)
// ---------------------------------------------
function AdminPanel({ caps, onClose, onChanged }) {
  const [rows, setRows] = useState(caps.map((c) => ({ ...c })));
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState("");
  const [newCap, setNewCap] = useState({ id: "", name: "", edition: "", price: "", color: "#FF4B1F" });

  useEffect(() => setRows(caps.map((c) => ({ ...c }))), [caps]);

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveRow = async (row) => {
    setSaving(row.id);
    setMsg("");
    try {
      await sbPatch(`caps?id=eq.${row.id}`, {
        name: row.name,
        edition: row.edition,
        price: Number(row.price),
        color: row.color,
      });
      onChanged();
      setMsg(`"${row.name}" guardado.`);
    } catch (e) {
      setMsg(`Error guardando "${row.name}": ${e.message}`);
    }
    setSaving(null);
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`¿Borrar "${row.name}"? Esto no se puede deshacer.`)) return;
    setSaving(row.id);
    setMsg("");
    try {
      await sbDelete(`caps?id=eq.${row.id}`);
      onChanged();
      setMsg(`"${row.name}" borrado.`);
    } catch (e) {
      setMsg(`Error borrando "${row.name}": ${e.message}`);
    }
    setSaving(null);
  };

  const addCap = async () => {
    const id = newCap.id.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !newCap.name.trim() || !newCap.edition.trim() || !newCap.price) {
      setMsg("Completa id, nombre, edición y precio para agregar una gorra nueva.");
      return;
    }
    setSaving("__new__");
    setMsg("");
    try {
      await sbPost("caps", {
        id,
        name: newCap.name.trim(),
        edition: newCap.edition.trim(),
        price: Number(newCap.price),
        color: newCap.color,
        sold: 0,
      });
      setNewCap({ id: "", name: "", edition: "", price: "", color: "#FF4B1F" });
      onChanged();
      setMsg(`"${newCap.name}" agregada.`);
    } catch (e) {
      setMsg(`Error agregando la gorra: ${e.message}`);
    }
    setSaving(null);
  };

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORTS}</style>
      <div style={styles.accountBar}>
        <span style={styles.accountName}>Editar catálogo</span>
        <button style={styles.logoutBtn} onClick={onClose}>
          Volver a la tienda
        </button>
      </div>
      <main style={styles.main}>
        {msg && (
          <div style={{ ...styles.toast, position: "static", transform: "none", margin: "16px 0", display: "inline-block" }}>
            {msg}
          </div>
        )}

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>Gorras actuales</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ ...styles.card, flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <CapIcon color={row.color} size={32} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8A8E" }}>
                    id: {row.id}
                  </span>
                </div>
                <input style={styles.input} placeholder="Nombre" value={row.name} onChange={(e) => updateRow(row.id, "name", e.target.value)} />
                <input style={styles.input} placeholder="Edición" value={row.edition} onChange={(e) => updateRow(row.id, "edition", e.target.value)} />
                <input style={styles.input} placeholder="Precio" type="number" value={row.price} onChange={(e) => updateRow(row.id, "price", e.target.value)} />
                <input style={{ ...styles.input, padding: 6, height: 44 }} type="color" value={row.color} onChange={(e) => updateRow(row.id, "color", e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...styles.buyBtn, flex: 1 }} disabled={saving === row.id} onClick={() => saveRow(row)}>
                    {saving === row.id ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    style={{ ...styles.buyBtn, flex: 1, background: "transparent", border: "1px solid #FF4B1F", color: "#FF4B1F" }}
                    disabled={saving === row.id}
                    onClick={() => deleteRow(row)}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>Agregar gorra nueva</h2>
          </div>
          <div style={{ ...styles.card, flexDirection: "column" }}>
            <input style={styles.input} placeholder="id único (ej. verano2026)" value={newCap.id} onChange={(e) => setNewCap((n) => ({ ...n, id: e.target.value }))} />
            <input style={styles.input} placeholder="Nombre" value={newCap.name} onChange={(e) => setNewCap((n) => ({ ...n, name: e.target.value }))} />
            <input style={styles.input} placeholder="Edición (ej. Ed. 006)" value={newCap.edition} onChange={(e) => setNewCap((n) => ({ ...n, edition: e.target.value }))} />
            <input style={styles.input} placeholder="Precio" type="number" value={newCap.price} onChange={(e) => setNewCap((n) => ({ ...n, price: e.target.value }))} />
            <input style={{ ...styles.input, padding: 6, height: 44 }} type="color" value={newCap.color} onChange={(e) => setNewCap((n) => ({ ...n, color: e.target.value }))} />
            <button style={styles.buyBtn} disabled={saving === "__new__"} onClick={addCap}>
              {saving === "__new__" ? "Agregando..." : "Agregar gorra"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}


// ---------------------------------------------
// Panel del carrito de compras
// ---------------------------------------------
function CartPanel({ items, onClose, onInc, onDec, onRemove, onCheckout, checking }) {
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORTS}</style>
      <div style={styles.accountBar}>
        <span style={styles.accountName}>Tu carrito</span>
        <button style={styles.logoutBtn} onClick={onClose}>
          Seguir comprando
        </button>
      </div>
      <main style={styles.main}>
        {items.length === 0 ? (
          <section style={styles.section}>
            <p style={{ color: "#8A8A8E", fontSize: 14 }}>Tu carrito está vacío.</p>
          </section>
        ) : (
          <>
            <section style={styles.section}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map((it) => (
                  <div key={it.id} style={{ ...styles.card, flexDirection: "row", alignItems: "center" }}>
                    <div style={styles.cardIconWrap}>
                      <CapIcon color={it.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.cardEdition}>{it.edition}</div>
                      <div style={styles.cardName}>{it.name}</div>
                      <div style={{ color: "#8A8A8E", fontSize: 12, marginTop: 4 }}>
                        ${it.price} × {it.qty} = ${it.price * it.qty}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button style={styles.qtyBtn} onClick={() => onDec(it.id)} aria-label="Quitar uno">
                        <Minus size={14} />
                      </button>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, minWidth: 18, textAlign: "center" }}>
                        {it.qty}
                      </span>
                      <button style={styles.qtyBtn} onClick={() => onInc(it.id)} aria-label="Agregar uno">
                        <Plus size={14} />
                      </button>
                      <button style={{ ...styles.qtyBtn, marginLeft: 6, borderColor: "#FF4B1F", color: "#FF4B1F" }} onClick={() => onRemove(it.id)} aria-label="Quitar del carrito">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18 }}>Total</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: "#D4AF37" }}>${total}</span>
              </div>
              <button style={styles.buyBtn} disabled={checking} onClick={onCheckout}>
                {checking ? "Procesando..." : "Confirmar compra"}
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}


// ---------------------------------------------
// App principal (después de iniciar sesión)
// ---------------------------------------------
function Store({ user, onLogout }) {
  const [caps, setCaps] = useState([]);
  const [feed, setFeed] = useState([]);
  const [flashIds, setFlashIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const syncing = useRef(false);
  const isAdmin = !!user.is_admin;

  const loadFromSupabase = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const [capsData, purchasesData] = await Promise.all([
        sbGet("caps?select=*&order=id"),
        sbGet("purchases?select=*&order=created_at.desc&limit=20"),
      ]);
      setCaps(capsData);
      setFeed(
        purchasesData.map((p) => {
          const cap = capsData.find((c) => c.id === p.cap_id);
          return {
            id: p.id,
            buyer: p.buyer_name,
            edition: cap ? `${cap.name} · ${cap.edition}` : p.cap_id,
            time: relativeTime(p.created_at),
            isYou: p.buyer_name === user.name,
          };
        })
      );
      setLoadError("");
    } catch (e) {
      setLoadError("No se pudo conectar con Supabase. Revisa tu conexión.");
    }
    syncing.current = false;
  }, [user.name]);

  useEffect(() => {
    loadFromSupabase();
    const interval = setInterval(loadFromSupabase, POLL_MS);
    return () => clearInterval(interval);
  }, [loadFromSupabase]);

  const [cart, setCart] = useState({}); // { [capId]: qty }
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const addToCart = (cap) => {
    setCart((prev) => ({ ...prev, [cap.id]: (prev[cap.id] || 0) + 1 }));
    setToast(`Agregado al carrito: ${cap.name}`);
    setTimeout(() => setToast(null), 1600);
  };
  const incCartItem = (capId) => setCart((prev) => ({ ...prev, [capId]: (prev[capId] || 0) + 1 }));
  const decCartItem = (capId) =>
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[capId] || 0) - 1;
      if (qty <= 0) delete next[capId];
      else next[capId] = qty;
      return next;
    });
  const removeCartItem = (capId) =>
    setCart((prev) => {
      const next = { ...prev };
      delete next[capId];
      return next;
    });

  const cartItems = Object.entries(cart)
    .map(([capId, qty]) => {
      const cap = caps.find((c) => c.id === capId);
      return cap ? { ...cap, qty } : null;
    })
    .filter(Boolean);
  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setCheckingOut(true);
    try {
      const purchasedIds = cartItems.map((it) => it.id);
      for (const item of cartItems) {
        const inserts = Array.from({ length: item.qty }, () => sbPost("purchases", { buyer_name: user.name, cap_id: item.id }));
        await Promise.all(inserts);
        await sbPatch(`caps?id=eq.${item.id}`, { sold: item.sold + item.qty });
      }
      setCart({});
      setShowCart(false);
      setToast("¡Compra confirmada!");
      setTimeout(() => setToast(null), 2200);
      setFlashIds(purchasedIds);
      setTimeout(() => setFlashIds([]), 900);
      loadFromSupabase();
    } catch (e) {
      setToast("Hubo un problema al confirmar la compra");
      setTimeout(() => setToast(null), 2500);
    }
    setCheckingOut(false);
  };

  const ranked = [...caps].sort((a, b) => b.sold - a.sold);
  const maxSold = ranked[0]?.sold || 1;
  const displayFeed = feed.length ? feed : [{ id: "empty", buyer: "—", edition: "Aún no hay compras", time: "" }];

  if (showAdmin) {
    return <AdminPanel caps={caps} onClose={() => setShowAdmin(false)} onChanged={loadFromSupabase} />;
  }

  if (showCart) {
    return (
      <CartPanel
        items={cartItems}
        onClose={() => setShowCart(false)}
        onInc={incCartItem}
        onDec={decCartItem}
        onRemove={removeCartItem}
        onCheckout={handleCheckout}
        checking={checkingOut}
      />
    );
  }

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORTS}</style>

      <div style={styles.ticker}>
        <div style={styles.tickerLabel}>
          <span className="gc-live-dot" style={{ display: "inline-flex" }}>
            <Flame size={14} color="#FF4B1F" />
          </span>
          <span style={styles.tickerLabelText}>EN VIVO</span>
        </div>
        <div style={styles.tickerTrack}>
          <div style={styles.tickerMarquee} className="gc-marquee">
            {[...displayFeed, ...displayFeed].map((f, i) => (
              <span key={f.id + i} style={styles.tickerItem}>
                <strong style={{ color: f.isYou ? "#FF4B1F" : "#F5F1E8" }}>{f.buyer}</strong>
                {f.edition !== "Aún no hay compras" && <span style={{ color: "#8A8A8E" }}> compró </span>}
                <span style={{ color: "#D4AF37" }}>{f.edition}</span>
                {f.time && <span style={{ color: "#5A5A60" }}> · {f.time}</span>}
                <span style={styles.tickerDot}>●</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.accountBar}>
        <span style={styles.accountName}>
          <User size={13} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          {user.name}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ ...styles.logoutBtn, position: "relative" }} onClick={() => setShowCart(true)}>
            <ShoppingCart size={13} style={{ verticalAlign: "-2px" }} />
            {cartCount > 0 && (
              <span key={cartCount} className="gc-badge-pop" style={styles.cartBadge}>
                {cartCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button style={styles.logoutBtn} onClick={() => setShowAdmin(true)}>
              Editar catálogo
            </button>
          )}
          <button style={styles.logoutBtn} onClick={onLogout}>
            <LogOut size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />
            Cerrar sesión
          </button>
        </div>
      </div>

      <main style={styles.main}>
        <section style={styles.hero}>
          <h1 style={styles.heroTitle}>
            ONLY.
            <br />
            MONEY.
          </h1>
          <p style={styles.heroSub}>session 1: — 001ranked</p>
          {loadError && <p style={{ ...styles.authError, marginTop: 12 }}>{loadError}</p>}
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <TrendingUp size={18} color="#D4AF37" />
            <h2 style={styles.sectionTitle}>Ranking de ediciones</h2>
          </div>
          <ol style={styles.rankList}>
            {ranked.map((cap, i) => (
              <li
                key={cap.id}
                className={flashIds.includes(cap.id) ? "gc-caprow-flash" : ""}
                style={styles.rankItem}
              >
                <span style={{ ...styles.rankNum, color: i === 0 ? "#D4AF37" : "#8A8A8E" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={styles.rankInfo}>
                  <div style={styles.rankNameRow}>
                    <span style={styles.rankName}>{cap.name}</span>
                    <span style={styles.rankCount}>{cap.sold} vendidas</span>
                  </div>
                  <div style={styles.rankBarTrack}>
                    <div
                      style={{
                        ...styles.rankBarFill,
                        width: `${(cap.sold / maxSold) * 100}%`,
                        background: i === 0 ? "#D4AF37" : "#FF4B1F",
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <ShoppingBag size={18} color="#FF4B1F" />
            <h2 style={styles.sectionTitle}>Colección actual</h2>
          </div>
          <div style={styles.grid}>
            {caps.map((cap) => (
              <div key={cap.id} style={styles.card}>
                <div style={styles.cardIconWrap}>
                  <CapIcon color={cap.color} />
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.cardEdition}>{cap.edition}</div>
                  <div style={styles.cardName}>{cap.name}</div>
                  <div style={styles.cardMeta}>
                    <span style={styles.cardPrice}>${cap.price}</span>
                    <span style={styles.cardSold}>{cap.sold} vendidas</span>
                  </div>
                  <button style={styles.buyBtn} onClick={() => addToCart(cap)}>
                    Agregar al carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {toast && (
        <div key={toast} className="gc-toast" style={styles.toast}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// Raíz: decide si mostrar login o la tienda
// ---------------------------------------------
export default function GorraClub() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const session = getJSON(SESSION_KEY);
      if (session?.email) {
        try {
          const found = await findUserByEmail(session.email);
          if (found) setUser({ name: found.name, email: found.email, is_admin: found.is_admin });
        } catch (e) {
          // si Supabase no responde, simplemente se pide iniciar sesión de nuevo
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleLogout = async () => {
    setJSON(SESSION_KEY, {});
    setUser(null);
  };

  if (checking) {
    return (
      <div style={styles.page}>
        <style>{FONT_IMPORTS}</style>
        <div style={styles.authWrap}>
          <span style={{ color: "#8A8A8E", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
            Cargando...
          </span>
        </div>
      </div>
    );
  }

  return user ? <Store user={user} onLogout={handleLogout} /> : <AuthScreen onAuthed={setUser} />;
}

const FONT_IMPORTS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

.gc-marquee {
  animation: gc-scroll 22s linear infinite;
}
@keyframes gc-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.gc-live-dot {
  animation: gc-pulse 1.8s ease-in-out infinite;
}
@keyframes gc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}

.gc-caprow-flash {
  animation: gc-caprow-glow 0.9s ease;
}
@keyframes gc-caprow-glow {
  0% { box-shadow: 0 0 0 1px #D4AF37, 0 0 28px rgba(212,175,55,0.55); }
  100% { box-shadow: 0 0 0 1px rgba(212,175,55,0), 0 0 0 rgba(212,175,55,0); }
}

.gc-badge-pop {
  animation: gc-badge-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes gc-badge-pop {
  0% { transform: scale(0.4); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

.gc-toast {
  animation: gc-toast-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes gc-toast-in {
  0% { opacity: 0; transform: translate(-50%, 10px); }
  100% { opacity: 1; transform: translate(-50%, 0); }
}

button {
  transition: transform 0.12s ease;
}
button:active {
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .gc-marquee, .gc-live-dot, .gc-caprow-flash, .gc-badge-pop, .gc-toast, button {
    animation: none !important;
    transition: none !important;
  }
}

button:focus-visible, input:focus-visible {
  outline: 2px solid #FF4B1F;
  outline-offset: 2px;
}
`;

const styles = {
  page: {
    minHeight: "100vh", background: "#0B0B0D", color: "#F5F1E8", fontFamily: "'Inter', sans-serif",
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  ticker: {
    position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center",
    background: "#111114", borderBottom: "1px solid #2A2A2F", overflow: "hidden", height: 40,
  },
  tickerLabel: {
    display: "flex", alignItems: "center", gap: 6, padding: "0 12px", height: "100%",
    background: "#0B0B0D", borderRight: "1px solid #2A2A2F", flexShrink: 0,
  },
  tickerLabelText: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: "#FF4B1F", fontWeight: 500 },
  tickerTrack: { overflow: "hidden", flex: 1, whiteSpace: "nowrap" },
  tickerMarquee: { display: "inline-block", whiteSpace: "nowrap" },
  tickerItem: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 4 },
  tickerDot: { marginLeft: 18, color: "#2A2A2F", fontSize: 8 },
  accountBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 20px", borderBottom: "1px solid #1E1E23", maxWidth: 720, margin: "0 auto",
  },
  accountName: { fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#F5F1E8" },
  logoutBtn: {
    background: "transparent", border: "1px solid #2A2A2F", color: "#8A8A8E",
    borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  qtyBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28, background: "transparent", border: "1px solid #2A2A2F", color: "#F5F1E8",
    borderRadius: 6, cursor: "pointer", flexShrink: 0,
  },
  cartBadge: {
    position: "absolute", top: -6, right: -6, background: "#FF4B1F", color: "#0B0B0D",
    fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  main: { maxWidth: 720, margin: "0 auto", padding: "0 20px 80px" },
  hero: { padding: "56px 0 40px", borderBottom: "1px solid #1E1E23" },
  heroTitle: { fontFamily: "'Anton', sans-serif", fontSize: "clamp(40px, 10vw, 64px)", lineHeight: 0.95, letterSpacing: "0.01em", margin: 0, color: "#F5F1E8" },
  heroSub: { marginTop: 16, fontSize: 15, color: "#8A8A8E", maxWidth: 380, lineHeight: 1.5 },
  section: { padding: "40px 0", borderBottom: "1px solid #1E1E23" },
  sectionHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 20 },
  sectionTitle: { fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: "0.02em", margin: 0, textTransform: "uppercase" },
  rankList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  rankItem: { display: "flex", alignItems: "center", gap: 14, background: "#16161A", border: "1px solid #1E1E23", borderRadius: 10, padding: "14px 16px", transition: "box-shadow 0.4s ease" },
  rankNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 500, width: 26, flexShrink: 0 },
  rankInfo: { flex: 1, minWidth: 0 },
  rankNameRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8 },
  rankName: { fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rankCount: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8A8E", flexShrink: 0 },
  rankBarTrack: { height: 5, borderRadius: 3, background: "#232328", overflow: "hidden" },
  rankBarFill: { height: "100%", borderRadius: 3, transition: "width 0.6s ease" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  card: { background: "#16161A", border: "1px solid #1E1E23", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 },
  cardIconWrap: { width: 44, height: 44 },
  cardBody: { display: "flex", flexDirection: "column", gap: 4 },
  cardEdition: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em", color: "#D4AF37", textTransform: "uppercase" },
  cardName: { fontFamily: "'Anton', sans-serif", fontSize: 18, letterSpacing: "0.01em" },
  cardMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8A8A8E", margin: "6px 0 4px" },
  cardPrice: { color: "#F5F1E8", fontWeight: 600 },
  cardSold: {},
  buyBtn: { background: "#FF4B1F", color: "#0B0B0D", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", cursor: "pointer" },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#16161A", border: "1px solid #D4AF37", color: "#F5F1E8", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" },
  authWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  authCard: { width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 },
  authTitle: { fontFamily: "'Anton', sans-serif", fontSize: 34, letterSpacing: "0.01em", margin: 0 },
  authSub: { fontSize: 14, color: "#8A8A8E", margin: "0 0 8px" },
  input: { background: "#16161A", border: "1px solid #2A2A2F", borderRadius: 8, padding: "12px 14px", color: "#F5F1E8", fontSize: 14, fontFamily: "'Inter', sans-serif" },
  authError: { color: "#FF4B1F", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" },
  authToggle: { background: "transparent", border: "none", color: "#8A8A8E", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0, textAlign: "left" },
  authNote: { fontSize: 11, color: "#5A5A60", lineHeight: 1.5, marginTop: 8 },
};
