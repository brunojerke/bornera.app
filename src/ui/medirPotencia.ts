// S6 de «Probar la fase 6» (T37; docs/plan-T37.md): entrar a Simular sobre la
// escena de potencia 2000 (`bancoPotencia`) hasta el cuadro nítido al 31 %,
// como S1 sobre la de mando (`medirEntrada` de medirMando.ts), en su propio
// Editor y su propio lienzo fuera de pantalla. No toca la hoja del usuario.
// También lee la marca de arranque (P2, D24-A).

import { armarNetlist } from "../core/sim/netlist";
import { bancoPotencia } from "../editor/bancoPotencia";
import { msArranque } from "./arranque";
import { VUELTAS_S6, type MuestrasFase6 } from "./fase6";
import { medirEntrada } from "./medirMando";

const respirar = () => new Promise((r) => setTimeout(r, 0));

/** S6 y P2, con el tamaño de la escena de potencia. */
export async function medirPotencia(
  ancho: number,
  alto: number,
  progreso: (paso: string) => void = () => {},
): Promise<{ muestras: MuestrasFase6; escena: { componentes: number; cables: number; trifasicas: number; redes: number } }> {
  progreso("armando la escena de potencia 2000");
  await respirar();
  const banco = bancoPotencia();
  const hoja = banco.doc.hojas[0]!;
  const escena = {
    componentes: hoja.componentes.length,
    cables: hoja.cables.length,
    trifasicas: hoja.componentes.filter((c) => c.tipo === "fuente.trifasica").length,
    redes: armarNetlist(hoja).redes.length,
  };
  progreso("S6: entrar a Simular (potencia)");
  const s6 = await medirEntrada(banco.doc, ancho, alto, VUELTAS_S6, "S6", "de potencia");
  return { muestras: { s6, p2: msArranque() }, escena };
}
