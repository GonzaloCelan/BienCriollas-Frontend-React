import { ClipboardList, Layers3, Truck, Wheat } from "lucide-react";
import "../styles/secciones.css";

const sections = {
  proveedores: {
    title: "Proveedores", group: "Administración", icon: Truck,
    description: "Organizá los proveedores que acompañan tu negocio.",
    detail: "La gestión de proveedores estará disponible próximamente en esta sección.",
  },
  ingredientes: {
    title: "Ingredientes", group: "Producción", icon: Wheat,
    description: "Las materias primas de cada preparación, en un solo lugar.",
    detail: "La gestión de ingredientes estará disponible próximamente en esta sección.",
  },
  recetas: {
    title: "Recetas", group: "Producción", icon: ClipboardList,
    description: "El sabor de Bien Criollas empieza con cada receta.",
    detail: "La gestión de recetas estará disponible próximamente en esta sección.",
  },
  proceso: {
    title: "Proceso", group: "Producción", icon: Layers3,
    description: "Un espacio para organizar y seguir la elaboración.",
    detail: "El seguimiento del proceso de producción estará disponible próximamente en esta sección.",
  },
};

export default function SeccionEnPreparacion({ section }: { section: keyof typeof sections }) {
  const content = sections[section];
  return <section className="section-page page-transition" key={section} aria-labelledby="section-title">
    <header className="section-page-header">
      <p>{content.group}</p>
      <h2 id="section-title">{content.title}</h2>
      <span>{content.description}</span>
    </header>
    <div className="section-empty">
      <div className="section-empty-icon"><content.icon size={32} strokeWidth={1.5} /></div>
      <span className="section-status">Próximamente</span>
      <h3>{content.title === "Proceso" ? "El proceso toma forma" : `${content.title}, en preparación`}</h3>
      <p>{content.detail}</p>
    </div>
  </section>;
}
