import React, { useState, useMemo, useRef } from "react";
import { Liquid } from "liquidjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Load all .liquid templates under src/templates as raw strings
const templateModules = import.meta.glob("./templates/*.liquid", {
  eager: true,
  as: "raw",
}) as Record<string, string>;

// Build a name->content map
const templates: Record<string, string> = Object.fromEntries(
  Object.entries(templateModules).map(([path, content]) => {
    const name = path.split("/").pop()?.replace(/\.liquid$/, "") ?? path;
    return [name, content];
  })
);

const DEFAULT_TEMPLATE_NAME = Object.keys(templates)[0];

// Load sample data JSON files
const sampleModules = import.meta.glob("./sample-data/*.json", { eager: true, as: "raw" }) as Record<string, string>;

const samples: Record<string, string> = Object.fromEntries(
  Object.entries(sampleModules).map(([path, content]) => {
    const name = path.split("/").pop()?.replace(/\.json$/, "") ?? path;
    return [name, content];
  })
);

const DEFAULT_SAMPLE_NAME = Object.keys(samples)[0] ?? "";

const engine = new Liquid({ strictVariables: false });

const DocumentGenerator: React.FC = () => {
  const [templateName, setTemplateName] = useState<string>(DEFAULT_TEMPLATE_NAME);
  const [templateContent, setTemplateContent] = useState<string>(templates[DEFAULT_TEMPLATE_NAME]);
  const [dataName, setDataName] = useState<string>(DEFAULT_SAMPLE_NAME);
  const [dataText, setDataText] = useState<string>(samples[DEFAULT_SAMPLE_NAME] || "{}");
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Update template content when selection changes (unless user edited)
  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
    setTemplateContent(templates[name]);
  };

  const handleSampleChange = (name: string) => {
    setDataName(name);
    setDataText(samples[name]);
  };

  const rendered = useMemo(() => {
    try {
      const data = JSON.parse(dataText || "{}");
      const tpl = engine.parse(templateContent);
      return engine.renderSync(tpl, data) as string;
    } catch (err: any) {
      setError(err.message);
      return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateContent, dataText]);

  const downloadPdf = () => {
    if (!previewRef.current) return;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const docHtml = `<!DOCTYPE html><html><head><title>${templateName}</title>
      <style>@media print { body { margin: 20px; } }</style>
    </head><body><div class="print-wrapper">${previewRef.current.innerHTML}</div></body></html>`;

    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();

    // Rely on browser's own scaling ("Fit to page" / "Scale" option).
    // Provide A4 print setup & margins via CSS for predictable output.
    const style = `
      @page { size: A4 portrait; margin: 12mm; }
      @media print {
        body      { zoom: 0.9; }              /* shrink everything */
        img,svg   { max-width: 100%; height: auto; }
        table     { width: 100%; }
        .pagebreak{ page-break-before: always; }
      }
    `;
    printWindow.document.head.appendChild(
      Object.assign(printWindow.document.createElement('style'), { textContent: style })
    );

    // Wait for content to finish loading before printing
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, { once: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 w-full mx-auto max-w-none">
      <h1 className="text-2xl font-bold">LiquidJS Document Generator</h1>

      <Card className="w-full">
        <CardContent className="space-y-4 p-4">
          {/* Template selector */}
          <label className="flex flex-col gap-2 max-w-xs">
            <span className="font-medium">Choose Template</span>
            <select
              value={templateName}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="border rounded-md p-2"
            >
              {Object.keys(templates).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {/* Sample JSON selector */}
          <label className="flex flex-col gap-2 max-w-xs">
            <span className="font-medium">Choose Sample Data</span>
            <select
              value={dataName}
              onChange={(e) => handleSampleChange(e.target.value)}
              className="border rounded-md p-2"
            >
              {Object.keys(samples).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium">Template Content (editable)</label>
              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                className="border rounded-md p-2 font-mono text-sm h-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium">Data (JSON)</label>
              <textarea
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                className="border rounded-md p-2 font-mono text-sm h-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="text-red-600 font-semibold">Error: {error}</div>}

      <Card className="w-full">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Preview</h2>
            <Button variant="outline" onClick={downloadPdf}>
              Print / Save PDF
            </Button>
          </div>
          <div
            ref={previewRef}
            className="prose max-w-none bg-white p-4 rounded-md overflow-auto border"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentGenerator; 