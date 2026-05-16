"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// Debounce helper — evita salvar no Firestore a cada tecla
function useDebounce<T>(val: T, ms: number): T {
  const [debounced, setDebounced] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return debounced;
}

/**
 * Hook que funciona como useLocalStorage mas:
 * - Se uid for null: usa só localStorage (modo offline / não logado)
 * - Se uid existir: sincroniza com Firestore em tempo real
 *
 * Estrutura Firestore: users/{uid}/{collection} → { data: <valor> }
 */
export function useFirestoreSync<T>(
  key: string,
  init: T,
  uid: string | null
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const lsKey = `mp_${key}_v2`;

  // Estado local — começa do localStorage para não piscar
  const [val, setVal] = useState<T>(() => {
    try {
      const s = localStorage.getItem(lsKey);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });

  const [syncing, setSyncing] = useState(false);
  const initialized = useRef(false);
  const debouncedVal = useDebounce(val, 800);

  // ── Quando uid aparece: carrega do Firestore e ativa listener ──
  useEffect(() => {
    if (!uid) {
      initialized.current = false;
      return;
    }

    setSyncing(true);
    const ref = doc(db, "users", uid, "data", key);

    // Carrega uma vez e depois ouve mudanças em tempo real
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remoto = snap.data()?.value as T;
        setVal(remoto);
        // Mantém localStorage em sync para fallback offline
        try { localStorage.setItem(lsKey, JSON.stringify(remoto)); } catch {}
      } else if (!initialized.current) {
        // Primeira vez: sobe os dados locais para a nuvem
        const local = (() => {
          try {
            const s = localStorage.getItem(lsKey);
            return s ? (JSON.parse(s) as T) : init;
          } catch { return init; }
        })();
        setDoc(ref, { value: local }).catch(() => {});
        setVal(local);
      }
      initialized.current = true;
      setSyncing(false);
    }, () => {
      // Erro de permissão ou offline — continua com localStorage
      setSyncing(false);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);

  // ── Salva no localStorage sempre (fallback offline) ──
  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(val)); } catch {}
  }, [lsKey, val]);

  // ── Salva no Firestore com debounce (só quando logado e inicializado) ──
  useEffect(() => {
    if (!uid || !initialized.current) return;
    const ref = doc(db, "users", uid, "data", key);
    setDoc(ref, { value: debouncedVal }, { merge: true }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedVal, uid, key]);

  return [val, setVal, syncing];
}
