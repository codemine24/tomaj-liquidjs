import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Liquid } from "liquidjs";
import React, { useMemo, useRef, useState } from "react";

// Load all .liquid templates under src/templates as raw strings
const templateModules = import.meta.glob("./templates/*.liquid", {
  eager: true,
  as: "raw",
}) as Record<string, string>;

// Build a name->content map
const templates: Record<string, string> = Object.fromEntries(
  Object.entries(templateModules).map(([path, content]) => {
    const name =
      path
        .split("/")
        .pop()
        ?.replace(/\.liquid$/, "") ?? path;
    return [name, content];
  })
);

const DEFAULT_TEMPLATE_NAME = Object.keys(templates)[0];

// Load sample data JSON files
const sampleModules = import.meta.glob("./sample-data/*.json", {
  eager: true,
  as: "raw",
}) as Record<string, string>;

const samples: Record<string, string> = Object.fromEntries(
  Object.entries(sampleModules).map(([path, content]) => {
    const name =
      path
        .split("/")
        .pop()
        ?.replace(/\.json$/, "") ?? path;
    return [name, content];
  })
);

const DEFAULT_SAMPLE_NAME = Object.keys(samples)[0] ?? "";

const engine = new Liquid({ strictVariables: false });

export const DocumentGenerator: React.FC = () => {
  const [templateName, setTemplateName] = useState<string>(
    DEFAULT_TEMPLATE_NAME
  );
  const [templateContent, setTemplateContent] = useState<string>(
    templates[DEFAULT_TEMPLATE_NAME]
  );
  const [dataName, setDataName] = useState<string>(DEFAULT_SAMPLE_NAME);
  const [dataText, setDataText] = useState<string>(
    samples[DEFAULT_SAMPLE_NAME] || "{}"
  );
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
      // eslint-disable-next-line
    } catch (err: any) {
      setError(err.message as string);
      return "";
    }
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
      Object.assign(printWindow.document.createElement("style"), {
        textContent: style,
      })
    );

    // Wait for content to finish loading before printing
    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      },
      { once: true }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 mx-auto w-7xl">
      <h1 className="font-semibold">Document Generator</h1>

      <Card className="w-full">
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-4">
            {/* Template selector */}
            <div className="w-1/2">
              <label className="flex flex-col gap-2 max-w-1/2">
                <span className="font-medium text-start text-gray-500">
                  Choose Template
                </span>
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
            </div>

            {/* Sample JSON selector */}
            <div className="w-1/2">
              <label className="flex flex-col gap-2 max-w-1/2">
                <span className="font-medium text-start text-gray-500">
                  Choose Sample Data
                </span>
                <select
                  value={dataName}
                  onChange={(e) => handleSampleChange(e.target.value)}
                  className="border rounded-md p-2"
                >
                  {Object.keys(samples).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-start text-gray-500">
                Template Content (editable)
              </label>
              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                className="border rounded-md p-2 font-mono text-sm h-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-start text-gray-500">
                Data (JSON)
              </label>
              <textarea
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                className="border rounded-md p-2 font-mono text-sm h-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-red-600 font-semibold">Error: {error}</div>
      )}

      <Card className="w-full">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" onClick={downloadPdf}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="size-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </Button>
            <Button variant="outline" onClick={downloadPdf}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="size-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
                />
              </svg>
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
