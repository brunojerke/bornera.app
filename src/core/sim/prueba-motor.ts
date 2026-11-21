// Cálculo lento de referencia del motor (T30), escrito aparte a propósito:
// recorre las redes una por una (BFS por los contactos que conducen), sin
// union-find, sin tablas armadas de antemano y con conjuntos. Mismo criterio
// que `motor.ts` (docs/plan-T30.md), para comparar resultados en los tests.
// Solo lo importan los tests: el código de la app no lo usa.
import type { Netlist } from "./netlist";

export interface FotoLenta {
  pulsados: string[];
  tension: boolean[];
  conducen: boolean[];
  encendidas: boolean[];
  potencialDeRed: (number | null)[];
  detenida: unknown;
  avisos: unknown[];
  nuevos: unknown[];
}

export class SimulacionLenta {
  private pulsados = new Set<string>();
  private tension: boolean[];
  private detenida: unknown = null;
  private avisos: unknown[] = [];
  private nuevos: unknown[] = [];
  private dados = new Set<string>();
  private ultimo: { conducen: boolean[]; encendidas: boolean[]; potencialDeRed: (number | null)[] };

  constructor(
    private readonly n: Netlist,
    private readonly tope: number = 2 * n.bobinas.length + 50,
  ) {
    this.tension = n.bobinas.map(() => false);
    this.ultimo = { conducen: [], encendidas: [], potencialDeRed: [] };
    this.correr();
  }

  pulsar(...comps: string[]): void {
    if (this.detenida) return void (this.nuevos = []);
    const manuales = new Set(this.n.contactos.filter((c) => c.accionamiento === "manual_momentaneo" || c.accionamiento === "manual_enclavado").map((c) => c.comp));
    const nuevos = comps.filter((c) => manuales.has(c) && !this.pulsados.has(c));
    if (nuevos.length === 0) return void (this.nuevos = []);
    for (const c of nuevos) this.pulsados.add(c);
    this.correr();
  }

  soltar(...comps: string[]): void {
    if (this.detenida) return void (this.nuevos = []);
    const sueltos = comps.filter((c) => this.pulsados.has(c));
    if (sueltos.length === 0) return void (this.nuevos = []);
    for (const c of sueltos) this.pulsados.delete(c);
    this.correr();
  }

  foto(): FotoLenta {
    return {
      pulsados: [...this.pulsados].sort(),
      tension: [...this.tension],
      conducen: this.ultimo.conducen,
      encendidas: this.ultimo.encendidas,
      potencialDeRed: this.ultimo.potencialDeRed,
      detenida: this.detenida,
      avisos: [...this.avisos],
      nuevos: [...this.nuevos],
    };
  }

  private avisar(a: { tipo: string; [k: string]: unknown }): void {
    const k = a.tipo === "carrera" ? `c:${JSON.stringify(a["etiquetas"])}` : a.tipo === "serie" ? `s:${JSON.stringify(a["cargas"])}` : a.tipo;
    if (this.dados.has(k)) return;
    this.dados.add(k);
    this.avisos.push(a);
    this.nuevos.push(a);
  }

  /** Un recálculo con las bobinas quietas. */
  private recalcular() {
    const n = this.n;
    const conducen = n.contactos.map((c) => {
      let activo = false;
      if (c.accionamiento === "manual_momentaneo" || c.accionamiento === "manual_enclavado") activo = this.pulsados.has(c.comp);
      else if (c.accionamiento === "bobina") {
        const g = n.bobinas.findIndex((b) => b.etiqueta === c.etiqueta);
        activo = g >= 0 && this.tension[g]!;
      }
      return c.na === activo;
    });
    // Grupos por BFS, en el orden de su red más chica.
    const grupoDe: number[] = n.redes.map(() => -1);
    const grupos: number[][] = [];
    for (let i = 0; i < n.redes.length; i++) {
      if (grupoDe[i] !== -1) continue;
      const g = grupos.length;
      const cola = [i];
      grupoDe[i] = g;
      const miembros: number[] = [];
      while (cola.length > 0) {
        const r = cola.shift()!;
        miembros.push(r);
        n.contactos.forEach((c, j) => {
          if (!conducen[j]) return;
          const otra = c.a === r ? c.b : c.b === r ? c.a : -1;
          if (otra >= 0 && grupoDe[otra] === -1) {
            grupoDe[otra] = g;
            cola.push(otra);
          }
        });
      }
      grupos.push(miembros.sort((a, b) => a - b));
    }
    const potsDe = grupos.map((m) => new Set(m.flatMap((r) => n.redes[r]!.potenciales)));
    const unico = (r: number): number | null => {
      const s = potsDe[grupoDe[r]!]!;
      return s.size === 1 ? [...s][0]! : null;
    };
    const encendidas = n.cargas.map((k) => {
      const pa = unico(k.a);
      const pb = unico(k.b);
      return pa !== null && pb !== null && pa !== pb && (n.potenciales[pa]!.papel === "fase" || n.potenciales[pb]!.papel === "fase");
    });
    const deseado = n.bobinas.map((b) => b.cargas.some((k) => encendidas[k]));
    const enCorto = potsDe.map((s) => s.size >= 2);
    return { conducen, grupoDe, grupos, potsDe, unico, encendidas, deseado, enCorto };
  }

  private correr(): void {
    const n = this.n;
    this.nuevos = [];
    const vistos: string[] = [];
    const cambiadas: number[] = [];
    let antes: number[] = [];
    let ultima = -1;
    let r = this.recalcular();
    for (let paso = 0; ; paso++) {
      const quieren = n.bobinas.map((_, g) => g).filter((g) => r.deseado[g] !== this.tension[g]);
      for (const q of antes) if (q !== ultima && !quieren.includes(q)) this.avisar({ tipo: "carrera", etiquetas: [n.bobinas[ultima]!.etiqueta, n.bobinas[q]!.etiqueta] });
      if (r.enCorto.some((x) => x)) {
        const redes = n.redes.map((_, i) => i).filter((i) => r.enCorto[r.grupoDe[i]!]);
        const potenciales = [...new Set(redes.flatMap((i) => n.redes[i]!.potenciales))].sort((a, b) => a - b);
        const ps = potenciales.map((p) => n.potenciales[p]!);
        const nombres = ps.map((p) => (ps.some((q) => q !== p && q.nombre === p.nombre) ? `${p.papel === "fase" ? "Fase" : "Neutro"} ${p.nombre}` : p.nombre));
        this.detenida = { tipo: "corto", redes, potenciales, nombres };
        break;
      }
      if (quieren.length === 0) {
        r.grupos.forEach((miembros, g) => {
          if (r.potsDe[g]!.size !== 0) return;
          const bornes = miembros.flatMap((red) => n.redes[red]!.bornes);
          const cargas = new Set<number>();
          let soloCargas = true;
          for (const b of bornes) {
            const k = n.cargas.findIndex((x) => x.comp === b.comp);
            const c = n.contactos.findIndex((x) => x.comp === b.comp);
            if (k >= 0) cargas.add(k);
            else if (c >= 0 && r.conducen[c]) continue;
            else soloCargas = false;
          }
          if (!soloCargas || cargas.size < 2) return;
          const otros = new Set<number>();
          for (const k of cargas) {
            const c = n.cargas[k]!;
            if (r.grupoDe[c.a] === g) {
              const p = r.unico(c.b);
              if (p !== null) otros.add(p);
            }
            if (r.grupoDe[c.b] === g) {
              const p = r.unico(c.a);
              if (p !== null) otros.add(p);
            }
          }
          if (otros.size < 2) return;
          const orden = [...cargas].sort((a, b) => a - b);
          this.avisar({ tipo: "serie", cargas: orden.map((k) => n.cargas[k]!.comp), etiquetas: orden.map((k) => n.cargas[k]!.etiqueta) });
        });
        break;
      }
      const clave = JSON.stringify(this.tension);
      const i = vistos.indexOf(clave);
      if (i >= 0) {
        const ciclo = [...new Set(cambiadas.slice(i))].sort((a, b) => a - b);
        this.detenida = { tipo: "oscila", etiquetas: ciclo.map((g) => n.bobinas[g]!.etiqueta) };
        break;
      }
      if (paso >= this.tope) {
        this.detenida = { tipo: "tope", pasos: this.tope };
        break;
      }
      vistos.push(clave);
      ultima = quieren[0]!;
      this.tension[ultima] = !this.tension[ultima];
      cambiadas.push(ultima);
      antes = quieren;
      r = this.recalcular();
    }
    if (this.detenida) this.avisar(this.detenida as { tipo: string });
    this.ultimo = { conducen: r.conducen, encendidas: r.encendidas, potencialDeRed: n.redes.map((_, i) => r.unico(i)) };
  }
}
