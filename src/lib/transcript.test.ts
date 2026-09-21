import { describe, expect, it } from "vitest";

import {
  classifySpeakers,
  computeMetrics,
  parseTranscript,
  speakerKey,
  type TranscriptConfig,
} from "./transcript";

const config: TranscriptConfig = {
  talk_time_green: 70,
  talk_time_yellow: 55,
  student_min_pct: 8,
};

const VTT = `WEBVTT

1
00:01:27.370 --> 00:01:29.620
Coach Alam: Hello, hello, hello, hello, good morning!

2
00:01:31.650 --> 00:01:33.660
MATEO 👍👍👍: Good morning, Coach.

3
00:01:34.210 --> 00:01:36.360
Coach Alam: Hello, MATEO, how are you?
`;

describe("parseTranscript - VTT", () => {
  const segments = parseTranscript(VTT);

  it("parses three segments", () => {
    expect(segments).toHaveLength(3);
    expect(segments[0]!.speaker).toBe("Coach Alam");
    expect(segments[0]!.text).toBe("Hello, hello, hello, hello, good morning!");
  });

  it("groups speakers with durations", () => {
    const roles = classifySpeakers(segments);
    const coach = roles.find((r) => r.key === speakerKey("Coach Alam"))!;
    const mateo = roles.find((r) => r.key === speakerKey("MATEO"))!;

    expect(coach.turns).toBe(2);
    expect(coach.sec).toBeCloseTo(4.4, 2);
    expect(coach.role).toBe("coach");

    expect(mateo.turns).toBe(1);
    expect(mateo.sec).toBeCloseTo(2.01, 2);
    expect(mateo.role).toBe("alumno");
  });

  it("computes coach percentage", () => {
    const metrics = computeMetrics(segments, classifySpeakers(segments), config);
    expect(metrics.coach_pct).toBeCloseTo(68.6, 1);
    expect(metrics.students_pct).toBeCloseTo(31.4, 1);
    expect(metrics.traffic_light).toBe("rojo");
  });
});

describe("parseTranscript - Audio Transcript panel", () => {
  const PANEL = `Coach Alam
00:01:27
Hello, hello, good morning!
MATEO 👍👍👍
00:01:31
Good morning, Coach.
Coach Alam
00:02:00
Great, let's start.`;

  const segments = parseTranscript(PANEL);

  it("parses three segments with next-start ends", () => {
    expect(segments).toHaveLength(3);
    expect(segments[0]!.start).toBe(87);
    expect(segments[0]!.end).toBe(91);
    expect(segments[1]!.speaker).toBe("MATEO 👍👍👍");
  });

  it("caps a segment at 15 seconds", () => {
    // 00:01:31 -> next at 00:02:00 (29 s later) so it is capped at 15 s
    expect(segments[1]!.end - segments[1]!.start).toBe(15);
    // last segment has no next: capped at 15 s too
    expect(segments[2]!.end - segments[2]!.start).toBe(15);
  });

  it("counts silence from the capped gap", () => {
    const metrics = computeMetrics(segments, classifySpeakers(segments), config);
    expect(metrics.silence_min).toBeGreaterThan(0);
  });
});

describe("classifySpeakers", () => {
  it("detects audio shared and coach aliases", () => {
    const segments = parseTranscript(`WEBVTT

1
00:00:00.000 --> 00:00:05.000
Audio shared by Coach Alam: song

2
00:00:05.000 --> 00:00:10.000
Coah Neil: hello

3
00:00:10.000 --> 00:00:12.000
Sofia: hi
`);
    const roles = classifySpeakers(segments);
    expect(roles.find((r) => r.name.startsWith("Audio shared"))!.role).toBe("audio");
    expect(roles.find((r) => r.name === "Coah Neil")!.role).toBe("coach");
    expect(roles.find((r) => r.name === "Sofia")!.role).toBe("alumno");
  });
});

describe("parseTranscript - invalid input", () => {
  it("returns no segments", () => {
    expect(parseTranscript("esto no es un transcript")).toHaveLength(0);
  });
});
