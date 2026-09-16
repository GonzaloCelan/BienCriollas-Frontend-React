import carne from "../../assets/variedades/thumbs/carne.jpg";
import verdura from "../../assets/variedades/thumbs/verdura.jpg";
import choclo from "../../assets/variedades/thumbs/choclo.jpg";
import pollo from "../../assets/variedades/thumbs/pollo.jpg";
import atun from "../../assets/variedades/thumbs/atun.jpg";
import capresse from "../../assets/variedades/thumbs/capresse.jpg";
import fugazza from "../../assets/variedades/thumbs/fugazza.jpg";
import quesoAzul from "../../assets/variedades/thumbs/queso-azul.jpg";
import bondiola from "../../assets/variedades/thumbs/bondiola.jpg";
import vacio from "../../assets/variedades/thumbs/vacio.jpg";
import campo from "../../assets/variedades/thumbs/campo.jpg";
import jamon from "../../assets/variedades/thumbs/jamon-queso.jpg";

const images: Record<number, string> = { 1: carne, 2: verdura, 3: choclo, 4: pollo, 5: atun, 6: capresse, 7: fugazza, 8: quesoAzul, 9: bondiola, 10: vacio, 11: campo, 12: jamon };
export function getVarietyImage(varietyId: number) { return images[varietyId] ?? carne; }
