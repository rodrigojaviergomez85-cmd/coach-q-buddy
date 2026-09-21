import { describe, expect, it } from "vitest";
import { calculateStudent, countNormalizedAois, kudosAoisHtml, resolvedAois } from "./monitoring";

describe("resolvedAois", () => {
  it("cuenta AOIs anteriores enlazados a ítems hoy marcados Sí", () => {
    expect(resolvedAois(
      [{ text: "Equal participation" }, { text: "Use gestures" }],
      [{ text: "Equal participation", item_id: "a" }, { text: "Use gestures", item_id: "b" }],
      [{ item_id: "a", result: "si", comment: "", evidence_time: null }, { item_id: "b", result: "no", comment: "", evidence_time: null }],
    )).toBe(1);
  });
});

describe("countNormalizedAois", () => {
  it("agrupa mayúsculas, acentos y puntuación", () => {
    expect(countNormalizedAois([["Participación equitativa"], [{ text: "participacion-equitativa" }]])[0]).toMatchObject({ count: 2 });
  });
});

describe("calculateStudent", () => {
  it("ignora criterios vacíos al calcular el promedio", () => {
    expect(calculateStudent({ gr: "10", pr: "8", fl: "", co: "", in: "" })).toEqual({
      score: 9,
      phrase: "Excellent",
    });
  });
});

describe("kudosAoisHtml", () => {
  it("genera listas HTML y texto plano con todos los kudos y AOIs en orden", () => {
    const { html, text } = kudosAoisHtml(["Great energy", "Good pacing"], [{ text: "Equal participation" }, { text: "Use gestures" }]);
    expect(html).toBe("<h3>Kudos</h3><ul><li>Great energy</li><li>Good pacing</li></ul><h3>AOIs</h3><ul><li>Equal participation</li><li>Use gestures</li></ul>");
    expect(text).toBe("Kudos\n- Great energy\n- Good pacing\n\nAOIs\n- Equal participation\n- Use gestures");
  });

  it("muestra mensajes cuando las listas están vacías", () => {
    const { html, text } = kudosAoisHtml([], []);
    expect(html).toContain("<p>Sin kudos registrados.</p>");
    expect(html).toContain("<p>Sin AOIs registrados.</p>");
    expect(text).toContain("Sin kudos registrados.");
    expect(text).toContain("Sin AOIs registrados.");
  });

  it("escapa caracteres especiales HTML", () => {
    const { html, text } = kudosAoisHtml(['A & B <b>"x"</b> \'y\''], [{ text: "5 > 3 & 2 < 4" }]);
    expect(html).toContain("<li>A &amp; B &lt;b&gt;&quot;x&quot;&lt;/b&gt; &#39;y&#39;</li>");
    expect(html).toContain("<li>5 &gt; 3 &amp; 2 &lt; 4</li>");
    expect(text).toContain('- A & B <b>"x"</b> \'y\'');
  });
});
