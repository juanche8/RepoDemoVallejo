import {
  AlertTriangle, BarChart3, Clipboard, Download, Funnel, Lightbulb,
  PackageSearch, Tags, TrendingDown, TrendingUp,
} from "lucide-react";
import { Section } from "./ui";

const icons = [
  Funnel, AlertTriangle, BarChart3, TrendingUp, TrendingDown,
  Tags, PackageSearch, Lightbulb, BarChart3,
];

type Props = {
  summary: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
};

export function ExecutiveSummary({ summary, copied, onCopy, onDownload }: Props) {
  const sections = summary.split("\n\n").slice(1);

  return (
    <Section
      title="Resumen ejecutivo"
      eyebrow="Lectura automática orientada al embudo"
      action={(
        <div className="export-actions">
          <button onClick={onCopy}><Clipboard />{copied ? "Copiado" : "Copiar"}</button>
          <button onClick={onDownload}><Download />Descargar TXT</button>
        </div>
      )}
    >
      <div className="executive-summary">
        {sections.map((block, index) => {
          const [title, ...body] = block.split("\n");
          const Icon = icons[index] ?? BarChart3;
          return (
            <article key={title}>
              <Icon />
              <span>{index + 1}</span>
              <h3>{title.replace(/^\d+\. /, "")}</h3>
              <p>{body.join(" ")}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
