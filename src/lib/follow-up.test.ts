import { describe, expect, it } from "vitest";
import { buildPhases, monthlyAlerts, studentsSpeakingInPhase, suggestPhaseStarts } from "./follow-up";
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
    expect(monthlyAlerts({ monitored: 1, target: 2, latestScore: 6.5, previousScore: 8, repeatedAoiCount: 2, pendingResponseDays: 4, responseLimitDays: 3, averageStudentsPct: 40, talkTimeYellow: 55, hasAutoFive: true })).toEqual(["Meta mensual pendiente", "Puntaje bajo", "Tendencia a la baja", "AOI recurrente", "Respuesta del coach pendiente", "Coach habla de más", "Auto 5"]);
  });

  it("no alerta talking time cuando no hay transcripts", () => {
    expect(monthlyAlerts({ monitored: 2, target: 2, latestScore: 9, previousScore: 8, repeatedAoiCount: 1, pendingResponseDays: null, responseLimitDays: 3, averageStudentsPct: null, talkTimeYellow: 55, hasAutoFive: false })).toEqual([]);
  });
});

describe("suggestPhaseStarts", () => {
  it("detecta break del coach seguido por un hueco de 90 segundos", () => {
    const segments = parseTranscript(`WEBVTT\n\n1\n00:04:00.000 --> 00:04:05.000\nCoach Mia: Let's begin\n\n2\n00:20:00.000 --> 00:20:05.000\nCoach Mia: Take a break now\n\n3\n00:21:40.000 --> 00:21:45.000\nAna: I'm back\n\n4\n00:30:00.000 --> 00:30:05.000\nCoach Mia: automatic fluency`);
    const starts = suggestPhaseStarts(segments, classifySpeakers(segments), 2100);
    expect(starts.break).toBe(1200);
    expect(starts.af).toBe(1800);
    expect(starts.cierre).toBe(1980);
  });
});