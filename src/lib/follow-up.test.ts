import { describe, expect, it } from "vitest";
import { buildPhases, monthlyAlerts, studentsSpeakingInPhase } from "./follow-up";
import { parseTranscript, classifySpeakers } from "./transcript";

describe("buildPhases", () => {
  it("termina cada fase donde empieza la siguiente", () => {
    expect(buildPhases({ inicio: 0, contenido: 300, af: 900, cierre: 1500 }, 1800).map((p) => [p.kind, p.start, p.end])).toEqual([
      ["inicio", 0, 300], ["contenido", 300, 900], ["af", 900, 1500], ["cierre", 1500, 1800],
    ]);
  });
});

describe("studentsSpeakingInPhase", () => {
  it("cuenta alumnos que hablaron durante AF", () => {
    const segments = parseTranscript(`WEBVTT\n\n1\n00:10:00.000 --> 00:10:04.000\nAna: hello\n\n2\n00:11:00.000 --> 00:11:04.000\nCoach Mia: great\n\n3\n00:12:00.000 --> 00:12:04.000\nLuis: hi`);
    expect(studentsSpeakingInPhase(segments, classifySpeakers(segments), { kind: "af", start: 590, end: 730 })).toEqual(["Ana", "Luis"]);
  });
});

describe("monthlyAlerts", () => {
  it("aplica todas las reglas", () => {
    expect(monthlyAlerts({ monitored: 1, target: 2, latestScore: 6.5, previousScore: 8, repeatedAoiCount: 2, pendingResponseDays: 4, responseLimitDays: 3 })).toHaveLength(5);
  });
});